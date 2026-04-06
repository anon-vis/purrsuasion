import type BetterSQLite from "better-sqlite3";
import { Result, ok, err } from "neverthrow";
import type {
  ClassOverview,
  DomainError,
  CreateClass,
  CreateUser,
  Message,
} from "../models";
import { UserRepository } from "../repositories/user";
import { ClassRepository } from "../repositories/class";
import { GroupRepository } from "../repositories/group";
import { RoundRepository } from "../repositories/round";
import { PromptRepository } from "../repositories/prompt";
import { MessageRepository } from "../repositories/message";
import {
  canStartClass,
  assignStudentsToGroups,
  determineReceiverForRound,
  createRoundAssignments,
} from "../core/core";

import { hashPassword } from "../core/auth";
import { NotebookService } from "./notebook";

export class ClassService {
  private userRepo: UserRepository;
  private classRepo: ClassRepository;
  private groupRepo: GroupRepository;
  private roundRepo: RoundRepository;
  private promptRepo: PromptRepository;
  private messageRepo: MessageRepository;
  private notebookService: NotebookService;

  constructor(private db: BetterSQLite.Database) {
    this.userRepo = new UserRepository(db);
    this.classRepo = new ClassRepository(db);
    this.groupRepo = new GroupRepository(db);
    this.roundRepo = new RoundRepository(db);
    this.promptRepo = new PromptRepository(db);
    this.messageRepo = new MessageRepository(db);
    this.notebookService = new NotebookService(db);
  }

  addClass(data: CreateClass): Result<number, DomainError> {
    try {
      const addClassTransaction = this.db.transaction((data: CreateClass) => {
        const classId = this.classRepo.insert(
          data.name,
          data.description,
          data.status,
        );

        for (const student of data.students) {
          const hashedPassword = hashPassword(student.password_hash);

          const userWithHashedPassword: CreateUser = {
            ...student,
            password_hash: hashedPassword,
          };

          const userId = this.userRepo.insert(userWithHashedPassword);

          this.classRepo.insertEnrollment({
            user_id: userId,
            class_id: classId,
          });
        }

        return classId;
      });

      return ok(addClassTransaction(data));
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  startClass(classId: number): Result<void, DomainError> {
    try {
      const startClassTransaction = this.db.transaction((classId: number) => {
        const classData = this.classRepo.findById(classId);

        if (!classData) {
          throw new Error(`Class ${classId} not found`);
        }

        const students = this.userRepo.findByClassId(classId);
        const prompts = this.promptRepo.findAll();

        const validation = canStartClass(classData, students);

        if (validation.isErr()) {
          throw new Error(validation.error.type);
        }

        const groupAssignments = assignStudentsToGroups(students);

        for (const group of groupAssignments) {
          const groupId = this.groupRepo.insert(classId);

          for (const member of group.members) {
            this.groupRepo.insertAssignment({
              group_id: groupId,
              user_id: member.id,
            });
          }

          const totalRounds = group.members.length;
          const roundsToCreate = Array.from(
            { length: totalRounds },
            (_, i) => ({
              groupId,
              roundNumber: i + 1,
              isActive: i === 0, // Only first round is active
            }),
          );

          const roundIds = this.roundRepo.insertMany(roundsToCreate);

          let promptsAvailable = prompts;
          for (let i = 0; i < totalRounds; i++) {
            const roundNumber = i + 1;
            const roundId = roundIds[i];

            const receiverId = determineReceiverForRound(
              group.members,
              roundNumber,
            );

            const [assignedPromptCategory, assignments] =
              createRoundAssignments(
                group.members,
                receiverId,
                promptsAvailable,
                roundId,
              );

            for (const assignment of assignments) {
              const roundAssignmentId = this.roundRepo.insertAssignment(
                assignment.userId,
                assignment.roundId,
                assignment.promptId,
                roundNumber === 1,
              );

              // Create notebook for senders
              if (assignment.role === "sender") {
                this.notebookService.addNotebook(
                  assignedPromptCategory,
                  roundAssignmentId,
                );
              }
            }

            // Filter out used prompts
            promptsAvailable = promptsAvailable.filter(
              (p) => p.category !== assignedPromptCategory,
            );
          }
        }

        this.classRepo.updateStatus(classId, "in progress");
      });

      startClassTransaction(classId);
      return ok(undefined);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getClassOverview(classId: number): Result<ClassOverview, DomainError> {
    try {
      const classData = this.classRepo.findById(classId);
      if (!classData) {
        return err({ type: "NotFound", entity: "Class", id: classId });
      }

      const groupIds = this.groupRepo.findByClassId(classId);

      if (groupIds.length === 0) {
        const students = this.userRepo.findByClassId(classId);
        return ok({
          name: classData.name,
          description: classData.description ?? "",
          status: "inactive",
          students,
        });
      }

      const groups = groupIds.map((groupId) => {
        const students = this.userRepo.findByGroupId(groupId);
        const currentRound = this.roundRepo.findCurrentByGroupId(groupId);
        const receiverAssignment =
          this.roundRepo.findCurrentReceiverByGroupId(groupId);

        return {
          students,
          currentRound: currentRound?.round_number ?? 1,
          groupId,
          receiverId: receiverAssignment?.user_id ?? students[0].id,
        };
      });

      return ok({
        name: classData.name,
        description: classData.description ?? "",
        status: "in progress",
        groups,
      });
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getClasses(): Result<any[], DomainError> {
    try {
      return ok(this.classRepo.findAll());
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getStudentsWhoCompletedPuzzle(
    classId: number,
    prompt: string,
  ): Result<{ user_id: number }[], DomainError> {
    try {
      return ok(this.messageRepo.getSendersWhoCompletedPuzzle(classId, prompt));
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getSenderThread(
    prompt: string,
    sender_id: number,
  ): Result<
    (Message & { round_assignment_id: number; sender_id: number })[],
    DomainError
  > {
    try {
      return ok(
        this.messageRepo.getCompletedRoundThreadsByPromptAndSender(
          prompt,
          sender_id,
        ),
      );
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  endClass(classId: number) {
    try {
      return ok(this.classRepo.updateStatus(classId, "completed"));
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  exportGameplayData(classId: number) {
    try {
      return ok(this.classRepo.exportGameplayData(classId));
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

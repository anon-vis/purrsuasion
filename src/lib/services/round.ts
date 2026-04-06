import type BetterSQLite from "better-sqlite3";
import { err, ok, Result } from "neverthrow";

import { canCompleteRound, canSendMessage, groupMessages } from "../core/core";
import { eventBus } from "../events/bus";
import { EventEmitter } from "../events/emitter";
import { MessageRepository } from "../repositories/message";
import { RoundRepository } from "../repositories/round";
import { RoundOutcomeRepository } from "../repositories/round-outcome";
import { UserRepository } from "../repositories/user";

import type {
  DomainError,
  CreateMessage,
  Message,
  UserRoundInfo,
} from "../models";
export class RoundService {
  private messageRepo: MessageRepository;
  private roundRepo: RoundRepository;
  private outcomeRepo: RoundOutcomeRepository;
  private userRepo: UserRepository;
  private eventEmitter: EventEmitter;

  constructor(private db: BetterSQLite.Database) {
    this.messageRepo = new MessageRepository(db);
    this.roundRepo = new RoundRepository(db);
    this.outcomeRepo = new RoundOutcomeRepository(db);
    this.userRepo = new UserRepository(db);
    this.eventEmitter = new EventEmitter(eventBus);
  }

  startRound(roundId: number) {
    const round = this.roundRepo.findById(roundId);

    if (!round) {
      return err({ type: "NotFound", entity: "Round", id: roundId });
    }

    if (round.started_at) {
      return err({
        type: "BusinessRule",
        rule: "round_already_started",
        message: "Round has already been started",
      });
    }

    const assignments = this.roundRepo.findAssignmentsByRoundId(roundId);

    this.roundRepo.startRound(roundId);

    const groupMemberIds = assignments.map((a) => a.user_id);

    // EMIT round_start event to all group members
    this.eventEmitter.emitToUsers(groupMemberIds, "round_start");

    return ok(undefined);
  }

  concludeRound(
    roundId: number,
    receiverId: number,
    winnerUserId: number,
    justification: string
  ): Result<void, DomainError> {
    try {
      let groupMemberIds: number[] = [];

      const transaction = this.db.transaction(() => {
        // GATHER DATA
        const round = this.roundRepo.findById(roundId);

        if (!round) {
          throw new Error(`Round ${roundId} not found`);
        }

        const assignments = this.roundRepo.findAssignmentsByRoundId(roundId);

        const senderIds: number[] = [];

        for (const assignment of assignments) {
          const prompt = this.db
            .prepare<[number], { is_for_receiver: number }>(
              "SELECT is_for_receiver FROM prompts WHERE id = ?"
            )
            .get(assignment.prompt_id);

          if (prompt?.is_for_receiver !== 1) {
            senderIds.push(assignment.user_id);
          }
        }

        groupMemberIds = assignments.map((a) => a.user_id);

        const allMessages: Message[] = [];
        for (const assignment of assignments) {
          const userMessages = this.messageRepo.getAllThreads(
            assignment.user_id,
            roundId
          );
          allMessages.push(...userMessages);
        }

        const uniqueMessages = Array.from(
          new Map(allMessages.map((m) => [m.id, m])).values()
        );

        const validation = canCompleteRound(
          uniqueMessages,
          senderIds,
          receiverId
        );

        if (validation.isErr()) {
          return err(validation.error);
        }

        this.outcomeRepo.insert({
          round_id: roundId,
          winner_user_id: winnerUserId,
          justification,
          created_at: new Date().toISOString(),
        });

        this.roundRepo.updateAssignmentStatus(roundId, false);
        this.roundRepo.markComplete(roundId);

        const nextRoundNumber = round.round_number + 1;
        const nextRoundQuery = this.db.prepare<[number, number]>(`
          SELECT id FROM rounds 
          WHERE group_id = ? AND round_number = ?
        `);
        const nextRound = nextRoundQuery.get(round.group_id, nextRoundNumber);

        if (nextRound) {
          const nextRoundId = (nextRound as { id: number }).id;
          this.roundRepo.activateRound(nextRoundId);
          this.roundRepo.updateAssignmentStatus(nextRoundId, true);
        }
      });

      transaction();

      // Winner gets "round_win", losers get "round_loss", receiver gets "round_complete"
      const loserIds = groupMemberIds.filter(
        (id) => id !== winnerUserId && id !== receiverId
      );

      this.eventEmitter.emitToUser(receiverId, "round_complete");
      this.eventEmitter.emitToUser(winnerUserId, "round_win");
      this.eventEmitter.emitToUsers(loserIds, "round_loss");

      return ok(undefined);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getUserRoundInfo(userId: number): Result<UserRoundInfo, DomainError> {
    try {
      const roundInfo = this.roundRepo.findUserRoundInfo(userId);

      if (!roundInfo) {
        return err({
          type: "NotFound",
          entity: "ActiveRound",
          id: userId,
        });
      }

      const groupMembers = this.userRepo.findByGroupId(roundInfo.group_id);

      return ok({
        is_active: roundInfo.is_active === 1,
        user_id: roundInfo.user_id,
        round_id: roundInfo.round_id,
        round_assignment_id: roundInfo.round_assignment_id,
        prompt_id: roundInfo.prompt_id,
        is_for_receiver: roundInfo.is_for_receiver === 1,
        instructions: roundInfo.instructions,
        group_id: roundInfo.group_id,
        group_members: groupMembers,
        category: roundInfo.category,
        started_at: roundInfo.started_at,
        condensed_instructions: roundInfo.condensed_instructions,
      });
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  sendMessage(message: CreateMessage): Result<number, DomainError> {
    try {
      const existingMessages = this.messageRepo.getAllThreads(
        message.user_id,
        message.round_id
      );

      const validation = canSendMessage(
        existingMessages,
        message.user_id,
        message.recipient_id
      );

      if (validation.isErr()) {
        return err(validation.error);
      }

      const messageId = this.messageRepo.insert(message);

      const allMessages = this.messageRepo.getAllThreads(
        message.user_id,
        message.round_id
      );

      // Notify recipient that they received a message
      this.eventEmitter.emitToUser(message.recipient_id, "message_received");

      // Check if all visualizations submitted (only if this message has a viz)
      if (message.visualization !== null) {
        const checkResult = this.checkAllVisualizationsSubmitted(
          message.round_id
        );
        if (checkResult.isOk() && checkResult.value) {
          // Get receiver for this round
          const receiverResult = this.getReceiverForRound(message.round_id);
          if (receiverResult.isOk()) {
            this.eventEmitter.emitToUser(receiverResult.value, "able_to_judge");
          }
        }
      }

      return ok(messageId);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  sendMessageToAllGroupMembers(
    groupId: number,
    message: CreateMessage
  ): Result<void, DomainError> {
    try {
      const members = this.userRepo.findByGroupId(groupId);
      const recipientIds = members
        .filter((m) => m.id !== message.user_id)
        .map((m) => m.id);

      for (const recipientId of recipientIds) {
        const result = this.sendMessage({
          ...message,
          recipient_id: recipientId,
        });

        if (result.isErr()) {
          return err(result.error);
        }
      }

      return ok(undefined);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getAllThreads(
    userId: number,
    roundId: number
  ): Result<Record<number, Message[]>, DomainError> {
    try {
      const messages = this.messageRepo.getAllThreads(userId, roundId);
      const threads = groupMessages(messages, userId);
      return ok(threads);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getThread(recipientId: number, senderId: number, roundId: number) {
    try {
      return ok(this.messageRepo.getThread(recipientId, senderId, roundId));
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getInbox(recipientId: number, roundId: number) {
    try {
      const inbox = this.messageRepo.getInbox(recipientId, roundId);
      const hasSentMessages = this.messageRepo.hasSentMessages(
        recipientId,
        roundId
      );

      return ok({ inbox: inbox, hasSentMessages: hasSentMessages });
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getAllVisualizationsForRound(
    roundId: number
  ): Result<Message[], DomainError> {
    try {
      console.log("RoundId: ", roundId);
      const messages = this.messageRepo.findVisualizationsByRound(roundId);

      console.log("From services: ", messages);

      // Get latest visualization per sender
      const latestBySender = new Map<number, Message>();

      for (const msg of messages) {
        const existing = latestBySender.get(msg.user_id);
        if (
          !existing ||
          new Date(msg.timestamp) > new Date(existing.timestamp)
        ) {
          latestBySender.set(msg.user_id, msg);
        }
      }

      return ok(Array.from(latestBySender.values()));
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private checkAllVisualizationsSubmitted(
    roundId: number
  ): Result<boolean, DomainError> {
    try {
      // Get all assignments for this round
      const assignments = this.roundRepo.findAssignmentsByRoundId(roundId);

      // Find sender assignments (not receiver)
      const senderIds = assignments
        .filter((a) => {
          // Query to check if this is a sender (not receiver)
          const prompt = this.db
            .prepare<[number], { is_for_receiver: number }>(
              "SELECT is_for_receiver FROM prompts WHERE id = ?"
            )
            .get(a.prompt_id);
          return prompt && prompt.is_for_receiver === 0;
        })
        .map((a) => a.user_id);

      // Get all messages with visualizations for this round
      const vizMessages = this.messageRepo.findVisualizationsByRound(roundId);
      const sendersWithViz = new Set(vizMessages.map((m) => m.user_id));

      // Check if all senders have submitted
      const allSubmitted = senderIds.every((id) => sendersWithViz.has(id));

      return ok(allSubmitted);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getReceiverForRound(roundId: number): Result<number, DomainError> {
    try {
      const assignments = this.roundRepo.findAssignmentsByRoundId(roundId);

      for (const assignment of assignments) {
        const prompt = this.db
          .prepare<[number], { is_for_receiver: number }>(
            "SELECT is_for_receiver FROM prompts WHERE id = ?"
          )
          .get(assignment.prompt_id);

        if (prompt && prompt.is_for_receiver === 1) {
          return ok(assignment.user_id);
        }
      }

      return err({
        type: "NotFound",
        entity: "Receiver",
        id: roundId,
      });
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

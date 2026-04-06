import { Result, ok, err } from "neverthrow";
import { MAX_THREAD_SIZE, GROUP_SIZE, MIN_STUDENTS_TO_START } from "../../config/game.config";
import type {
  User,
  Class,
  Cell,
  CellState,
  Message,
  DomainError,
  Prompt,
  GroupWithMembers,
  RoleAssignment,
} from "../models";
import { shuffle, group, fnv1a } from "./utils";
import _ from "lodash";

// ============================================================================
// CLASS
// ============================================================================

export function canStartClass(
  classData: Class,
  students: User[]
): Result<void, DomainError> {
  if (classData.status !== "inactive") {
    return err({
      type: "BusinessRule",
      rule: "class_already_started",
      message: `Class ${classData.name} has already been started`,
    });
  }

  if (students.length === 0) {
    return err({
      type: "BusinessRule",
      rule: "no_students_enrolled",
      message: "Cannot start class with no students enrolled",
    });
  }

  const activeStudents = students.filter((s) => s.is_active);
  if (activeStudents.length < MIN_STUDENTS_TO_START) {
    return err({
      type: "BusinessRule",
      rule: "insufficient_students",
      message: `Need at least ${MIN_STUDENTS_TO_START} active students to start class`,
    });
  }

  return ok(undefined);
}

export function canCompleteClass(
  classData: Class,
  allRoundsComplete: boolean
): Result<void, DomainError> {
  if (classData.status === "completed") {
    return err({
      type: "BusinessRule",
      rule: "class_already_complete",
      message: `Class ${classData.name} is already completed`,
    });
  }

  if (!allRoundsComplete) {
    return err({
      type: "BusinessRule",
      rule: "rounds_incomplete",
      message: "Cannot complete class while rounds are still in progress",
    });
  }

  return ok(undefined);
}

export function assignStudentsToGroups(
  students: User[],
  groupSize: number = GROUP_SIZE
): GroupWithMembers[] {
  const activeStudents = students.filter((s) => s.is_active);

  // Separate by consent to maximize consented groups of 3
  const consented = activeStudents.filter((s) => s.is_consented);
  const nonConsented = activeStudents.filter((s) => !s.is_consented); // Includes TAs

  // Shuffle each pool separately
  const shuffledConsented = shuffle([...consented]);
  const shuffledNonConsented = shuffle([...nonConsented]);

  // Group consented students first to maximize full consented groups
  const consentedGroups = group(shuffledConsented, groupSize);

  // Separate complete and incomplete consented groups
  const completeConsentedGroups = consentedGroups.filter(
    (g) => g.length === groupSize
  );
  const incompleteConsentedGroups = consentedGroups.filter(
    (g) => g.length < groupSize
  );

  // Fill incomplete consented groups with non-consented students (including TAs)
  let nonConsentedIndex = 0;
  for (const group of incompleteConsentedGroups) {
    while (
      group.length < groupSize &&
      nonConsentedIndex < shuffledNonConsented.length
    ) {
      group.push(shuffledNonConsented[nonConsentedIndex]);
      nonConsentedIndex++;
    }
  }

  // Group remaining non-consented students
  const remainingNonConsented = shuffledNonConsented.slice(nonConsentedIndex);
  const nonConsentedGroups = group(remainingNonConsented, groupSize);

  // Combine all groups: consented groups first (for data collection priority)
  const allGroups = [
    ...completeConsentedGroups,
    ...incompleteConsentedGroups,
    ...nonConsentedGroups,
  ].filter((g) => g.length > 0); // Remove any empty groups

  // Assign group IDs
  return allGroups.map((members, index) => ({
    groupId: index,
    members,
  }));
}

// ============================================================================
// ROUND DOMAIN
// ============================================================================

export function determineReceiverForRound(
  groupMembers: User[],
  roundNumber: number
): number {
  const receiverIndex = (roundNumber - 1) % groupMembers.length;
  return groupMembers[receiverIndex].id;
}

export function createRoundAssignments(
  groupMembers: User[],
  receiverId: number,
  prompts: Prompt[],
  roundId: number
): [string, RoleAssignment[]] {
  const receiverPrompts = prompts.filter((p) => p.is_for_receiver)!;
  const randomReceiverPrompt =
    receiverPrompts[Math.floor(Math.random() * receiverPrompts.length)];

  const senderPromptOfSameCategory = prompts.find(
    (p) => !p.is_for_receiver && randomReceiverPrompt.category === p.category
  );

  if (!randomReceiverPrompt || !senderPromptOfSameCategory) {
    throw new Error(`No prompts available to assign.`);
  }

  const assignedPromptCategory = senderPromptOfSameCategory.category;

  return [
    assignedPromptCategory,
    groupMembers.map((member) => {
      if (member.id === receiverId) {
        return {
          role: "receiver" as const,
          userId: member.id,
          promptId: randomReceiverPrompt.id,
          roundId,
        };
      } else {
        return {
          role: "sender" as const,
          userId: member.id,
          promptId: senderPromptOfSameCategory.id,
          roundId,
        };
      }
    }),
  ];
}

export function calculateTotalRounds(groupSize: number): number {
  return groupSize;
}

export function canCompleteRound(
  messages: Message[],
  senderIds: number[],
  receiverId: number
): Result<void, DomainError> {
  const messagesWithViz = messages.filter((m) => m.visualization !== null);
  const sendersWithViz = new Set(messagesWithViz.map((m) => m.user_id));

  const sendersWithoutViz = senderIds.filter((id) => !sendersWithViz.has(id));

  if (sendersWithoutViz.length > 0) {
    return err({
      type: "BusinessRule",
      rule: "incomplete_visualizations",
      message: `Cannot complete round: ${sendersWithoutViz.length} sender(s) have not submitted visualizations`,
    });
  }

  return ok(undefined);
}

export function canSendMessage(
  existingMessages: Message[],
  senderId: number,
  receiverId: number
): Result<void, DomainError> {
  const threadMessages = existingMessages.filter(
    (m) =>
      (m.user_id === senderId && m.recipient_id === receiverId) ||
      (m.user_id === receiverId && m.recipient_id === senderId)
  );

  if (threadMessages.length >= MAX_THREAD_SIZE) {
    return err({
      type: "BusinessRule",
      rule: "thread_size_exceeded",
      message: `Cannot send message: thread has reached maximum size of ${MAX_THREAD_SIZE}`,
    });
  }

  return ok(undefined);
}

export function getThreadSize(
  messages: Message[],
  userId1: number,
  userId2: number
): number {
  return messages.filter(
    (m) =>
      (m.user_id === userId1 && m.recipient_id === userId2) ||
      (m.user_id === userId2 && m.recipient_id === userId1)
  ).length;
}

// ============================================================================
// MESSAGING DOMAIN
// ============================================================================

export function groupMessages(
  messages: Message[],
  currentUserId: number
): Record<number, Message[]> {
  const receivedMessages = messages.filter(
    (m) => m.recipient_id === currentUserId
  );
  const sentMessages = messages.filter((m) => m.user_id === currentUserId);

  const groupedBySender = _.groupBy(receivedMessages, "user_id");

  const threads: Record<number, Message[]> = {};

  for (const [senderId, received] of Object.entries(groupedBySender)) {
    const senderIdNum = Number(senderId);
    const sentToThisPerson = sentMessages.filter(
      (m) => m.recipient_id === senderIdNum
    );

    const allMessages = [...received, ...sentToThisPerson].sort(
      (a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)
    );

    threads[senderIdNum] = allMessages;
  }

  return threads;
}

// ============================================================================
// NOTEBOOK DOMAIN
// ============================================================================

export function calculateNextVersion(currentVersion: number | null): number {
  return currentVersion ? currentVersion + 1 : 1;
}

export function calculateCellHash(cell: Cell): string {
  const sourceJson = JSON.stringify(cell.source);
  return fnv1a(sourceJson);
}

export function findMatchingCellState(
  cell: Cell,
  existingStates: CellState[]
): CellState | null {
  const hash = calculateCellHash(cell);
  const match = existingStates.find(
    (state) => state.cell_id === cell.id && state.source_hash === hash
  );
  return match || null;
}

export function createCellsOrder(cells: Cell[]): string {
  return JSON.stringify(cells.map((c) => c.id));
}

export function validateCells(cells: Cell[]): Result<void, DomainError> {
  if (cells.length === 0) {
    return err({
      type: "Validation",
      field: "cells",
      message: "Cannot create snapshot with no cells",
    });
  }

  for (const cell of cells) {
    if (!cell.id || !cell.cell_type) {
      return err({
        type: "Validation",
        field: "cell",
        message: "Cell missing required fields (id or cell_type)",
      });
    }
  }

  return ok(undefined);
}

import type BetterSQLite from "better-sqlite3";
import type { Round, RoundAssignment, Prompt } from "../models";

export class RoundRepository {
  constructor(private db: BetterSQLite.Database) {}

  findById(roundId: number): Round | null {
    const query = this.db.prepare<[number], Round>(
      "SELECT * FROM rounds WHERE id = ?"
    );
    return query.get(roundId) || null;
  }

  findCurrentByGroupId(groupId: number): Round | null {
    const query = this.db.prepare<[number], Round>(
      "SELECT * FROM rounds WHERE group_id = ? AND is_active = 1 LIMIT 1"
    );
    return query.get(groupId) || null;
  }

  insert(groupId: number, roundNumber: number, isActive: boolean): number {
    const query = this.db.prepare<[number, number, number, string | null]>(
      "INSERT INTO rounds (group_id, round_number, is_active, started_at) VALUES (?, ?, ?, ?)"
    );
    const startedAt = isActive ? new Date().toISOString() : null;
    const result = query.run(groupId, roundNumber, isActive ? 1 : 0, startedAt);
    return result.lastInsertRowid as number;
  }

  insertMany(
    rounds: Array<{ groupId: number; roundNumber: number; isActive: boolean }>
  ): number[] {
    const query = this.db.prepare<[number, number, number, string | null]>(
      "INSERT INTO rounds (group_id, round_number, is_active, started_at) VALUES (?, ?, ?, ?)"
    );
    return rounds.map((r) => {
      const result = query.run(
        r.groupId,
        r.roundNumber,
        r.isActive ? 1 : 0,
        null
      );
      return result.lastInsertRowid as number;
    });
  }

  insertAssignment(
    userId: number,
    roundId: number,
    promptId: number,
    isActive: boolean
  ): number {
    const query = this.db.prepare<[number, number, number, number]>(
      "INSERT INTO round_assignments (user_id, round_id, prompt_id, is_active) VALUES (?, ?, ?, ?)"
    );
    const result = query.run(userId, roundId, promptId, isActive ? 1 : 0);
    return result.lastInsertRowid as number;
  }

  updateAssignmentStatus(roundId: number, isActive: boolean): void {
    const query = this.db.prepare<[number, number]>(
      "UPDATE round_assignments SET is_active = ? WHERE round_id = ?"
    );
    query.run(isActive ? 1 : 0, roundId);
  }

  markComplete(roundId: number): void {
    const query = this.db.prepare<[string, number]>(
      "UPDATE rounds SET is_active = 0, completed_at = ? WHERE id = ?"
    );
    query.run(new Date().toISOString(), roundId);
  }

  activateRound(roundId: number): void {
    const query = this.db.prepare<[number]>(
      "UPDATE rounds SET is_active = 1 WHERE id = ?"
    );
    query.run(roundId);
  }

  startRound(roundId: number): void {
    const query = this.db.prepare<[string, number]>(
      "UPDATE rounds SET started_at = ? WHERE id = ?"
    );
    query.run(new Date().toISOString(), roundId);
  }

  findAssignmentsByRoundId(roundId: number): RoundAssignment[] {
    const query = this.db.prepare<[number], RoundAssignment>(
      "SELECT * FROM round_assignments WHERE round_id = ?"
    );
    return query.all(roundId);
  }

  findCurrentReceiverByGroupId(groupId: number): RoundAssignment | null {
    const query = this.db.prepare<[number], RoundAssignment>(`
      SELECT ra.*
      FROM round_assignments ra
      JOIN rounds r ON ra.round_id = r.id
      JOIN prompts p ON ra.prompt_id = p.id
      WHERE r.group_id = ? AND ra.is_active = 1 AND p.is_for_receiver = 1
      LIMIT 1
    `);
    return query.get(groupId) || null;
  }

  findUserRoundInfo(userId: number): any | null {
    const query = this.db.prepare<[number]>(`
      SELECT 
        ra.is_active,
        ra.user_id,
        ra.round_id,
        ra.id as round_assignment_id,
        ra.prompt_id,
        p.condensed_instructions,
        p.is_for_receiver,
        p.instructions,
        p.category,
        r.group_id,
        r.started_at
      FROM round_assignments ra
      JOIN rounds r ON ra.round_id = r.id
      JOIN prompts p ON ra.prompt_id = p.id
      WHERE ra.user_id = ? AND ra.is_active = 1
      LIMIT 1
    `);
    return query.get(userId) || null;
  }
}

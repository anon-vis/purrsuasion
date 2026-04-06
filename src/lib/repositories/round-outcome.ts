import type BetterSQLite from "better-sqlite3";
import type { RoundOutcome, CreateRoundOutcome } from "../models";

export class RoundOutcomeRepository {
  constructor(private db: BetterSQLite.Database) {}

  insert(outcome: CreateRoundOutcome): number {
    const query = this.db.prepare<[number, number, string, string]>(
      "INSERT INTO round_outcomes (round_id, winner_user_id, justification, created_at) VALUES (?, ?, ?, ?)"
    );
    const result = query.run(
      outcome.round_id,
      outcome.winner_user_id,
      outcome.justification,
      new Date().toISOString()
    );
    return result.lastInsertRowid as number;
  }

  findByRoundId(roundId: number): RoundOutcome | null {
    const query = this.db.prepare<[number], RoundOutcome>(
      "SELECT * FROM round_outcomes WHERE round_id = ?"
    );
    return query.get(roundId) || null;
  }
}

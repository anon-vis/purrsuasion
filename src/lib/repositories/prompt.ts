import type BetterSQLite from "better-sqlite3";
import type { Prompt } from "../models";

export class PromptRepository {
  constructor(private db: BetterSQLite.Database) {}

  findAll(): Prompt[] {
    const query = this.db.prepare<[], Prompt>("SELECT * FROM prompts");
    return query.all();
  }

  findByRoundNumber(roundNumber: number): Prompt[] {
    const query = this.db.prepare<[number], Prompt>(
      "SELECT * FROM prompts WHERE for_round_number = ?"
    );
    return query.all(roundNumber);
  }
}

import type BetterSQLite from "better-sqlite3";
import type { User, CreateUser } from "../models";

export class UserRepository {
  constructor(private db: BetterSQLite.Database) {}

  findById(id: number): User | null {
    const query = this.db.prepare<[number], User>(
      "SELECT * FROM users WHERE id = ?",
    );
    return query.get(id) || null;
  }

  findByUsername(user: string): User | null {
    const query = this.db.prepare<[string], User>(
      "SELECT * FROM users WHERE username = ?",
    );
    return query.get(user) || null;
  }

  findByClassId(classId: number): User[] {
    const query = this.db.prepare<[number], User>(`
      SELECT u.* 
      FROM users u
      JOIN class_enrollments ce ON u.id = ce.user_id
      WHERE ce.class_id = ?
    `);
    return query.all(classId);
  }

  findByGroupId(groupId: number): User[] {
    const query = this.db.prepare<[number], User>(`
      SELECT u.*
      FROM users u
      JOIN group_assignments ga ON u.id = ga.user_id
      WHERE ga.group_id = ?
    `);
    return query.all(groupId);
  }

  insert(user: CreateUser): number {
    const query = this.db.prepare<[string, string, string, number, number]>(
      "INSERT INTO users (username, password_hash, user_type, is_consented, is_active) VALUES (?, ?, ?, ?, ?)",
    );

    const result = query.run(
      user.username,
      user.password_hash,
      user.user_type,
      user.is_consented ? 1 : 0,
      user.is_active ? 1 : 0,
    );

    return result.lastInsertRowid as number;
  }

  updateActive(id: number, active: number): void {
    console.log("new active status: ", active);
    const query = this.db.prepare<[number, number]>(
      "UPDATE users SET is_active = ? WHERE id = ?",
    );
    query.run(active, id);
  }

  updateConsented(id: number, consented: number): void {
    const query = this.db.prepare<[number, number]>(
      "UPDATE users SET is_consented = ? WHERE id = ?",
    );
    query.run(consented, id);
  }
}

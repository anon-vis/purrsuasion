import type BetterSQLite from "better-sqlite3";
import type { CreateGroupAssignment } from "../models";

export class GroupRepository {
  constructor(private db: BetterSQLite.Database) {}

  findByClassId(classId: number): number[] {
    const query = this.db.prepare<[number], { id: number }>(
      "SELECT id FROM groups WHERE class_id = ?"
    );
    return query.all(classId).map((g) => g.id);
  }

  insert(classId: number): number {
    const query = this.db.prepare<[number]>(
      "INSERT INTO groups (class_id) VALUES (?)"
    );
    const result = query.run(classId);
    return result.lastInsertRowid as number;
  }

  insertAssignment(assignment: CreateGroupAssignment): number {
    const query = this.db.prepare<[number, number]>(
      "INSERT INTO group_assignments (group_id, user_id) VALUES (?, ?)"
    );
    const result = query.run(assignment.group_id, assignment.user_id);
    return result.lastInsertRowid as number;
  }

  insertAssignments(assignments: CreateGroupAssignment[]): void {
    const query = this.db.prepare<[number, number]>(
      "INSERT INTO group_assignments (group_id, user_id) VALUES (?, ?)"
    );
    for (const assignment of assignments) {
      query.run(assignment.group_id, assignment.user_id);
    }
  }
}

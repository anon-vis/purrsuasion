import type BetterSQLite from "better-sqlite3";
import type { Class, CreateClassEnrollment } from "../models";

interface MessageThread {
  round_id: number;
  message_id: number;
  from_username: string;
  to_username: string;
  subject: string;
  body: string;
  has_vis: number;
  timestamp: string;
}

interface Round {
  round_id: number;
  round_number: number;
  started_at: string;
  completed_at: string;
  prompt_category: string;
  receiver_username: string | null;
  winner_username: string | null;
  justification: string;
  message_threads: Record<string, MessageThread[]>;
}

interface Group {
  student_usernames: string[];
  rounds: Record<number, Round>;
}

export class ClassRepository {
  constructor(private db: BetterSQLite.Database) {}

  findById(classId: number): Class | null {
    const query = this.db.prepare<[number], Class>(
      "SELECT * FROM classes WHERE id = ?",
    );
    return query.get(classId) || null;
  }

  findAll(): Class[] {
    const query = this.db.prepare<[], Class>("SELECT * FROM classes");
    return query.all();
  }

  insert(name: string, description: string | null, status: string): number {
    const query = this.db.prepare<[string, string | null, string, string]>(
      "INSERT INTO classes (name, description, status, created_at) VALUES (?, ?, ?, ?)",
    );
    const result = query.run(
      name,
      description,
      status,
      new Date().toISOString(),
    );
    return result.lastInsertRowid as number;
  }

  updateStatus(classId: number, status: string): void {
    const query = this.db.prepare<[string, number]>(
      "UPDATE classes SET status = ? WHERE id = ?",
    );
    query.run(status, classId);
  }

  insertEnrollment(enrollment: CreateClassEnrollment): number {
    const query = this.db.prepare<[number, number]>(
      "INSERT INTO class_enrollments (user_id, class_id) VALUES (?, ?)",
    );
    const result = query.run(enrollment.user_id, enrollment.class_id);
    return result.lastInsertRowid as number;
  }

  exportGameplayData(classId: number): Record<number, Group> {
    const usernameMap = this.db
      .prepare<[number], { username: string; anon_username: string }>(
        `SELECT u.username, 'student_' || u.id AS anon_username
         FROM users u
         JOIN class_enrollments e ON u.id = e.user_id
         WHERE e.class_id = ?
           AND u.is_active = 1
           AND u.is_consented = 1
           AND u.user_type = 'student'`,
      )
      .all(classId);

    const anonToReal = new Map(
      usernameMap.map((r) => [r.anon_username, r.username]),
    );

    const roundRows = this.db
      .prepare<
        [number],
        {
          round_id: number;
          round_number: number;
          started_at: string;
          completed_at: string;
          group_id: number;
          prompt_category: string;
          anon_username: string;
          is_receiver: number;
          is_winner: number;
          justification: string;
        }
      >(
        `SELECT
          r.id                     AS round_id,
          r.round_number,
          r.started_at,
          r.completed_at,
          r.group_id,
          p.category               AS prompt_category,
          'student_' || u.id       AS anon_username,
          p.is_for_receiver        AS is_receiver,
          ro.winner_user_id = u.id AS is_winner,
          ro.justification
         FROM rounds r
         JOIN groups g             ON r.group_id = g.id
         JOIN round_assignments ra ON r.id = ra.round_id
         JOIN users u              ON ra.user_id = u.id
         JOIN prompts p            ON ra.prompt_id = p.id
         JOIN round_outcomes ro    ON r.id = ro.round_id
         WHERE g.class_id = ?
           AND r.completed_at IS NOT NULL
           AND u.is_active = 1
           AND u.is_consented = 1
           AND u.user_type = 'student'`,
      )
      .all(classId);

    const messages = this.db
      .prepare<
        [number],
        {
          round_id: number;
          message_id: number;
          from_username: string;
          to_username: string;
          subject: string;
          body: string;
          has_vis: number;
          timestamp: string;
        }
      >(
        `SELECT DISTINCT
          m.round_id,
          m.id                         AS message_id,
          'student_' || m.user_id      AS from_username,
          'student_' || m.recipient_id AS to_username,
          m.subject,
          m.body,
          m.visualization IS NOT NULL  AS has_vis,
          m.timestamp
         FROM messages m
         JOIN rounds r ON m.round_id = r.id
         JOIN groups g ON r.group_id = g.id
         JOIN users u  ON m.user_id = u.id
         WHERE g.class_id = ?
           AND u.is_active = 1
           AND u.is_consented = 1
           AND u.user_type = 'student'`,
      )
      .all(classId);

    const groups: Record<number, Group> = {};

    for (const row of roundRows) {
      const {
        round_id,
        round_number,
        started_at,
        completed_at,
        group_id,
        prompt_category,
        anon_username,
        is_receiver,
        is_winner,
        justification,
      } = row;

      let cleanedJustification = justification.toLowerCase();
      for (const [anon, real] of anonToReal) {
        cleanedJustification = cleanedJustification.replaceAll(
          `${anon} `,
          `${real} `,
        );
      }

      const getThread = (senderCnet: string): MessageThread[] =>
        messages
          .filter(
            (m) =>
              m.round_id === round_id &&
              (m.from_username === senderCnet || m.to_username === senderCnet),
          )
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      if (!groups[group_id]) {
        groups[group_id] = { student_usernames: [], rounds: {} };
      }

      const group = groups[group_id];

      if (!group.student_usernames.includes(anon_username)) {
        group.student_usernames.push(anon_username);
      }

      if (!group.rounds[round_id]) {
        group.rounds[round_id] = {
          round_id,
          round_number,
          started_at,
          completed_at,
          prompt_category,
          receiver_username: is_receiver ? anon_username : null,
          winner_username: is_winner ? anon_username : null,
          justification: cleanedJustification,
          message_threads: {},
        };
      }

      const round = group.rounds[round_id];

      if (is_receiver) round.receiver_username = anon_username;
      if (is_winner) round.winner_username = anon_username;
      if (!is_receiver)
        round.message_threads[anon_username] = getThread(anon_username);
    }

    return groups;
  }
}

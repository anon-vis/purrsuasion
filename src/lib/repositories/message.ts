import type BetterSQLite from "better-sqlite3";
import type { Message, CreateMessage } from "../models";

export class MessageRepository {
  constructor(private db: BetterSQLite.Database) {}

  // Gets all messages sent and received by user
  getAllThreads(userId: number, roundId: number): Message[] {
    const query = this.db.prepare<[number, number, number], Message>(
      "SELECT * FROM messages WHERE (recipient_id = ? OR user_id = ?) AND round_id = ?",
    );
    return query.all(userId, userId, roundId);
  }

  // Gets messages sent by sender and responses from recipient
  getThread(recipientId: number, senderId: number, roundId: number): Message[] {
    const queryString = `
      SELECT * 
      FROM messages 
      WHERE round_id = ? AND ((recipient_id = ? AND user_id = ?) OR (recipient_id = ? AND user_id = ?))
      ORDER BY timestamp ASC;`;

    const query = this.db.prepare<
      [number, number, number, number, number],
      Message
    >(queryString);
    return query.all(roundId, recipientId, senderId, senderId, recipientId);
  }

  // Gets the last message sent by each other user to this user
  getInbox(recipientId: number, roundId: number): Message[] {
    const queryString = `
      SELECT m.*
      FROM messages m
      INNER JOIN (
        SELECT user_id, MAX(timestamp) as max_timestamp
        FROM messages 
        WHERE recipient_id = ? AND round_id = ?
        GROUP BY user_id
      ) latest ON m.user_id = latest.user_id AND m.timestamp = latest.max_timestamp
      WHERE m.recipient_id = ? AND m.round_id = ?
      ORDER BY m.timestamp DESC
    `;

    const query = this.db.prepare<[number, number, number, number], Message>(
      queryString,
    );
    return query.all(recipientId, roundId, recipientId, roundId);
  }

  insert(message: CreateMessage): number {
    const query = this.db.prepare<
      [
        number,
        number,
        number,
        string,
        string,
        Buffer<ArrayBuffer> | null,
        string,
        string | null,
      ]
    >(
      "INSERT INTO messages (user_id, recipient_id, round_id, subject, body, visualization, timestamp, cell_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const result = query.run(
      message.user_id,
      message.recipient_id,
      message.round_id,
      message.subject,
      message.body,
      message.visualization,
      new Date().toISOString(),
      message.cell_id,
    );
    return result.lastInsertRowid as number;
  }

  findVisualizationsByRound(roundId: number): Message[] {
    const query = this.db.prepare<[number], Message>(`
      SELECT m.*
      FROM messages m
      JOIN round_assignments ra ON m.round_id = ra.round_id AND m.user_id = ra.user_id
      JOIN prompts p ON ra.prompt_id = p.id
      WHERE m.round_id = ? AND p.is_for_receiver = 0 AND m.visualization IS NOT NULL
    `);
    const messages = query.all(roundId);

    return messages;
  }

  hasSentMessages(userId: number, roundId: number): boolean {
    const queryString = `
      SELECT 1
      FROM messages
      WHERE user_id = ? AND round_id = ?
      LIMIT 1
    `;

    const query = this.db.prepare<[number, number], { 1: number }>(queryString);
    const result = query.get(userId, roundId);

    return result !== undefined;
  }

  getSendersWhoCompletedPuzzle(classId: number, prompt: string) {
    const queryString = `
      SELECT b.user_id
      FROM prompts a
      JOIN round_assignments b ON a.id = b.prompt_id
      JOIN rounds c ON b.round_id = c.id
      JOIN groups d ON c.group_id = d.id
      WHERE c.completed_at IS NOT NULL
        AND a.is_for_receiver = 0
        AND a.category = ?
        AND d.class_id = ?;
   `;

    const query = this.db.prepare<[string, number], { user_id: number }>(
      queryString,
    );
    return query.all(prompt, classId);
  }

  getCompletedRoundThreadsByPromptAndSender(
    prompt: string,
    sender_id: number,
  ): (Message & { sender_id: number; round_assignment_id: number })[] {
    const queryString = `
      select b.id as 'round_assignment_id', b.user_id as 'sender_id', d.*
      from prompts a
      join round_assignments b on a.id = b.prompt_id
      join rounds c on b.round_id = c.id
      join messages d on c.id = d.round_id and (d.user_id = b.user_id OR d.recipient_id = b.user_id)
      where c.completed_at is not null and a.is_for_receiver = 0 and a.category = ? and b.user_id = ? and d.visualization is not null;
    `;

    const query = this.db.prepare<
      [string, number],
      Message & { sender_id: number; round_assignment_id: number }
    >(queryString);
    return query.all(prompt, sender_id);
  }
}

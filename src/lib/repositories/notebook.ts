import type BetterSQLite from "better-sqlite3";
import type {
  Notebook,
  NotebookSnapshot,
  CellState,
  ChartExecution,
} from "../models";

export class NotebookRepository {
  constructor(private db: BetterSQLite.Database) {}

  findByRoundAssignmentId(roundAssignmentId: number): Notebook | null {
    const query = this.db.prepare<[number], Notebook>(
      "SELECT * FROM notebooks WHERE round_assignment_id = ?",
    );
    return query.get(roundAssignmentId) || null;
  }

  insert(roundAssignmentId: number): number {
    const now = new Date().toISOString();
    const query = this.db.prepare<[number, string, string]>(
      "INSERT INTO notebooks (round_assignment_id, created_at, last_modified_at) VALUES (?, ?, ?)",
    );
    const result = query.run(roundAssignmentId, now, now);
    return result.lastInsertRowid as number;
  }

  updateLastModified(notebookId: number): void {
    const query = this.db.prepare<[string, number]>(
      "UPDATE notebooks SET last_modified_at = ? WHERE id = ?",
    );
    query.run(new Date().toISOString(), notebookId);
  }

  findLatestSnapshot(notebookId: number): NotebookSnapshot | null {
    const query = this.db.prepare<[number], NotebookSnapshot>(`
      SELECT * FROM notebook_snapshots
      WHERE notebook_id = ?
      ORDER BY version DESC
      LIMIT 1
    `);
    return query.get(notebookId) || null;
  }

  insertSnapshot(
    notebookId: number,
    timestamp: string,
    version: number,
    cellsOrder: string,
    changeType: string,
  ): number {
    const query = this.db.prepare<[number, string, number, string, string]>(`
      INSERT INTO notebook_snapshots (notebook_id, timestamp, version, cells_order, change_type)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = query.run(
      notebookId,
      timestamp,
      version,
      cellsOrder,
      changeType,
    );
    return result.lastInsertRowid as number;
  }

  findCellState(cellId: string, sourceHash: string): CellState | null {
    const query = this.db.prepare<[string, string], CellState>(
      "SELECT * FROM cell_states WHERE cell_id = ? AND source_hash = ? LIMIT 1",
    );
    return query.get(cellId, sourceHash) || null;
  }

  insertCellState(
    cellId: string,
    cellType: string,
    sourceHash: string,
    source: string,
    timestamp: string,
  ): number {
    const query = this.db.prepare<[string, string, string, string, string]>(`
      INSERT INTO cell_states (cell_id, cell_type, source_hash, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = query.run(cellId, cellType, sourceHash, source, timestamp);
    return result.lastInsertRowid as number;
  }

  linkSnapshotCell(
    snapshotId: number,
    cellStateId: number,
    position: number,
  ): void {
    const query = this.db.prepare<[number, number, number]>(
      "INSERT INTO snapshot_cells (snapshot_id, cell_state_id, position) VALUES (?, ?, ?)",
    );
    query.run(snapshotId, cellStateId, position);
  }

  insertCellExecution(
    snapshotId: number,
    cellStateId: number,
    timestamp: string,
    status: string,
    context: string | null,
  ): number {
    const query = this.db.prepare<
      [number, number, string, string, string | null]
    >(`
      INSERT INTO cell_executions (snapshot_id, cell_state_id, timestamp, status, context)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = query.run(
      snapshotId,
      cellStateId,
      timestamp,
      status,
      context,
    );
    return result.lastInsertRowid as number;
  }

  getCellsBySnapshotId(snapshotId: number): Array<{
    cell_id: string;
    cell_type: string;
    source: string;
  }> {
    const query = this.db.prepare<[number]>(`
      SELECT cs.cell_id, cs.cell_type, cs.source
      FROM snapshot_cells sc
      JOIN cell_states cs ON sc.cell_state_id = cs.id
      WHERE sc.snapshot_id = ?
      ORDER BY sc.position
    `);
    return query.all(snapshotId) as Array<{
      cell_id: string;
      cell_type: string;
      source: string;
    }>;
  }

  getChartExecutions(round_assignment_id: number): ChartExecution[] {
    const queryString = `
      SELECT
        d.source,
        MIN(d.cell_id) AS cell_id,
        MIN(e.snapshot_id)  AS snapshot_id,
        MIN(e.timestamp)    AS timestamp,
        e.context
      FROM notebooks a
      JOIN notebook_snapshots b  ON a.id = b.notebook_id
      JOIN snapshot_cells c      ON c.snapshot_id = b.id
      JOIN cell_states d         ON c.cell_state_id = d.id
      JOIN cell_executions e     ON e.snapshot_id = b.id
                                AND e.cell_state_id = d.id
      WHERE a.round_assignment_id = ?
        AND e.context LIKE '%chart%'
      GROUP BY d.source_hash
      ORDER BY e.timestamp;
    `;

    const query = this.db.prepare<[number], ChartExecution>(queryString);

    return query.all(round_assignment_id);
  }
}

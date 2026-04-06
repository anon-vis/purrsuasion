import type BetterSQLite from "better-sqlite3";
import { Result, ok, err } from "neverthrow";
import { v4 as uuidv4 } from "uuid";
import type {
  Cell,
  NotebookJSON,
  ChangeType,
  ExecutionStatus,
  DomainError,
  ChartExecution,
} from "../models";
import { NotebookRepository } from "../repositories/notebook";
import {
  calculateNextVersion,
  calculateCellHash,
  createCellsOrder,
  validateCells,
} from "../core/core";

export class NotebookService {
  private repo: NotebookRepository;

  private promptCategoryToDefaultNotebook: Record<string, Cell[]> = {
    "Outliers and Individual Points": [
      {
        id: uuidv4(),
        cell_type: "code",
        source: [
          "import pandas as pd",
          "import altair as alt",
          "import numpy as np",
        ],
      },
      {
        id: uuidv4(),
        cell_type: "code",
        source: [`df = pd.read_csv('/oaip.csv')`, "df.head(10)"],
      },
    ],
    "Peaks and Gaps": [
      {
        id: uuidv4(),
        cell_type: "code",
        source: [
          "import pandas as pd",
          "import altair as alt",
          "import numpy as np",
          "alt.data_transformers.disable_max_rows()",
        ],
      },
      {
        id: uuidv4(),
        cell_type: "code",
        source: [`df = pd.read_csv('/pag.csv')`, "df.head(10)"],
      },
    ],
    "Hot Spots and MAUP": [
      {
        id: uuidv4(),
        cell_type: "code",
        source: ["import pandas as pd", "import altair as alt", "import json"],
      },
      {
        id: uuidv4(),
        cell_type: "code",
        source: [
          `stores = pd.read_csv('/hsam.csv', dtype={'GEOID': 'string'})`,
          "states_geojson = json.load(open('/states.geojson', 'r'))",
          "regions_geojson = json.load(open('/regions.geojson', 'r'))",
          "county_geojson = json.load(open('/counties.geojson', 'r'))",
          "# the STUSPS column is common in both the stores dataframe and states_geojson",
          "# the REGIONCE column is common in both the stores dataframe and regions_geojson",
          "# the GEOID column is common in both the stores dataframe and counties_geojson",
          "stores.head(10)",
        ],
      },
      {
        id: uuidv4(),
        cell_type: "code",
        source: [
          "# Link to documentation for choropleth maps: https://altair-viz.github.io/gallery/choropleth.html",
        ],
      },
    ],
  };

  constructor(private db: BetterSQLite.Database) {
    this.repo = new NotebookRepository(db);
  }

  getNotebookByRoundAssignment(
    roundAssignmentId: number,
  ): Result<NotebookJSON, DomainError> {
    try {
      const notebook = this.repo.findByRoundAssignmentId(roundAssignmentId);

      if (!notebook) {
        return err({
          type: "NotFound",
          entity: "Notebook",
          id: roundAssignmentId,
        });
      }

      const latestSnapshot = this.repo.findLatestSnapshot(notebook.id);

      if (!latestSnapshot) {
        return err({
          type: "NotFound",
          entity: "Snapshot",
          id: notebook.id,
        });
      }

      const cellsData = this.repo.getCellsBySnapshotId(latestSnapshot.id);

      const cells: Cell[] = cellsData.map((c) => ({
        id: c.cell_id,
        cell_type: c.cell_type as "code" | "raw",
        source: JSON.parse(c.source),
      }));

      return ok({
        id: notebook.id,
        cells,
      });
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getCellExecutions(
    round_assignment_id: number,
  ): Result<ChartExecution[], DomainError> {
    try {
      return ok(this.repo.getChartExecutions(round_assignment_id));
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getCellsAtSnapshot(
    snapshot_id: number,
  ): Result<
    { cell_id: string; source: string; cell_type: string }[],
    DomainError
  > {
    try {
      return ok(this.repo.getCellsBySnapshotId(snapshot_id));
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  addNotebook(
    promptCategory: string,
    roundAssignmentId: number,
  ): Result<number, DomainError> {
    try {
      const transaction = this.db.transaction(() => {
        const defaultCells: Cell[] =
          this.promptCategoryToDefaultNotebook[promptCategory];

        const now = new Date().toISOString();
        const notebookId = this.repo.insert(roundAssignmentId);

        const snapshotResult = this.createSnapshot(
          notebookId,
          defaultCells,
          now,
          "initialization",
        );

        if (snapshotResult.isErr()) {
          throw err(snapshotResult.error);
        }

        return notebookId;
      });

      return ok(transaction());
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logNotebookChange(
    notebookId: number,
    cells: Cell[],
    changeType: Exclude<ChangeType, "execution" | "initialization">,
  ): Result<void, DomainError> {
    try {
      const transaction = this.db.transaction(() => {
        const now = new Date().toISOString();

        const snapshotResult = this.createSnapshot(
          notebookId,
          cells,
          now,
          changeType,
        );

        if (snapshotResult.isErr()) {
          throw err(snapshotResult.error);
        }

        this.repo.updateLastModified(notebookId);
      });

      transaction();
      return ok(undefined);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logCellExecution(
    notebookId: number,
    cells: Cell[],
    executedCellId: string,
    status: ExecutionStatus,
    context: string,
  ): Result<number, DomainError> {
    try {
      const transaction = this.db.transaction(() => {
        const now = new Date().toISOString();

        const snapshotResult = this.createSnapshot(
          notebookId,
          cells,
          now,
          "execution",
        );

        if (snapshotResult.isErr()) {
          throw err(snapshotResult.error);
        }

        const snapshotId = snapshotResult.value;

        const executedCell = cells.find((c) => c.id === executedCellId);
        if (!executedCell) {
          throw new Error(`Cell ${executedCellId} not found in notebook`);
        }

        const cellStateId = this.getOrCreateCellState(executedCell, now);

        const executionId = this.repo.insertCellExecution(
          snapshotId,
          cellStateId,
          now,
          status,
          context,
        );

        this.repo.updateLastModified(notebookId);

        return executionId;
      });

      return ok(transaction());
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private createSnapshot(
    notebookId: number,
    cells: Cell[],
    timestamp: string,
    changeType: ChangeType,
  ): Result<number, DomainError> {
    // VALIDATE (functional core)
    const validation = validateCells(cells);
    if (validation.isErr()) {
      throw err(validation.error);
    }

    // GET CURRENT VERSION (imperative shell)
    const latestSnapshot = this.repo.findLatestSnapshot(notebookId);

    // CALCULATE NEXT VERSION (functional core)
    const version = calculateNextVersion(
      latestSnapshot ? latestSnapshot.version : null,
    );

    // CREATE CELLS ORDER (functional core)
    const cellsOrder = createCellsOrder(cells);

    // INSERT SNAPSHOT (imperative shell)
    const snapshotId = this.repo.insertSnapshot(
      notebookId,
      timestamp,
      version,
      cellsOrder,
      changeType,
    );

    // PROCESS CELLS
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const cellStateId = this.getOrCreateCellState(cell, timestamp);
      this.repo.linkSnapshotCell(snapshotId, cellStateId, i);
    }

    return ok(snapshotId);
  }

  private getOrCreateCellState(cell: Cell, timestamp: string): number {
    // CALCULATE HASH (functional core)
    const sourceHash = calculateCellHash(cell);
    const sourceJson = JSON.stringify(cell.source);

    // CHECK FOR EXISTING (imperative shell)
    const existing = this.repo.findCellState(cell.id, sourceHash);

    if (existing) {
      return existing.id;
    }

    // CREATE NEW (imperative shell)
    return this.repo.insertCellState(
      cell.id,
      cell.cell_type,
      sourceHash,
      sourceJson,
      timestamp,
    );
  }
}

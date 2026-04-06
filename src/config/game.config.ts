// =============================================================================
// Game Rules
// =============================================================================

/** Maximum number of messages (in both directions) allowed per thread per round. */
export const MAX_THREAD_SIZE = 4;

/** Number of students per group. Also determines the number of rounds per group. */
export const GROUP_SIZE = 3;

/** Minimum number of active students required to start a class. */
export const MIN_STUDENTS_TO_START = 2;

// =============================================================================
// SSE / Real-time
// =============================================================================

/** How often (ms) the server sends a keepalive ping over SSE connections. */
export const HEARTBEAT_INTERVAL = 30000;

/** How long (ms) without a successful heartbeat before a connection is cleaned up. */
export const HEARTBEAT_TIMEOUT = 120000;

// =============================================================================
// Auth
// =============================================================================

/** JWT session duration. Uses jose duration string format: "3h", "30m", "2d", etc. */
export const JWT_EXPIRATION = "3h";

// =============================================================================
// Type definitions for puzzles.json
// =============================================================================

export interface MarksetEntry {
  mark: string;
  heuristic: string;
}

export interface PuzzleSignal {
  name: string;
  role: "sender" | "receiver";
  relevant_fields: string[];
  markset: MarksetEntry[];
}

export interface PuzzlePrompt {
  role: "sender" | "receiver";
  instructions: string;
  condensed_instructions: string;
  is_for_receiver: boolean;
}

export interface NotebookCellTemplate {
  cell_type: "code" | "raw";
  source: string[];
}

export interface PuzzleDefinition {
  name: string;
  prompts: PuzzlePrompt[];
  signals: PuzzleSignal[];
  defaultNotebook: NotebookCellTemplate[];
}

export interface PuzzlesConfig {
  puzzles: PuzzleDefinition[];
}

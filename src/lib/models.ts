interface BaseEntity {
  id: number;
}

type UserType = "admin" | "student";

interface User extends BaseEntity {
  username: string;
  password_hash: string;
  user_type: UserType;
  is_consented: boolean;
  is_active: boolean;
}

type ClassStatus = "inactive" | "in progress" | "completed";

interface Class extends BaseEntity {
  name: string;
  description: string | null;
  status: ClassStatus;
  created_at: Date | number;
}

interface ClassEnrollment extends BaseEntity {
  user_id: number;
  class_id: number;
}

interface Round extends BaseEntity {
  round_number: number;
  group_id: number;
  is_active: boolean;
  started_at: Date | string | null;
  completed_at: Date | string | null;
}

interface Prompt extends BaseEntity {
  instructions: string;
  condensed_instructions: string;
  category: string;
  is_for_receiver: boolean;
}

interface RoundAssignment extends BaseEntity {
  user_id: number;
  round_id: number;
  prompt_id: number;
  is_active: boolean;
}

interface Message extends BaseEntity {
  user_id: number;
  recipient_id: number;
  round_id: number;
  subject: string;
  body: string;
  cell_id: string | null;
  visualization: Buffer<ArrayBuffer> | null;
  timestamp: Date | string;
}

interface RoundOutcome extends BaseEntity {
  round_id: number;
  winner_user_id: number;
  justification: string;
  created_at: Date | string;
}

interface Group extends BaseEntity {
  class_id: number;
}

interface GroupAssignment extends BaseEntity {
  group_id: number;
  user_id: number;
}

type CreateUser = Omit<User, "id">;
type UpdateUser = Omit<User, "password_hash" | "user_type" | "username">;

type CreateClass = Omit<Class, "id" | "created_at"> & {
  students: CreateUser[];
};

type CreateClassEnrollment = Omit<ClassEnrollment, "id">;

type CreateGroup = Omit<Group, "id">;

type CreateGroupAssignment = Omit<GroupAssignment, "id">;

type CreateRound = Omit<Round, "id">;

type CreateRoundAssignment = Omit<RoundAssignment, "id">;

type CreateMessage = Omit<Message, "id">;

type CreateRoundOutcome = Omit<RoundOutcome, "id">;

interface MessageWithUser extends Message {
  user: User;
}

interface AssignmentWithDetails extends RoundAssignment {
  user: User;
  round: Round;
  prompt: Prompt;
}

interface UserRoundInfo {
  is_active: boolean;
  user_id: number;
  round_id: number;
  round_assignment_id: number;
  prompt_id: number;
  category: string;
  is_for_receiver: boolean;
  instructions: string;
  condensed_instructions: string;
  group_id: number;
  group_members?: User[];
  started_at: Date | string | undefined;
}

type StudentGroupOverview = {
  students: User[];
  currentRound: number;
  groupId: number;
  receiverId: number;
};

type ClassOverview =
  | {
      name: string;
      description: string;
      status: "inactive";
      students: User[];
    }
  | {
      name: string;
      description: string;
      status: "in progress";
      groups: StudentGroupOverview[];
    }
  | {
      name: string;
      description: string;
      status: "completed";
      groups: StudentGroupOverview[];
    };

type RoundOverview = {
  round_id: number;
  round_number: number;
  instructions: string;
  is_for_receiver: boolean;
};

interface NotebookJSON {
  id: number;
  cells: Cell[];
}

interface Cell {
  id: string;
  cell_type: "code" | "raw";
  source: string[];
}

type ChangeType =
  | "cell_added"
  | "cell_deleted"
  | "cell_reordered"
  | "save"
  | "execution"
  | "initialization";

type ExecutionStatus = "success" | "error";

interface Notebook {
  id: number;
  round_assignment_id: number;
  created_at: string;
  last_modified_at: string;
}

interface NotebookSnapshot {
  id: number;
  notebook_id: number;
  timestamp: string;
  version: number;
  cells_order: string;
  change_type: ChangeType;
}

interface CellState {
  id: number;
  cell_id: string;
  cell_type: "code" | "raw";
  source_hash: string;
  source: string;
  created_at: string;
}

interface CellExecution {
  id: number;
  snapshot_id: number;
  cell_state_id: number;
  timestamp: string;
  status: ExecutionStatus;
  context: string | null;
}

// Domain types
type RoleAssignment =
  | { role: "receiver"; userId: number; promptId: number; roundId: number }
  | { role: "sender"; userId: number; promptId: number; roundId: number };

type GroupWithMembers = {
  groupId: number;
  members: User[];
};

type RoundState =
  | { stage: "active"; roundId: number }
  | { stage: "complete"; roundId: number; outcome: RoundOutcome };

type DomainError =
  | { type: "NotFound"; entity: string; id: number | string }
  | { type: "Validation"; field: string; message: string }
  | { type: "BusinessRule"; rule: string; message: string }
  | { type: "Conflict"; message: string };

type GameEvent =
  | "message_received"
  | "able_to_judge"
  | "round_start"
  | "round_win"
  | "round_loss"
  | "round_complete"
  | "refresh";

interface GameEventsConnection {
  userId: number;
  controller: ReadableStreamDefaultController;
  unsubscribe: () => void;
  lastHeartbeat: number;
}

interface ChartExecution {
  source: string;
  snapshot_id: number;
  timestamp: Date | string;
  context: string;
  cell_id: string;
}

export type {
  ChartExecution,
  GameEventsConnection,
  GameEvent,
  NotebookJSON,
  Cell,
  CellExecution,
  CellState,
  NotebookSnapshot,
  Notebook,
  ExecutionStatus,
  ChangeType,
  BaseEntity,
  UserType,
  User,
  Class,
  ClassEnrollment,
  ClassOverview,
  StudentGroupOverview,
  Round,
  Prompt,
  RoundAssignment,
  Message,
  RoundOutcome,
  CreateUser,
  UpdateUser,
  CreateClass,
  CreateClassEnrollment,
  CreateGroup,
  CreateGroupAssignment,
  CreateRound,
  CreateRoundAssignment,
  CreateMessage,
  CreateRoundOutcome,
  MessageWithUser,
  AssignmentWithDetails,
  UserRoundInfo,
  RoundOverview,
  Group,
  GroupAssignment,
  RoleAssignment,
  GroupWithMembers,
  RoundState,
  DomainError,
};

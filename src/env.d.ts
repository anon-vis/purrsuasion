declare namespace App {
  type AdminLocals = {
    id: number;
    username: string;
    userType: "admin";
  };

  type StudentLocals = {
    id: number;
    username: string;
    userType: "student";
    groupId: number;
    roundId: number;
    roundAssignmentId: number;
    isReceiver: boolean;
    prompt: string;
    condensedPrompt: string;
    groupMembers: { id: number; username: string }[];
    roundStarted: Date | string | undefined;
    category: string;
  };

  type Locals = AdminLocals | StudentLocals;
}

interface ImportMetaEnv {
  readonly JWT_SECRET: string;
}

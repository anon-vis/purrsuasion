import { db } from "../../db";
import { ClassService } from "./class";
import { AuthService } from "./auth";
import { RoundService } from "./round";
import { NotebookService } from "./notebook";
import { UserService } from "./user";
import { eventBus } from "../events/bus";
import { SSEService } from "./sse";

export const classService = new ClassService(db);
export const authService = new AuthService(db);
export const roundService = new RoundService(db);
export const notebookService = new NotebookService(db);
export const userService = new UserService(db);

export const sseService = new SSEService(eventBus, authService);

// Prevent duplicate heartbeats in dev mode with HMR
if (!sseService.heartbeatInterval) {
  sseService.startHeartbeat();
  console.log("SSE heartbeat started");
}

// Register cleanup handlers (only once)
if (typeof process !== "undefined") {
  // Use global flag to prevent duplicate handler registration
  const handlersKey = "__sseHandlersRegistered";

  if (!(global as any)[handlersKey]) {
    const cleanup = () => {
      console.log("Shutting down SSE service...");
      sseService.closeAll();
      process.exit(0);
    };

    process.on("SIGTERM", cleanup);
    process.on("SIGINT", cleanup);

    (global as any)[handlersKey] = true;
    console.log("SSE cleanup handlers registered");
  }
}

import type { GameEvent, GameEventsConnection } from "../models";
import type { EventBus } from "../events/bus";
import type { AuthService } from "./auth";

export class SSEService {
  private connections: Map<number, GameEventsConnection & { closed: boolean }>;
  heartbeatInterval: NodeJS.Timeout | null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 120000; // 2 minutes

  constructor(private eventBus: EventBus, private authService: AuthService) {
    this.connections = new Map();
    this.heartbeatInterval = null;
  }

  startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleUserIds: number[] = [];

      this.connections.forEach((conn, userId) => {
        // Skip already closed connections
        if (conn.closed) {
          staleUserIds.push(userId);
          return;
        }

        // Try to send heartbeat
        const sent = this.sendHeartbeat(userId);

        if (!sent) {
          // Failed to send, mark for cleanup
          staleUserIds.push(userId);
        } else if (now - conn.lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
          // No successful heartbeat in timeout period
          console.log(`Cleaning up stale connection for user ${userId}`);
          staleUserIds.push(userId);
        }
      });

      // Clean up stale connections
      staleUserIds.forEach((userId) => this.removeConnection(userId));

      if (staleUserIds.length > 0) {
        console.log(`SSE: Cleaned up ${staleUserIds.length} stale connections`);
      }
    }, this.HEARTBEAT_INTERVAL);

    console.log("SSE heartbeat started");
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log("SSE heartbeat stopped");
    }
  }

  async addConnection(
    token: string,
    controller: ReadableStreamDefaultController
  ): Promise<void> {
    const userResult = this.authService.verifyToken(token);

    if (userResult.isErr()) {
      throw new Error("Invalid token");
    }

    const user = userResult.value;
    const userId = user.id;

    // Remove existing connection if any
    if (this.connections.has(userId)) {
      this.removeConnection(userId);
    }

    const channel = `user:${userId}`;
    const unsubscribe = this.eventBus.subscribe(channel, (event: GameEvent) => {
      this.sendEventToUser(userId, event);
    });

    this.connections.set(userId, {
      userId,
      controller,
      unsubscribe,
      lastHeartbeat: Date.now(),
      closed: false,
    });

    console.log(
      `SSE connection established for user ${userId} (total: ${this.connections.size})`
    );

    this.sendRaw(controller, ": connected\n\n");
  }

  async addConnectionByUserId(
    userId: number,
    controller: ReadableStreamDefaultController
  ): Promise<void> {
    // Remove existing connection if any
    if (this.connections.has(userId)) {
      this.removeConnection(userId);
    }

    // Subscribe to user's channel
    const channel = `user:${userId}`;
    const unsubscribe = this.eventBus.subscribe(channel, (event: GameEvent) => {
      this.sendEventToUser(userId, event);
    });

    // Store connection
    this.connections.set(userId, {
      userId,
      controller,
      unsubscribe,
      lastHeartbeat: Date.now(),
      closed: false,
    });

    console.log(
      `SSE connection established for user ${userId} (total: ${this.connections.size})`
    );

    this.sendRaw(controller, ": connected\n\n");
  }

  removeConnection(userId: number): void {
    const connection = this.connections.get(userId);

    if (!connection) {
      return;
    }

    // Unsubscribe from event bus
    connection.unsubscribe();

    // Close controller if not already closed
    if (!connection.closed) {
      try {
        if (connection.controller.desiredSize !== null) {
          connection.controller.close();
          connection.closed = true;
        } else {
          connection.closed = true;
        }
      } catch (error) {
        // Already closed, just mark it
        connection.closed = true;
      }
    }

    this.connections.delete(userId);
    console.log(
      `SSE connection removed for user ${userId} (remaining: ${this.connections.size})`
    );
  }

  sendEventToUser(userId: number, event: GameEvent): void {
    const connection = this.connections.get(userId);

    if (!connection || connection.closed) {
      return;
    }

    const message = `event: ${event}\ndata: ${event}\n\n`;
    const sent = this.sendRaw(connection.controller, message);

    if (!sent) {
      // Failed to send, mark as closed
      connection.closed = true;
    }
  }

  sendHeartbeat(userId: number): boolean {
    const connection = this.connections.get(userId);

    if (!connection || connection.closed) {
      return false;
    }

    const sent = this.sendRaw(connection.controller, ": heartbeat\n\n");

    if (sent) {
      connection.lastHeartbeat = Date.now();
      return true;
    } else {
      connection.closed = true;
      return false;
    }
  }

  private sendRaw(
    controller: ReadableStreamDefaultController,
    message: string
  ): boolean {
    try {
      // Check if controller is still open
      if (controller.desiredSize === null) {
        return false;
      }

      controller.enqueue(new TextEncoder().encode(message));
      return true;
    } catch (error) {
      // Connection closed or other error
      return false;
    }
  }

  getConnectionCount(): number {
    // Count only non-closed connections
    let count = 0;
    this.connections.forEach((conn) => {
      if (!conn.closed) {
        count++;
      }
    });
    return count;
  }

  isConnected(userId: number): boolean {
    const connection = this.connections.get(userId);
    return connection !== undefined && !connection.closed;
  }

  getConnectedUsers(): number[] {
    const users: number[] = [];
    this.connections.forEach((conn, userId) => {
      if (!conn.closed) {
        users.push(userId);
      }
    });
    return users;
  }

  closeAll(): void {
    console.log(`Closing all SSE connections (${this.connections.size} total)`);
    this.stopHeartbeat();

    const userIds = Array.from(this.connections.keys());
    userIds.forEach((userId) => {
      this.removeConnection(userId);
    });
  }
}

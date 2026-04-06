import type { GameEvent } from "../models";
import type { EventBus } from "./bus";

export class EventEmitter {
  constructor(private eventBus: EventBus) {}

  emitToUser(userId: number, event: GameEvent): void {
    const channel = `user:${userId}`;
    this.eventBus.publish(channel, event);
  }

  emitToUsers(userIds: number[], event: GameEvent): void {
    userIds.forEach((userId) => this.emitToUser(userId, event));
  }

  emitToUsersMap(eventMap: Map<number, GameEvent>): void {
    eventMap.forEach((event, userId) => {
      this.emitToUser(userId, event);
    });
  }
}

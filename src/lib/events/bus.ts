import type { GameEvent } from "../models";

type EventCallback = (event: GameEvent) => void;

export class EventBus {
  private subscribers: Map<string, Set<EventCallback>>;

  constructor() {
    this.subscribers = new Map();
  }

  subscribe(channel: string, callback: EventCallback): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }

    this.subscribers.get(channel)!.add(callback);

    return () => {
      const channelSubscribers = this.subscribers.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(callback);

        // Clean up empty channel
        if (channelSubscribers.size === 0) {
          this.subscribers.delete(channel);
        }
      }
    };
  }

  publish(channel: string, event: GameEvent): void {
    const channelSubscribers = this.subscribers.get(channel);

    if (channelSubscribers) {
      channelSubscribers.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(
            `Error executing callback for channel ${channel}:`,
            error
          );
        }
      });
    }
  }

  clear(): void {
    this.subscribers.clear();
  }
}

export const eventBus = new EventBus();

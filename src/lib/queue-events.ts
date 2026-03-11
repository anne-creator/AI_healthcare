import { EventEmitter } from "events";

const globalForQueue = globalThis as unknown as {
  queueEvents: EventEmitter | undefined;
};

export const queueEvents =
  globalForQueue.queueEvents ?? new EventEmitter();

queueEvents.setMaxListeners(50);

if (process.env.NODE_ENV !== "production")
  globalForQueue.queueEvents = queueEvents;

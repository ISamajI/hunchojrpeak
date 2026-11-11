// In-process event bus. Activity, jobs and notifications are published here
// and streamed to dashboards over Server-Sent Events.
import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();
bus.setMaxListeners(100);

export function emit(type, data) {
  bus.emit('event', { type, data, ts: new Date().toISOString() });
}

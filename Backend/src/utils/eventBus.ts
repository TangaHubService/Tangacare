import { EventEmitter } from 'events';

class EventBus extends EventEmitter {}

export const eventBus = new EventBus();

export enum EventTypes {
    NOTIFICATION_CREATED = 'notification:created',
    PO_UPDATED = 'po:updated',
}

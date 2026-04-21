import { EventEmitter } from 'events';

class MessageBus extends EventEmitter {}
export const MessageBroker = new MessageBus();
export const TOPICS = {
    ORDER_CREATED: 'ORDER_CREATED',
    ORDER_ACCEPTED: 'ORDER_ACCEPTED',
    ORDER_READY: 'ORDER_READY',
    ORDER_DELIVERED: 'ORDER_DELIVERED',
    ORDER_CANCELLED: 'ORDER_CANCELLED',
    ORDER_REJECTED: 'ORDER_REJECTED',
};

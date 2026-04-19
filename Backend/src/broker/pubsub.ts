import { EventEmitter } from 'events';

// Create a globally accessible In-Memory Message Broker
// This acts as the central bus for our Event-Driven Architecture
class MessageBus extends EventEmitter {}

export const MessageBroker = new MessageBus();

// Define our standard event topics
export const TOPICS = {
    ORDER_CREATED: 'ORDER_CREATED',
    ORDER_ACCEPTED: 'ORDER_ACCEPTED',
    ORDER_READY: 'ORDER_READY',
    ORDER_DELIVERED: 'ORDER_DELIVERED',
    ORDER_CANCELLED: 'ORDER_CANCELLED',
    ORDER_REJECTED: 'ORDER_REJECTED',
};

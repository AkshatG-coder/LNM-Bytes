// Single source of truth for all Kafka topic names and event types
// No magic strings anywhere else in the codebase

export const TOPICS = {
    ORDER_EVENTS:        "order.events",
    NOTIFICATION_EVENTS: "notification.events",
} as const;

export type OrderEventType =
    | "ORDER_CREATED"
    | "ORDER_ACCEPTED"
    | "ORDER_READY"
    | "ORDER_DELIVERED"
    | "ORDER_CANCELLED"
    | "ORDER_REJECTED";

export type NotificationEventType =
    | "PUSH_WEBSOCKET"
    | "SEND_EMAIL";

// Shape of a message on order.events
export interface OrderEvent {
    type: OrderEventType;
    orderId: string;
    storeId: string;
    userId: string;
    orderNumber?: number;
    paymentType?: string;
    userName?: string;
    totalAmount?: number;
    timestamp: string;
}

// Shape of a message on notification.events
export interface NotificationEvent {
    type: NotificationEventType;
    receiverId: string;         // userId or storeId depending on direction
    payload: Record<string, unknown>;
}

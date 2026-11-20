// Barrel export — single import for bootstrap
export { default as producer } from "./producer";
export { startOrderConsumer, stopOrderConsumer } from "./consumers/orderConsumer";
export { startNotificationConsumer, stopNotificationConsumer } from "./consumers/notificationConsumer";
export { TOPICS } from "./topics";
export type { OrderEvent, NotificationEvent, OrderEventType, NotificationEventType } from "./topics";

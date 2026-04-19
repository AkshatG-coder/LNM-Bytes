import { MessageBroker, TOPICS } from './pubsub';
import { sendNotification } from '../websockets/notify';
import logger from '../utils/logger';

/**
 * Initializes all background consumers/workers.
 * This file should be imported once in app.ts so the listeners attach.
 */
export const initConsumers = () => {

    // ── Worker: New Order Received
    MessageBroker.on(TOPICS.ORDER_CREATED, (data) => {
        logger.info(`[Consumer] Processing new order notification for store: ${data.storeId}`);
        sendNotification(data.storeId, {
            type: "newOrder",
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            message: `New order #${data.orderNumber} from ${data.userName}${data.paymentType === 'online' ? ' (PAID ONLINE)' : ''}!`,
            paymentType: data.paymentType,
        });
    });

    // ── Worker: Order Accepted / Preparing
    MessageBroker.on(TOPICS.ORDER_ACCEPTED, (data) => {
        logger.info(`[Consumer] Processing order accepted notification to user: ${data.userId}`);
        sendNotification(data.userId, {
            type: "orderPreparing",
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            message: `🍳 Order #${data.orderNumber} accepted and is now being prepared!`,
        });
    });

    // ── Worker: Order Ready (With QR Code)
    MessageBroker.on(TOPICS.ORDER_READY, (data) => {
        logger.info(`[Consumer] Processing order ready notification to user: ${data.userId}`);
        sendNotification(data.userId, {
            type: "orderReady",
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            message: `🛎️ Order #${data.orderNumber} is ready for pickup!`,
            qrCode: data.qrCode, 
        });
    });

    // ── Worker: Order Picked Up / Delivered
    MessageBroker.on(TOPICS.ORDER_DELIVERED, (data) => {
        logger.info(`[Consumer] Processing order delivered notification to user: ${data.userId}`);
        sendNotification(data.userId, {
            type: "orderDelivered",
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            message: `✅ Order #${data.orderNumber} picked up successfully!`,
        });
    });

    // ── Worker: Order Cancelled (By User)
    MessageBroker.on(TOPICS.ORDER_CANCELLED, (data) => {
        logger.info(`[Consumer] Processing order cancelled notification to user: ${data.userId}`);
        sendNotification(data.userId, {
            type: "orderCancelled",
            orderId: data.orderId,
            message: "Your order has been cancelled.",
        });
    });

    // ── Worker: Order Rejected (By Owner)
    MessageBroker.on(TOPICS.ORDER_REJECTED, (data) => {
        logger.info(`[Consumer] Processing order rejected notification to user: ${data.userId}`);
        sendNotification(data.userId, {
            type: "orderCancelled",
            orderId: data.orderId,
            message: data.isRefunded 
                ? "❌ Sorry, your order was rejected. A full refund has been initiated to your account."
                : "❌ Sorry, your order was rejected by the canteen.",
        });
    });

    logger.info("✅ Background Consumers (Pub/Sub) Initialized");
};

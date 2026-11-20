import kafka from "../client";
import { TOPICS, OrderEvent } from "../topics";
import logger from "../../utils/logger";

const consumer = kafka.consumer({ groupId: "order-events-group" });

export async function startOrderConsumer() {
    if (!process.env.KAFKA_BROKER) return;
    try {
        await consumer.connect();
        await consumer.subscribe({ topic: TOPICS.ORDER_EVENTS, fromBeginning: false });

        await consumer.run({
            eachMessage: async ({ message }) => {
                if (!message.value) return;

                let event: OrderEvent;
                try {
                    event = JSON.parse(message.value.toString());
                } catch {
                    logger.warn("Order consumer received invalid JSON — skipping");
                    return;
                }

                logger.info(
                    { type: event.type, orderId: event.orderId, orderNumber: event.orderNumber },
                    "Order event received"
                );

                // Audit log every state transition — helpful for debugging & analytics
                switch (event.type) {
                    case "ORDER_CREATED":
                        logger.info({ orderId: event.orderId, store: event.storeId }, "New order placed");
                        break;
                    case "ORDER_ACCEPTED":
                        logger.info({ orderId: event.orderId }, "Order moved to preparing");
                        break;
                    case "ORDER_READY":
                        logger.info({ orderId: event.orderId }, "Order ready for pickup");
                        break;
                    case "ORDER_DELIVERED":
                        logger.info({ orderId: event.orderId }, "Order delivered to student");
                        break;
                    case "ORDER_CANCELLED":
                        logger.info({ orderId: event.orderId }, "Order cancelled");
                        break;
                    case "ORDER_REJECTED":
                        logger.info({ orderId: event.orderId }, "Order rejected by owner");
                        break;
                }
            },
        });

        logger.info("Order consumer running");
    } catch (err) {
        logger.error({ err }, "Order consumer failed to start");
    }
}

export async function stopOrderConsumer() {
    await consumer.disconnect();
}

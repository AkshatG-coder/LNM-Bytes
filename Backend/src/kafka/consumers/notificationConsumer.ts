import kafka from "../client";
import { TOPICS, NotificationEvent } from "../topics";
import { sendNotification } from "../../websockets/notify";
import logger from "../../utils/logger";

const consumer = kafka.consumer({ groupId: "notification-events-group" });

export async function startNotificationConsumer() {
    if (!process.env.KAFKA_BROKER) return;
    try {
        await consumer.connect();
        await consumer.subscribe({ topic: TOPICS.NOTIFICATION_EVENTS, fromBeginning: false });

        await consumer.run({
            eachMessage: async ({ message }) => {
                if (!message.value) return;

                let event: NotificationEvent;
                try {
                    event = JSON.parse(message.value.toString());
                } catch {
                    logger.warn("Notification consumer received invalid JSON — skipping");
                    return;
                }

                switch (event.type) {
                    case "PUSH_WEBSOCKET":
                        // Forward to the existing WebSocket layer — zero refactor needed
                        sendNotification(event.receiverId, event.payload);
                        logger.info(
                            { receiverId: event.receiverId, wsType: event.payload.type },
                            "WebSocket notification dispatched via Kafka"
                        );
                        break;

                    case "SEND_EMAIL":
                        // Placeholder for email service integration
                        logger.info(
                            { receiverId: event.receiverId },
                            "Email event consumed (handler not wired yet)"
                        );
                        break;
                }
            },
        });

        logger.info("Notification consumer running");
    } catch (err) {
        logger.error({ err }, "Notification consumer failed to start");
    }
}

export async function stopNotificationConsumer() {
    await consumer.disconnect();
}

import { Producer } from "kafkajs";
import kafka from "./client";
import logger from "../utils/logger";
import { sendNotification } from "../websockets/notify";
import { TOPICS } from "./topics";

class KafkaProducer {
    private producer: Producer;
    private connected = false;

    constructor() {
        this.producer = kafka.producer({
            allowAutoTopicCreation: false,
        });
    }

    async connect() {
        if (this.connected) return;
        if (!process.env.KAFKA_BROKER) {
            logger.info("KAFKA_BROKER not set — using local in-memory event dispatch");
            return;
        }
        try {
            await this.producer.connect();
            this.connected = true;
            logger.info("Kafka producer connected successfully");
        } catch (err: any) {
            logger.warn(`Kafka producer connection failed: ${err.message || err}. Falling back to in-memory dispatch.`);
            this.connected = false;
        }
    }

    async publish(topic: string, message: object) {
        if (!this.connected) {
            // Graceful circuit-breaker fallback: execute locally
            this.handleLocalFallback(topic, message);
            return;
        }
        try {
            await this.producer.send({
                topic,
                messages: [{ value: JSON.stringify(message) }],
            });
            logger.info({ topic, type: (message as any).type }, "Kafka event published");
        } catch (err: any) {
            logger.warn({ err: err.message, topic }, "Kafka publish failed — falling back to local dispatch");
            this.handleLocalFallback(topic, message);
        }
    }

    private handleLocalFallback(topic: string, message: any) {
        if (topic === TOPICS.NOTIFICATION_EVENTS && message?.receiverId && message?.payload) {
            sendNotification(message.receiverId, message.payload);
            logger.info({ receiverId: message.receiverId }, "WebSocket notification dispatched via local fallback");
        }
    }

    async disconnect() {
        if (!this.connected) return;
        try {
            await this.producer.disconnect();
        } catch {}
        this.connected = false;
        logger.info("Kafka producer disconnected");
    }
}

// Singleton — one producer for the whole app lifetime
const producer = new KafkaProducer();
export default producer;

import { Producer } from "kafkajs";
import kafka from "./client";
import logger from "../utils/logger";

class KafkaProducer {
    private producer: Producer;
    private connected = false;

    constructor() {
        this.producer = kafka.producer({
            // Wait for leader + at least one replica to ack — avoids message loss
            allowAutoTopicCreation: false,
        });
    }

    async connect() {
        if (this.connected) return;
        try {
            await this.producer.connect();
            this.connected = true;
            logger.info("Kafka producer connected");
        } catch (err) {
            logger.error({ err }, "Kafka producer connection failed");
            // Don't crash the server — Kafka is non-critical vs DB
        }
    }

    async publish(topic: string, message: object) {
        if (!this.connected) {
            logger.warn({ topic }, "Kafka producer not connected — skipping publish");
            return;
        }
        try {
            await this.producer.send({
                topic,
                messages: [{ value: JSON.stringify(message) }],
            });
            logger.info({ topic, type: (message as any).type }, "Kafka event published");
        } catch (err) {
            logger.error({ err, topic, message }, "Kafka publish failed");
            // Fire-and-forget: don't throw, the HTTP response already went out
        }
    }

    async disconnect() {
        if (!this.connected) return;
        await this.producer.disconnect();
        this.connected = false;
        logger.info("Kafka producer disconnected");
    }
}

// Singleton — one producer for the whole app lifetime
const producer = new KafkaProducer();
export default producer;

import { Kafka } from "kafkajs";

const mechanism = (process.env.KAFKA_MECHANISM as any) || "plain";
const broker = process.env.KAFKA_BROKER || "localhost:9092";

// Single shared Kafka client — configured for Confluent Cloud (SASL/PLAIN + SSL)
const kafka = new Kafka({
    clientId: "lnm-bytes",
    brokers: [broker],
    sasl: process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD ? {
        mechanism,
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
    } : undefined,
    ssl: Boolean(process.env.KAFKA_USERNAME),
    // Retry on transient network blips — important on cloud Kafka
    retry: {
        initialRetryTime: 300,
        retries: 5,
    },
});

export default kafka;

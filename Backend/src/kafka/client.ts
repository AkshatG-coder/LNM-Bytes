import { Kafka } from "kafkajs";

// Single shared Kafka client — reused by producer and all consumers
const kafka = new Kafka({
    clientId: "lnm-bytes",
    brokers: [process.env.KAFKA_BROKER!],
    sasl: {
        mechanism: "scram-sha-256",
        username: process.env.KAFKA_USERNAME!,
        password: process.env.KAFKA_PASSWORD!,
    },
    ssl: true,
    // Retry on transient network blips — important on cloud Kafka
    retry: {
        initialRetryTime: 300,
        retries: 5,
    },
});

export default kafka;

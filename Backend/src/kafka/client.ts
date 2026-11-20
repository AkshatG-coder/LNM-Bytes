import { Kafka } from "kafkajs";

const mechanism = (process.env.KAFKA_MECHANISM as any) || "scram-sha-256";
const broker = process.env.KAFKA_BROKER || "localhost:9092";

// Single shared Kafka client — supports Aiven, Upstash & Confluent (SSL + SASL)
const kafka = new Kafka({
    clientId: "lnm-bytes",
    brokers: [broker],
    connectionTimeout: 4000,
    authenticationTimeout: 4000,
    sasl: process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD ? {
        mechanism,
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
    } : undefined,
    ssl: process.env.KAFKA_USERNAME ? { rejectUnauthorized: false } : undefined,
    // Fast failover to local fallback instead of freezing server
    retry: {
        initialRetryTime: 300,
        retries: 2,
    },
});

export default kafka;

import { configDotenv } from "dotenv";
configDotenv({ path: "./.env" });

import http from "http";
import { app } from "./app";
import { DbConnection } from "./Database_Connection/DbConnect";
import { initWebSocket } from "./websockets/websocket"
import { producer, startOrderConsumer, startNotificationConsumer } from "./kafka";

const Port = process.env.PORT || 8081;

const server = http.createServer(app);

const startServer = async () => {

  initWebSocket(server);

  // Connect Kafka producer + start consumers (non-blocking — server runs even if Kafka is down)
  await producer.connect();
  startOrderConsumer();
  startNotificationConsumer();

  server.listen(Port, () => {
    console.log(`🚀 Server running on http://localhost:${Port}`);
  });

};

DbConnection()
  .then(() => {
    startServer();
  })
  .catch(() => {
    console.log("Mongo DB Failed");
  });

// Graceful shutdown — flush Kafka before exiting
process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down gracefully");
  await producer.disconnect();
  process.exit(0);
});
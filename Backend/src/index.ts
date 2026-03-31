import { configDotenv } from "dotenv";
configDotenv({ path: "./.env" });

import http from "http";
import { app } from "./app";
import "./Crons/storeCrone";
import { DbConnection } from "./Database_Connection/DbConnect";
import { initWebSocket } from "./websockets/websocket"

const Port = process.env.PORT || 8081;

const server = http.createServer(app);

const startServer = async () => {

  initWebSocket(server);

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
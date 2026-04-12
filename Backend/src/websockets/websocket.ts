import { WebSocketServer, WebSocket } from "ws";

export const clients = new Map<string, any>();

export const initWebSocket = (server: any) => {
    const wss = new WebSocketServer({ server });

    // Global hearbeat interval prevents memory leaks
    const interval = setInterval(() => {
        wss.clients.forEach((ws: any) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on("close", () => {
        clearInterval(interval);
    });

    wss.on("connection", (ws: any) => {
        console.log("Client Connected");
        ws.isAlive = true;

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on("message", (mess: any) => {
            try {
                const data = JSON.parse(mess.toString());
                if (data.type === "register") {
                    ws.userId = data.userId;
                    clients.set(ws.userId, ws);
                    console.log("Registered", ws.userId);
                }
            } catch (err) {
                console.error("Invalid WS Payload");
            }
        });

        ws.on("close", () => {
            console.log("Client disconnected");
            if (ws.userId) clients.delete(ws.userId);
        });
    });
};
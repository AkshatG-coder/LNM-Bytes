import { WebSocketServer, WebSocket } from "ws";
import logger from "../utils/logger";

/**
 * Multi-socket client registry.
 * Maps userId → Set<WebSocket> so users with multiple tabs / devices
 * all receive notifications simultaneously.
 */
export const clients = new Map<string, Set<WebSocket>>();

export const initWebSocket = (server: any) => {
    const wss = new WebSocketServer({ server });

    // Heartbeat: terminate dead connections to free server memory
    const interval = setInterval(() => {
        wss.clients.forEach((ws: any) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30_000);

    wss.on("close", () => {
        clearInterval(interval);
    });

    wss.on("connection", (ws: any) => {
        ws.isAlive = true;

        ws.on("pong", () => {
            ws.isAlive = true;
        });

        ws.on("message", (mess: any) => {
            try {
                const data = JSON.parse(mess.toString());
                if (data.type === "register" && data.userId) {
                    ws.userId = data.userId;

                    // Add this socket to the user's set (supports multi-tab)
                    if (!clients.has(ws.userId)) {
                        clients.set(ws.userId, new Set());
                    }
                    clients.get(ws.userId)!.add(ws);

                    logger.info({ userId: ws.userId }, "WS client registered");
                }
            } catch {
                logger.warn("Invalid WS payload received");
            }
        });

        ws.on("close", () => {
            if (ws.userId) {
                const sockets = clients.get(ws.userId);
                if (sockets) {
                    sockets.delete(ws);
                    // Clean up the entry when the user has no open sockets
                    if (sockets.size === 0) {
                        clients.delete(ws.userId);
                    }
                }
                logger.info({ userId: ws.userId }, "WS client disconnected");
            }
        });
    });
};
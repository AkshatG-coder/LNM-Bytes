import { WebSocketServer, WebSocket } from "ws";
import logger from "../utils/logger";
import { roomFromToken, WS_AUTH_FAILED_CODE, WS_REGISTER_DEADLINE_MS } from "./wsAuth";

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

        // A connection that never signs in is not kept around
        const deadline = setTimeout(() => {
            if (!ws.userId) ws.close(WS_AUTH_FAILED_CODE, "register required");
        }, WS_REGISTER_DEADLINE_MS);
        ws.on("close", () => clearTimeout(deadline));

        ws.on("pong", () => {
            ws.isAlive = true;
        });

        ws.on("message", (mess: any) => {
            try {
                const data = JSON.parse(mess.toString());
                if (data.type === "register") {
                    // The room comes from the signed login token, never from what the client says
                    const room = roomFromToken(data.token, process.env.JWT_SECRET);
                    if (!room) {
                        logger.warn("WS register rejected");
                        ws.send(JSON.stringify({ type: "authFailed" }));
                        ws.close(WS_AUTH_FAILED_CODE, "invalid token");
                        return;
                    }
                    if (ws.userId && ws.userId !== room) {
                        clients.get(ws.userId)?.delete(ws);
                    }
                    ws.userId = room;

                    // Add this socket to the user's set (supports multi-tab)
                    if (!clients.has(ws.userId)) {
                        clients.set(ws.userId, new Set());
                    }
                    clients.get(ws.userId)!.add(ws);

                    ws.send(JSON.stringify({ type: "registered" }));
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
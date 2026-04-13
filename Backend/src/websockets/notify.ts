import { clients } from "./websocket";

/**
 * Send a JSON notification to ALL open sockets belonging to a user.
 * Handles multi-tab: iterates the Set<WebSocket> for the given receiverId.
 */
export const sendNotification = (receiverId: string, payload: any) => {
    const sockets = clients.get(receiverId);
    if (!sockets || sockets.size === 0) return;

    const message = JSON.stringify(payload);
    for (const socket of sockets) {
        if (socket.readyState === 1 /* OPEN */) {
            socket.send(message);
        }
    }
};
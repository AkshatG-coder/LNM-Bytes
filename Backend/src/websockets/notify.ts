import { clients } from "./websocket";
export const sendNotification=(receiverId: string, payload: any)=>{
    const socket=clients.get(receiverId)
    if(socket && socket.readyState==1){
        socket.send(JSON.stringify(payload))
    }
}
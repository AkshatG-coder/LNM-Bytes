import { WebSocketServer } from "ws";
export const clients=new Map<String,any>()
export const initWebSocket=(server:any)=>{
    const wss=new WebSocketServer({server})
    wss.on("connection",(ws)=>{
        console.log("Client Connected")
        ws.on("message",(mess)=>{
            const data=JSON.parse(mess.toString())
            if(data.type==="register"){
                clients.set(data.userId,ws);
                console.log("Registered",data.userId)
            }
        })
        setInterval(()=>{
            ws.send(JSON.stringify({
        type:"testNotification",
        message:"Backend notification working 🚀"
      }));
        },5000)
    })
    wss.on("close",()=>{
        console.log("Client disconnected")
    })
}
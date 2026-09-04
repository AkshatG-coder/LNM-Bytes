import mongoose from "mongoose";
import { configDotenv } from "dotenv";
import { OrderModel } from "../Models/Order_Schema.model";
import dns from "dns";

configDotenv({ path: "./.env" });

async function run() {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    dns.setDefaultResultOrder('ipv4first');

    const uri    = process.env.DB_CONNECTION_STRING!;
    const dbName = process.env.DB_NAME || "BTP_PROJECT_LNMIIT";

    try {
        await mongoose.connect(uri, {
            dbName,
            tls: true,
            family: 4,
        });
        console.log("Connected to MongoDB:", mongoose.connection.host);
        
        await mongoose.connection.db?.collection("orders").dropIndex("qrToken_1");
        console.log("Successfully dropped index qrToken_1");
    } catch (e: any) {
        console.log("Error or index doesn't exist:", e.message);
    } finally {
        await mongoose.disconnect();
    }
}
run();

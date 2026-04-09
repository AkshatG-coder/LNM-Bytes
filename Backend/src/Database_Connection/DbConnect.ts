import mongoose from "mongoose";
import dns from "dns";

export async function DbConnection() {
    // Override DNS to use Google (8.8.8.8) — fixes ESERVFAIL on networks
    // that block MongoDB Atlas SRV record lookups (common on college networks)
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    dns.setDefaultResultOrder('ipv4first');

    const uri    = process.env.DB_CONNECTION_STRING!;
    const dbName = process.env.DB_NAME || "BTP_PROJECT_LNMIIT";

    try {
        await mongoose.connect(uri, {
            dbName,
            tls: true,
            family: 4,    // force IPv4 — avoids SRV/IPv6 issues on some networks
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
        });
        console.log("✅ MongoDB connected:", mongoose.connection.host);
    } catch (err: any) {
        const msg = err?.message || String(err);
        console.error("❌ MongoDB connection failed:", msg);
        if (msg.includes("ESERVFAIL") || msg.includes("ENOTFOUND") || msg.includes("querySrv")) {
            console.error(
                "\n🔧 TIP: Your network's DNS can't resolve MongoDB Atlas SRV records.\n" +
                "   Go to MongoDB Atlas → Security → Network Access\n" +
                "   and add IP: 0.0.0.0/0 (allow all) OR add your current IP.\n"
            );
        }
        process.exit(1);
    }
}
import mongoose from "mongoose";

export async function DbConnection() {
    const uri    = process.env.DB_CONNECTION_STRING!;
    const dbName = process.env.DB_NAME || "BTP_PROJECT_LNMIIT";

    if (!uri) {
        console.error("❌  DB_CONNECTION_STRING is not set in .env");
        process.exit(1);
    }

    const MAX_RETRIES = 5;
    const RETRY_DELAY = 3000; // ms

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose.connect(uri, {
                dbName,
                serverSelectionTimeoutMS: 15000,
                socketTimeoutMS: 45000,
                family: 4,   // force IPv4 — fixes ESERVFAIL on some networks
            });
            console.log(`✅ MongoDB connected (attempt ${attempt}):`, mongoose.connection.host);
            return;
        } catch (err: any) {
            const msg = err?.message || String(err);
            console.error(`❌ MongoDB attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);

            // DNS / network hint
            if (msg.includes("ESERVFAIL") || msg.includes("ENOTFOUND") || msg.includes("querySrv")) {
                console.error(
                    "\n🔧 FIX: Go to MongoDB Atlas → Security → Network Access → Add IP Address\n" +
                    "        Either add your current IP or use 0.0.0.0/0 (allow all) for development.\n"
                );
            }

            if (attempt < MAX_RETRIES) {
                console.log(`⏳ Retrying in ${RETRY_DELAY / 1000}s...`);
                await new Promise(r => setTimeout(r, RETRY_DELAY));
            } else {
                process.exit(1);
            }
        }
    }
}
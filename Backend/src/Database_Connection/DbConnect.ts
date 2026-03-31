import mongoose from "mongoose";

export async function DbConnection() {
    try {
        const base = process.env.DB_CONNECTION_STRING || "";
        const dbName = process.env.DB_NAME || "";

        // Insert DB name before the '?' query params if they exist
        // e.g.  ...mongodb.net/?appName=... → ...mongodb.net/BTP_PROJECT_LNMIIT?appName=...
        const uri = base.includes("?")
            ? base.replace("?", `${dbName}?`)
            : `${base}/${dbName}`;

        const connectionResponse = await mongoose.connect(uri);
        console.log(
            "✅ Database connected:",
            connectionResponse.connection.host,
            "·",
            connectionResponse.connection.name
        );
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err);
        process.exit(1);
    }
}
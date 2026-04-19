import express from 'express'
import cors from 'cors'
import { generalLimiter } from './utils/limiter'
import helmet from 'helmet'
import compression from 'compression'
import { pinoHttp } from 'pino-http'
import logger from "./utils/logger"
import { Store_Router } from './Routers/Store_Router'
import { MenuItemRouter } from './Routers/Menu_Item_Router'
import { Auth_Router } from './Routers/Auth_Router'
import { Order_Router } from './Routers/Order_Router'
import { initConsumers } from './broker/consumers'

const app = express()

// Initialize background Pub/Sub workers
initConsumers()

// ─── Bulletproof CORS & Preflight Handler ───────────────────────────────────────
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Intercept OPTIONS method universally
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// ─── Security & Perf middleware ───────────────────────────────────────────────
app.use(helmet({ 
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" }
}))

app.use(compression())

// ─── Body parsing (Express 5 built-in, body-parser is deprecated) ─────────────
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use(generalLimiter)

// ─── Request logging ──────────────────────────────────────────────────────────
app.use(
    pinoHttp({
        logger,
        serializers: {
            req: () => undefined,  // skip request body logging to reduce noise
        },
        customLogLevel: (res, err) => {
            const code = res.statusCode ?? 200;
            if (err || code >= 500) return "error";
            if (code >= 400) return "warn";
            return "info";
        }
    })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/store_handler", Store_Router)
app.use("/menu_item", MenuItemRouter)
app.use("/auth", Auth_Router)   // OTP routes have per-route authLimiter inside Auth_Router
app.use("/order", Order_Router)

// ─── Global Error Handler (must be last middleware) ───────────────────────────
app.use((
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    // Mongoose CastError → invalid ObjectId → treat as 400 Bad Request
    if (err.name === "CastError" && err.kind === "ObjectId") {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
    }
    if (err.message?.startsWith("CORS blocked")) {
        return res.status(403).json({ success: false, message: err.message });
    }
    const statusCode = err.statusCode || 500;
    const message    = err.message || "Internal Server Error";
    req.log?.error({ err, body: req.body }, "Unhandled error");
    res.status(statusCode).json({ success: false, status: statusCode, message });
});

export { app }

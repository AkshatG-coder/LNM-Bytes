import { rateLimit } from "express-rate-limit"

/**
 * General rate limiter — applied to all routes.
 * 500 requests per 15 minutes per IP.
 */
export const generalLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    limit:           500,
    message:         "Too many requests. Please slow down and try again later.",
    statusCode:      429,
    standardHeaders: 'draft-8',
    legacyHeaders:   false,
    ipv6Subnet:      56,
})

/**
 * Auth rate limiter — applied only to /auth/* routes.
 * Prevents OTP / login brute-forcing (20 req / 15 min per IP).
 */
export const authLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    limit:           20,
    message:         "Too many authentication attempts. Please wait 15 minutes and try again.",
    statusCode:      429,
    standardHeaders: 'draft-8',
    legacyHeaders:   false,
    ipv6Subnet:      56,
})

/** @deprecated — use generalLimiter. Kept for backward-compat if imported elsewhere. */
export const limiter = generalLimiter
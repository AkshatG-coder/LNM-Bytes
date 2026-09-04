import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Middleware to protect routes that require a logged-in student user.
 * Expects:  Authorization: Bearer <token>
 * On success: attaches decoded payload to req.user and calls next().
 */
export const verifyUserToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authentication required. Please sign in." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        (req as any).user = decoded; // { userId, email, role }
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Session expired. Please sign in again." });
    }
};

/**
 * Middleware to protect routes that require a logged-in owner.
 * Same structure — owner JWTs contain { ownerId, storeId, role, isApproved }.
 */
export const verifyOwnerToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Owner authentication required." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        if (decoded.role !== "owner" && decoded.role !== "superadmin") {
            return res.status(403).json({ success: false, message: "Access denied — owner account required." });
        }
        (req as any).owner = decoded; // { ownerId, storeId, role, isApproved }
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Session expired. Please sign in again." });
    }
};

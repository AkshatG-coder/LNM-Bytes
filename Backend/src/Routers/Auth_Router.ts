import { Router } from "express";
import { RegisterOwner, LoginOwner, GetMe } from "../Controller/Auth_Controller";

const AuthRouter = Router();

AuthRouter.post("/register", RegisterOwner);   // Register new owner (linked to existing storeId)
AuthRouter.post("/login", LoginOwner);          // Login → returns JWT + storeId
AuthRouter.get("/me", GetMe);                   // Validate token + return owner + store

export { AuthRouter };

import { Router } from "express";
import { BotChat, GetPreferences, SavePreferences } from "../Controller/BiteBot_Controller";
import { verifyUserToken } from "../middleware/verifyToken";

const BiteBot_Router = Router();

// Student must be authenticated — the JWT carries userId
BiteBot_Router.post("/chat", verifyUserToken, BotChat);
BiteBot_Router.get("/preferences", verifyUserToken, GetPreferences);
BiteBot_Router.put("/preferences", verifyUserToken, SavePreferences);

export { BiteBot_Router };

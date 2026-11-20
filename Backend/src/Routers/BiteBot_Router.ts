import { Router } from "express";
import { BotChat } from "../Controller/BiteBot_Controller";
import { verifyUserToken } from "../middleware/verifyToken";

const BiteBot_Router = Router();

// Student must be authenticated — the JWT carries userId
BiteBot_Router.post("/chat", verifyUserToken, BotChat);

export { BiteBot_Router };

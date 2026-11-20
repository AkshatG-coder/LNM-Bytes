import { Router } from "express";
import { CopilotChat } from "../Controller/Copilot_Controller";
import { verifyOwnerToken } from "../middleware/verifyToken";

const Copilot_Router = Router();

// Owner must be authenticated — the JWT carries storeId
Copilot_Router.post("/chat", verifyOwnerToken, CopilotChat);

export { Copilot_Router };

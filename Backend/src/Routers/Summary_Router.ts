import { Router } from "express";
import { verifyOwnerToken } from "../middleware/verifyToken";
import { GetSummarySettings, SaveSummarySettings, SendSummaryNow, RunDueSummaries } from "../Controller/Summary_Controller";

const Summary_Router = Router();

Summary_Router.get("/settings", verifyOwnerToken, GetSummarySettings);
Summary_Router.put("/settings", verifyOwnerToken, SaveSummarySettings);
Summary_Router.post("/send-now", verifyOwnerToken, SendSummaryNow);
Summary_Router.post("/run", RunDueSummaries); // secret header, no login

export { Summary_Router };

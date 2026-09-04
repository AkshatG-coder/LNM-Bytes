import { Router } from "express";
import { Create_Store,GetOnlineStores,GetStoreById,Get_All_Store,DeleteStore,ToggleStoreStatus,Update_Store} from "../Controller/Store_Controller";
import { verifyOwnerToken } from "../middleware/verifyToken";

const Store_Router=Router();

Store_Router.post("/", verifyOwnerToken, Create_Store);
Store_Router.get("/online",GetOnlineStores)
Store_Router.get("/", Get_All_Store);
Store_Router.get("/:id", GetStoreById);
Store_Router.put("/:id", verifyOwnerToken, Update_Store);
Store_Router.delete("/:id", verifyOwnerToken, DeleteStore);
Store_Router.patch("/:id/status", verifyOwnerToken, ToggleStoreStatus);

export {Store_Router}
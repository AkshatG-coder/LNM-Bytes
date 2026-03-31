import { Router } from "express";
import { Create_Store,GetOnlineStores,GetStoreById,Get_All_Store,DeleteStore,ToggleStoreStatus,Update_Store} from "../Controller/Store_Controller";
const Store_Router=Router();
Store_Router.post("/", Create_Store);
Store_Router.get("/online",GetOnlineStores)
Store_Router.get("/", Get_All_Store);
Store_Router.get("/:id", GetStoreById);
Store_Router.put("/:id", Update_Store);
Store_Router.delete("/:id", DeleteStore);
Store_Router.patch("/:id/status",ToggleStoreStatus);
export {Store_Router}
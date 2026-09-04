import { Router } from "express";
import {getAllMenuItems,getMenuItemsById,getMenuItemsByStore,updateMenuItem,deleteMenuItem,add_Menu_Item} from "../Controller/Menu_Item_Controller"
import { verifyOwnerToken } from "../middleware/verifyToken";

const MenuItemRouter=Router()

MenuItemRouter.post("/create/:Store_Id", verifyOwnerToken, add_Menu_Item);
MenuItemRouter.get("/all",getAllMenuItems)
MenuItemRouter.get("/Menu/:Item_Id",getMenuItemsById)
MenuItemRouter.get("/store/:StoreId",getMenuItemsByStore)
MenuItemRouter.patch("/upd/:Item_Id", verifyOwnerToken, updateMenuItem);
MenuItemRouter.delete("/del/:Item_Id", verifyOwnerToken, deleteMenuItem);

export {MenuItemRouter}
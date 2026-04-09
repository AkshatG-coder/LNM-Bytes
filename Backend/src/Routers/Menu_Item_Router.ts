import { Router } from "express";
import {getAllMenuItems,getMenuItemsById,getMenuItemsByStore,updateMenuItem,deleteMenuItem,add_Menu_Item} from "../Controller/Menu_Item_Controller"
const MenuItemRouter=Router()
MenuItemRouter.post("/create",add_Menu_Item)
MenuItemRouter.get("/all",getAllMenuItems)
MenuItemRouter.get("/Menu/:Item_Id",getMenuItemsById)
MenuItemRouter.get("/store/:StoreId",getMenuItemsByStore)
MenuItemRouter.patch("/upd/:Item_Id",updateMenuItem)
MenuItemRouter.delete("/del/:Item_Id",deleteMenuItem)
export {MenuItemRouter}
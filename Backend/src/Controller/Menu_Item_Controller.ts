import { MenuItemModel } from "../Models/Menu_Item.model";
import asyncHandler from "../utils/AsyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

const getAllMenuItems=asyncHandler(async(req,res)=>{
    const menu_details=await MenuItemModel.find({})
    if(!menu_details){
        return res.json(new ApiError("Error in fetching details",500))
    }
    return res.json(new ApiResponse(200,true,"Successfully Fetched the menu details",menu_details))
})

const getMenuItemsByStore=asyncHandler(async(req,res)=>{
    const {StoreId}=req.params
    if(!StoreId){
        return res.json(new ApiError("StoreId is missing",404));
    }
    const menu_details=await MenuItemModel.find({storeId:StoreId})
    if(!menu_details){
        return res.json(new ApiError("Error in fetching details",500))
    }
    return res.json(new ApiResponse(200,true,"Successfully Fetched the menu details",menu_details))
})

const getMenuItemsById=asyncHandler(async(req,res)=>{
    const {Item_Id}=req.params
    if(!Item_Id){
        return res.json(new ApiError("ItemId is missing",404))
    }
    const Item_Details=await MenuItemModel.findById(Item_Id);
    if(!Item_Details){
        return res.json(new ApiError("Error in fetching details",500))
    }
    return res.json(new ApiResponse(200,true,"Successfully Fetched Item details",Item_Details))
})

const updateMenuItem=asyncHandler(async(req,res)=>{
    const {Item_Id}=req.params
    if(!Item_Id){
        return res.json(new ApiError("ItemId is missing",404))
    }
    const update_item=await MenuItemModel.findByIdAndUpdate(Item_Id,req.body,{new :true})
    if(!update_item){
        return res.json(new ApiError("Error while updating the item",500))
    }
    return res.json(new ApiResponse(200,true,"Menu_Item details updated successfully",update_item))
})

const deleteMenuItem=asyncHandler(async(req,res)=>{
    const {Item_Id}=req.params
    if(!Item_Id){
        return res.json(new ApiError("ItemId is missing",404))
    }
    const menu_item=await MenuItemModel.findByIdAndDelete(Item_Id)
    return res.json(new ApiResponse(200,true,"Successfully Deleted Menu_Item",{}))
})

const add_Menu_Item=asyncHandler(async(req,res)=>{
    const {Store_Id}=req.params
    if(!Store_Id){
        return res.json(new ApiError("Store_Id is missing",404))
    }
    const {name, price, category, isVeg, isAvailable} = req.body;
    // image logic yet to be added
    const item_detail = await MenuItemModel.create({
        name,
        price,
        category,
        isVeg,
        isAvailable: isAvailable ?? true,
        storeId: Store_Id
    })
    if(!item_detail){
        return res.json(new ApiError("error in adding items",500));
    }
    return res.json(new ApiResponse(200,true,"Menu Item added successfully",item_detail))
})

export {getAllMenuItems,getMenuItemsById,getMenuItemsByStore,updateMenuItem,deleteMenuItem,add_Menu_Item}

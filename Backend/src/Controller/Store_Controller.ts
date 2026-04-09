import asyncHandler from "../utils/AsyncHandler";
import { Store } from "../Models/Store.model";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
const Create_Store=asyncHandler(async(req,res)=>{
     const store = await Store.create(req.body);
     if(!store){
        return res.json(new ApiError("Error in creating Store",404));
     }
     return res.json(new ApiResponse(200,true,"Store Created Successfully",store));
})

const Update_Store=asyncHandler(async(req,res)=>{
     const store = await Store.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    return res.json(new ApiResponse(200,true,"Store Details Updated Successfully",{}));
})

const Get_All_Store=asyncHandler(async(req,res)=>{
    // Only show stores approved by super admin (isActive: true)
    const store_detail=await Store.find({ isActive: true });
    if(!store_detail){
        return res.json(new ApiError("Some Error while fetching details",500));
    }
    return res.json(new ApiResponse(200,true,"Details fetched Successfully",store_detail));
})


const GetStoreById=asyncHandler(async(req,res)=>{
    const {Id}=req.params;
    if(!Id){
        return res.json(new ApiError("StoreId is Missing",400));
    }
    const store_detail=await Store.findById(Id);
    if(!store_detail){
         return res.json(new ApiError("Some Error while fetching details",500));
    }
    return res.json(new ApiResponse(200,true,"Details fetched Successfully",store_detail));
})

const DeleteStore=asyncHandler(async(req,res)=>{
    const {Id}=req.params;
    if(!Id){
        return res.json(new ApiError("StoreId is Missing",400));
    }
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    return res.json(new ApiResponse(200,true,"Store Deleted Successfully",{}));
})
const ToggleStoreStatus=asyncHandler(async(req,res)=>{
    const {Id}=req.params;
    if(!Id){
        return res.json(new ApiError("StoreId is Missing",400));
    }
    const store=await Store.findById(Id);
    if(!store){
        return res.json(new ApiError("Store not found",404));
    }
    store.status=store?.status==="open" ? "closed" :"open";
    await store?.save();
    return res.json(new ApiResponse(200,true,"Store status updated",{}));
})
const GetOnlineStores=asyncHandler(async(req,res)=>{
    const stores=await Store.find({
        isActive:true,
        isOnlineOrderAvailable:true,
        nightDelivery:true,
        status:"open"
    })
    if(!stores){
        return res.json(new ApiError("Some Error in Fetching Details",404));
    }
    return res.json(new ApiResponse(200,true,"Details Fetched Successfully",stores));
})
export {Create_Store,Update_Store,Get_All_Store,GetStoreById,DeleteStore,ToggleStoreStatus,GetOnlineStores}
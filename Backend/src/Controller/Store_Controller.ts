import asyncHandler from "../utils/AsyncHandler";
import { Store } from "../Models/Store.model";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

const Create_Store = asyncHandler(async (req, res) => {
  const store = await Store.create(req.body);
  if (!store) {
    return res.json(new ApiError("Error in creating Store", 404));
  }
  return res.json(new ApiResponse(200, true, "Store Created Successfully", store));
});

const Update_Store = asyncHandler(async (req, res) => {
  // Router registers /:id — use lowercase
  const { id } = req.params;
  if (!id) {
    return res.json(new ApiError("StoreId is missing", 400));
  }

  const storeToUpdate = await Store.findById(id);
  if (!storeToUpdate) {
    return res.json(new ApiError("Store not found", 404));
  }

  // Enforce rule: cannot enable delivery/online orders if shop is closed
  if (storeToUpdate.status === "closed") {
    if (req.body.nightDelivery === true) {
       return res.json(new ApiError("Cannot enable Night Delivery when shop is closed", 400));
    }
    if (req.body.isOnlineOrderAvailable === true) {
       return res.json(new ApiError("Cannot enable Online Orders when shop is closed", 400));
    }
  }

  const store = await Store.findByIdAndUpdate(id, req.body, { new: true });
  if (!store) {
    return res.json(new ApiError("Store not found", 404));
  }
  return res.json(new ApiResponse(200, true, "Store Details Updated Successfully", store));
});

const Get_All_Store = asyncHandler(async (req, res) => {
  const store_detail = await Store.find({});
  if (!store_detail) {
    return res.json(new ApiError("Some Error while fetching details", 500));
  }
  return res.json(new ApiResponse(200, true, "Details fetched Successfully", store_detail));
});

const GetStoreById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.json(new ApiError("StoreId is Missing", 400));
  }
  const store_detail = await Store.findById(id);
  if (!store_detail) {
    return res.json(new ApiError("Store not found", 404));
  }
  return res.json(new ApiResponse(200, true, "Details fetched Successfully", store_detail));
});

const DeleteStore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.json(new ApiError("StoreId is Missing", 400));
  }
  const store = await Store.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!store) {
    return res.json(new ApiError("Store not found", 404));
  }
  return res.json(new ApiResponse(200, true, "Store Deleted Successfully", {}));
});

const ToggleStoreStatus = asyncHandler(async (req, res) => {
  // Router registers /:id/status — use lowercase
  const { id } = req.params;
  if (!id) {
    return res.json(new ApiError("StoreId is Missing", 400));
  }
  const store = await Store.findById(id);
  if (!store) {
    return res.json(new ApiError("Store not found", 404));
  }

  if (store.status === "open") {
    store.status = "closed";
    store.nightDelivery = false;
    store.isOnlineOrderAvailable = false;
  } else {
    store.status = "open";
  }

  await store.save();
  return res.json(new ApiResponse(200, true, `Shop is now ${store.status}`, { status: store.status }));
});

const GetOnlineStores = asyncHandler(async (req, res) => {
  const stores = await Store.find({
    isActive: true,
    isOnlineOrderAvailable: true,
    status: "open"
  });
  if (!stores) {
    return res.json(new ApiError("Some Error in Fetching Details", 404));
  }
  return res.json(new ApiResponse(200, true, "Details Fetched Successfully", stores));
});

export { Create_Store, Update_Store, Get_All_Store, GetStoreById, DeleteStore, ToggleStoreStatus, GetOnlineStores };
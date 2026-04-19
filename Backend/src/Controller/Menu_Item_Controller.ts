import asyncHandler from "../utils/AsyncHandler";
import { MenuItemModel } from "../Models/Menu_Item.model";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import appCache from "../utils/cache";

const getAllMenuItems = asyncHandler(async (req, res) => {
    const menu_details = await MenuItemModel.find({}).lean();
    return res.json(new ApiResponse(200, true, "Successfully Fetched the menu details", menu_details));
});


const getMenuItemsByStore = asyncHandler(async (req, res) => {
    const { StoreId } = req.params;
    if (!StoreId) return res.json(new ApiError("StoreId is missing", 404));

    // 1. Check Cache
    const cacheKey = `menu_${StoreId}`;
    if (appCache.has(cacheKey)) {
        return res.json(new ApiResponse(200, true, "Successfully Fetched the menu details (Cache Hit! ⚡)", appCache.get(cacheKey)));
    }

    // 2. Cache Miss: Query Database
    // .lean() — read-only, returns plain JS objects (2-3x faster than full Mongoose doc)
    const menu_details = await MenuItemModel.find({ storeId: StoreId }).lean();
    
    // 3. Save to Cache
    appCache.set(cacheKey, menu_details);

    return res.json(new ApiResponse(200, true, "Successfully Fetched the menu details", menu_details));
});


const getMenuItemsById = asyncHandler(async (req, res) => {
    const { Item_Id } = req.params;
    if (!Item_Id) return res.json(new ApiError("ItemId is missing", 404));
    const Item_Details = await MenuItemModel.findById(Item_Id).lean();
    if (!Item_Details) return res.json(new ApiError("Item not found", 404));
    return res.json(new ApiResponse(200, true, "Successfully Fetched Item details", Item_Details));
});



const updateMenuItem = asyncHandler(async (req, res) => {
    const { Item_Id } = req.params;
    if (!Item_Id) return res.json(new ApiError("ItemId is missing", 404));
    const update_item = await MenuItemModel.findByIdAndUpdate(Item_Id, req.body, { new: true });
    if (!update_item) return res.json(new ApiError("Error while updating the item", 500));
    
    // Flush the cache so students see the new price/details instantly
    appCache.del(`menu_${update_item.storeId}`);

    return res.json(new ApiResponse(200, true, "Menu_Item details updated successfully", update_item));
});

const deleteMenuItem = asyncHandler(async (req, res) => {
    const { Item_Id } = req.params;
    if (!Item_Id) return res.json(new ApiError("ItemId is missing", 404));

    const deleted_item = await MenuItemModel.findByIdAndDelete(Item_Id);
    if (deleted_item) {
        // Flush the cache so the deleted item vanishes instantly for students
        appCache.del(`menu_${deleted_item.storeId}`);
    }

    return res.json(new ApiResponse(200, true, "Successfully Deleted Menu_Item", {}));
});

const add_Menu_Item = asyncHandler(async (req, res) => {
    const { Store_Id } = req.params;
    if (!Store_Id) return res.json(new ApiError("Store_Id is missing", 404));

    const { name, price, category, isVeg, isAvailable, hasHalf, halfPrice } = req.body;

    const item_detail = await MenuItemModel.create({
        name,
        price,
        category,
        isVeg,
        isAvailable: isAvailable ?? true,
        storeId: Store_Id,
        hasHalf: hasHalf ?? false,
        halfPrice: hasHalf && halfPrice ? halfPrice : null,
    });

    if (!item_detail) return res.json(new ApiError("error in adding items", 500));

    // Flush cache so the new item appears instantly
    appCache.del(`menu_${Store_Id}`);

    return res.json(new ApiResponse(201, true, "Menu item added successfully", item_detail));
});

export { getAllMenuItems, getMenuItemsById, getMenuItemsByStore, updateMenuItem, deleteMenuItem, add_Menu_Item };
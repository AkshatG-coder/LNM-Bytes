// ─── Must match the backend Order_Schema.model.ts status enum exactly ────────
export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type UserData = {
  userId: string;        // order _id (used as key + action handler arg)
  userName: string;
  userEmail: string;
  userPhone: string | null;
  paymentType: 'online' | 'cash';
  paymentStatus: 'pending' | 'paid' | 'failed';
  status: OrderStatus;
  orders: OrderItem[];
  totalAmount?: number;
  createdAt?: string;
};

export type OrderItem = {
  id: string;
  itemName: string;
  quantity: number;
  price: number;
  portionSize: 'full' | 'half';
};

export type MenuCategory = 'snacks' | 'drinks' | 'meals' | 'dessert' | 'other';

export type MenuItem = {
  _id: string;
  name: string;
  price: number;      // full price
  halfPrice?: number | null;
  hasHalf?: boolean;
  category: MenuCategory;
  isVeg: boolean;
  isAvailable: boolean;
  storeId: string;
  image?: string;
  rating?: number;
};

export type OperationTime = {
  openTime: string;
  closeTime: string;
};

export type Store = {
  _id: string;
  name: string;
  description: string;
  phone: string;
  ownerName: string;
  status: 'open' | 'closed';
  location: string;
  operationTime: OperationTime;
  nightDelivery: boolean;
  foodType: 'veg' | 'non-veg' | 'both';
  isOnlineOrderAvailable: boolean;
  isActive: boolean;
};

// ─── For Super Admin Panel ────────────────────────────────────────────────────
export type OwnerRecord = {
  _id: string;
  name: string;
  email: string;
  role: 'owner' | 'superadmin';
  isApproved: boolean;
  storeId: {
    _id: string;
    name: string;
    status: string;
    location: string;
  } | null;
  createdAt: string;
};

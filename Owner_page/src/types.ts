// ─── Must match the backend Order_Schema.model.ts status enum exactly ────────
export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type UserData = {
  userId: string;
  userName: string;
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
};

export type MenuCategory = 'snacks' | 'drinks' | 'meals' | 'dessert' | 'other';

export type MenuItem = {
  _id: string;
  name: string;
  price: number;
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


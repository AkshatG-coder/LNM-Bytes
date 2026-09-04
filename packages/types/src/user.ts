import type { OrderItem, OrderStatus, PaymentStatus, PaymentType } from './order.js';

export interface UserData {
  userId: string;
  orderNumber?: number;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  paymentType: PaymentType;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  orders: OrderItem[];
  totalAmount?: number;
  createdAt?: string;
}

export interface OwnerRecord {
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
}

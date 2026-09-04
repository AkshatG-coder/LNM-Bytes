export type OrderStatus =
  | 'payment_pending'
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type PaymentType = 'online' | 'cash';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type PortionSize = 'full' | 'half';

export interface OrderItem {
  id?: string;
  menuItemId?: string;
  itemName: string;
  name?: string;
  quantity: number;
  price: number;
  portionSize: PortionSize;
}

export interface OperationTime {
  openTime: string;
  closeTime: string;
}

export interface Store {
  _id: string;
  id?: string;
  name: string;
  description: string;
  phone?: string;
  ownerName?: string;
  status: 'open' | 'closed';
  location: string;
  operationTime: OperationTime;
  nightDelivery: boolean;
  nightDeliveryCharge?: number;
  foodType: 'veg' | 'non-veg' | 'both';
  isOnlineOrderAvailable?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

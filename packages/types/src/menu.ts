export type MenuCategory = 'snacks' | 'drinks' | 'meals' | 'dessert' | 'other';

export interface MenuItem {
  _id: string;
  name: string;
  price: number;
  halfPrice?: number | null;
  hasHalf?: boolean;
  category: MenuCategory;
  isVeg: boolean;
  isAvailable: boolean;
  storeId: string;
  image?: string;
  rating?: number;
  storeStatus?: string;
  isOnlineOrderAvailable?: boolean;
  item_name?: string;
  photo?: string;
}

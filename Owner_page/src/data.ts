import {type UserData } from "./types";
export const initialData: UserData[] = [
  {
    userId: 101,
    userName: "User One",
    status: 'pending',
    orders: [
      { id: 1, itemName: "Veg Burger", quantity: 2, price: 120 },
      { id: 2, itemName: "Chicken Burger", quantity: 1, price: 180 },
    ]
  },
  {
    userId: 102,
    userName: "User Two",
    status: 'pending',
    orders: [
      { id: 3, itemName: "Paneer Pizza", quantity: 1, price: 250 },
      { id: 5, itemName: "Veg Fried Rice", quantity: 2, price: 150 }
    ]
  },
  {
    userId: 103,
    userName: "User Three",
    status: 'pending',
    orders: [
      { id: 4, itemName: "Chicken Pizza", quantity: 1, price: 320 }
    ]
  }
];
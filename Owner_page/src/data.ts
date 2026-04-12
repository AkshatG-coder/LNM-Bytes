import {type UserData } from "./types";
export const initialData: UserData[] = [
  {
    userId: "101",
    userName: "User One",
    userEmail: 'student1@lnmiit.ac.in',
    userPhone: '9876543210',
    paymentType: 'cash',
    paymentStatus: 'pending',
    status: 'pending',
    orders: [
      { id: "1", itemName: "Veg Burger", quantity: 2, price: 120, portionSize: 'full' },
      { id: "2", itemName: "Chicken Burger", quantity: 1, price: 180, portionSize: 'full' },
    ]
  },
  {
    userId: "102",
    userName: "User Two",
    userEmail: 'student2@lnmiit.ac.in',
    userPhone: '9876543210',
    paymentType: 'online',
    paymentStatus: 'paid',
    status: 'pending',
    orders: [
      { id: "3", itemName: "Paneer Pizza", quantity: 1, price: 250, portionSize: 'full' },
      { id: "5", itemName: "Veg Fried Rice", quantity: 2, price: 150, portionSize: 'full' }
    ]
  },
  {
    userId: "103",
    userName: "User Three",
    userEmail: 'student3@lnmiit.ac.in',
    userPhone: '9876543210',
    paymentType: 'online',
    paymentStatus: 'pending',
    status: 'pending',
    orders: [
      { id: "4", itemName: "Chicken Pizza", quantity: 1, price: 320, portionSize: 'full' }
    ]
  }
];

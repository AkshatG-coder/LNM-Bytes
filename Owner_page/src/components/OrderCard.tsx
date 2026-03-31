import React from 'react';

type OrderCardProps = {
  id: number;
  itemName: string;
  quantity: number;
  price: number;
};

const OrderCard = ({ id, itemName, quantity, price }: OrderCardProps) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-gray-800">{itemName}</h4>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">#{id}</span>
      </div>
      
      <div className="text-sm text-gray-600 flex justify-between mb-3">
        <span>₹{price} x {quantity}</span>
      </div>

      <div className="border-t border-gray-100 pt-2 flex justify-between items-center text-green-700 font-bold">
        <span className="text-sm text-gray-500 font-normal">Total</span>
        <span>₹{price * quantity}</span>
      </div>
    </div>
  );
};

export default OrderCard;
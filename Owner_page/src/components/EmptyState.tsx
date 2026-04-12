

const EmptyState = ({ message = "No orders in this category" }) => {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed animate-fade-in">
            <div className="text-4xl mb-4 grayscale opacity-50">🍽️</div>
            <h3 className="text-lg font-bold text-gray-400">{message}</h3>
            <p className="text-sm text-gray-500 mt-1">Wait for new updates to arrive!</p>
        </div>
    );
};

export default EmptyState;
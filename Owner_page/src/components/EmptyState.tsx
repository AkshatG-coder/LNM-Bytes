

const EmptyState = ({ message = "No orders in this category" }) => {
    return (
        <div
          className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border-2 border-dashed animate-fade-in"
          style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
        >
            <div className="text-4xl mb-4 grayscale opacity-50">🍽️</div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-muted)' }}>{message}</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>Wait for new updates to arrive!</p>
        </div>
    );
};

export default EmptyState;
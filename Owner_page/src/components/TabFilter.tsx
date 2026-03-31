
interface TabButtonProps {
    label: string;
    count?: number;
    active: boolean;
    onClick: () => void;
}

const TabButton = ({ label, count = 0, active, onClick }: TabButtonProps) => (
    <button 
        onClick={onClick}
        className={`relative pb-3 text-sm font-medium transition-colors whitespace-nowrap px-1 ${active ? 'text-[#fc8019]' : 'text-gray-500 hover:text-gray-300'}`}
    >
        {label}
        {count > 0 && (
            <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded-full ${active ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-800 text-gray-400'}`}>
                {count}
            </span>
        )}
        {/* Animated Underline */}
        {active && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#fc8019] rounded-t-full shadow-[0_-2px_6px_rgba(252,128,25,0.4)] animate-fade-in"></div>
        )}
    </button>
);

export default TabButton;
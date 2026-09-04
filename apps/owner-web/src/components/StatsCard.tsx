interface StatsCardProps {
    title: string;
    value: string | number;
    icon: string;
    color: string; // Tailwind text color class (e.g., 'text-orange-400')
    bg: string;    // Tailwind bg color class
    borderColor: string;
}

export const StatsCard = ({ title, value, icon, color, bg, borderColor }: StatsCardProps) => {
    return (
        <div className={`p-5 rounded-2xl border ${borderColor} ${bg} backdrop-blur-sm transition-transform hover:scale-[1.02]`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                    <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
                </div>
                <div className="p-2 rounded-lg text-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5">{icon}</div>
            </div>
        </div>
    );
};

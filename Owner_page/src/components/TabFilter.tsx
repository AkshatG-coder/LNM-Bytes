interface TabButtonProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

const TabButton = ({ label, count = 0, active, onClick }: TabButtonProps) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-bold whitespace-nowrap border ${
      active ? 'bg-primary text-on-primary border-transparent' : 'hover:bg-surface-2'
    }`}
    style={active ? undefined : { borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }}
  >
    {label}
    <span
      className={`min-w-5 px-1.5 py-0.5 text-[11px] leading-none rounded-full tnum text-center ${
        active ? 'bg-[#121B2E] text-white' : count > 0 ? 'bg-surface-2' : 'opacity-50'
      }`}
    >
      {count}
    </span>
  </button>
);

export default TabButton;

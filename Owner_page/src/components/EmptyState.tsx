import { Receipt } from 'lucide-react';

const EmptyState = ({ message = 'No orders here', hint = 'New orders appear on their own, no need to refresh.' }: { message?: string; hint?: string }) => (
  <div
    className="flex flex-col items-center justify-center py-16 text-center rounded-xl border-2 border-dashed"
    style={{ borderColor: 'var(--color-border)' }}
  >
    <Receipt className="w-9 h-9 mb-3" style={{ color: 'var(--color-text-muted)' }} aria-hidden />
    <h3 className="font-display text-lg font-bold">{message}</h3>
    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
  </div>
);

export default EmptyState;

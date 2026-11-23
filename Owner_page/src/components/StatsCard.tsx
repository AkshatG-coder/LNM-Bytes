import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  Icon: LucideIcon;
  /** "alert" = haldi fill (needs attention), "ink" = dark fill (the money number), default = plain surface */
  tone?: 'default' | 'alert' | 'ink';
  hint?: string;
}

const TONES = {
  default: { box: 'border', style: { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }, muted: 'var(--color-text-muted)' },
  alert:   { box: 'border border-transparent bg-primary text-on-primary', style: {}, muted: 'rgb(18 27 46 / 0.7)' },
  ink:     { box: 'border border-transparent', style: { backgroundColor: '#121B2E', color: '#EEF1F7' }, muted: '#9AA5BA' },
} as const;

export const StatsCard = ({ title, value, Icon, tone = 'default', hint }: StatsCardProps) => {
  const t = TONES[tone];
  return (
    <div className={`p-4 sm:p-5 rounded-xl ${t.box}`} style={t.style}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: t.muted }}>{title}</p>
        <Icon className="w-4 h-4" style={{ color: t.muted }} aria-hidden />
      </div>
      <p className="mt-2 font-display font-extrabold text-3xl tnum leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs" style={{ color: t.muted }}>{hint}</p>}
    </div>
  );
};

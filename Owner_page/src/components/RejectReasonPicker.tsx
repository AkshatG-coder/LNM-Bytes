import { useEffect, useRef, useState } from 'react';

// Codes must match Backend/src/utils/rejectReasons.ts
export const REJECT_OPTIONS = [
    { code: 'out_of_stock', label: 'An item is out of stock' },
    { code: 'too_busy', label: 'Kitchen is too busy' },
    { code: 'closing_soon', label: 'Closing soon' },
    { code: 'order_issue', label: 'Problem with the order' },
    { code: 'other', label: 'Other' },
] as const;

export interface RejectPayload {
    reason: string;
    note?: string;
}

interface Props {
    /** Online-paid orders are refunded automatically, so say so. */
    paidOnline?: boolean;
    busy?: boolean;
    onConfirm: (payload: RejectPayload) => void;
    onCancel: () => void;
}

/** Asks the owner why an order is rejected. The student sees the chosen reason. */
export default function RejectReasonPicker({ paidOnline, busy, onConfirm, onCancel }: Props) {
    const [reason, setReason] = useState<string>('');
    const [note, setNote] = useState('');

    // Inside a scrolling chat the picker can open below the fold, so bring it into view.
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, []);

    return (
        <div
            ref={ref}
            className="w-full rounded-xl border p-3 space-y-3"
            style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)' }}
            role="group"
            aria-label="Why are you rejecting this order?"
            onClick={(e) => e.stopPropagation()}
        >
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
                Why are you rejecting this order?
                <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>
                    {' '}The student will see your reason{paidOnline ? ' and get a refund' : ''}.
                </span>
            </p>

            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
                {REJECT_OPTIONS.map((o) => {
                    const selected = reason === o.code;
                    return (
                        <button
                            key={o.code}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setReason(o.code)}
                            className="text-xs font-medium px-3 py-2 rounded-lg border transition-colors"
                            style={
                                selected
                                    ? { background: '#dc2626', borderColor: '#dc2626', color: 'white' }
                                    : { background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }
                            }
                        >
                            {o.label}
                        </button>
                    );
                })}
            </div>

            <input
                type="text"
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a short note (optional)"
                aria-label="Note for the student"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/40 bg-transparent"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }}
            />

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={!reason || busy}
                    onClick={() => onConfirm({ reason, note: note.trim() || undefined })}
                    className="text-xs font-semibold px-3.5 py-2 rounded-lg text-white disabled:opacity-40 active:scale-95 transition-transform"
                    style={{ background: '#dc2626' }}
                >
                    {busy ? 'Rejecting…' : 'Reject order'}
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={onCancel}
                    className="text-xs font-semibold px-3.5 py-2 rounded-lg border disabled:opacity-40"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }}
                >
                    Keep order
                </button>
            </div>
        </div>
    );
}

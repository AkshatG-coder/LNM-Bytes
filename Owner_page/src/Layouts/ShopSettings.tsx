import { useState, useEffect, useMemo } from 'react';
import { Check, Save, Clock, MapPin, Moon, RotateCcw } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { Store } from '../types';
import { fmt12, isOvernight, openHours, nowIST, shopState } from '../utils/shopHours';

const muted = { color: 'var(--color-text-muted)' };
const labelCls = 'block text-[11px] font-bold uppercase tracking-widest mb-1.5';
const cardStyle = { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' };

type Draft = {
  name: string; description: string; location: string; phone: string;
  openTime: string; closeTime: string; nightDeliveryCharge: number;
};

const DESC_MAX = 200;
const HOURS_PRESETS = [
  { label: '8 AM to 10 PM', open: '08:00', close: '22:00' },
  { label: '9 AM to 6 PM', open: '09:00', close: '18:00' },
  { label: '8 AM to 1 AM', open: '08:00', close: '01:00' },
];

const toDigits = (v: string) => {
  let d = v.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  return d.slice(0, 10);
};

const draftFrom = (s: Store): Draft => ({
  name: s.name || '',
  description: s.description || '',
  location: s.location || '',
  phone: toDigits(s.phone || ''),
  openTime: s.operationTime?.openTime || '08:00',
  closeTime: s.operationTime?.closeTime || '22:00',
  nightDeliveryCharge: s.nightDeliveryCharge ?? 10,
});

/** One message per invalid field; the backend enforces the same rules. */
function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {};
  const name = d.name.trim(), desc = d.description.trim(), loc = d.location.trim();
  if (name.length < 2 || name.length > 60) e.name = 'Use 2 to 60 characters';
  if (desc.length < 1) e.description = 'Add a short description';
  else if (desc.length > DESC_MAX) e.description = `Keep it under ${DESC_MAX} characters`;
  if (loc.length < 2 || loc.length > 80) e.location = 'Use 2 to 80 characters';
  if (d.phone.length !== 10) e.phone = 'Enter a 10 digit mobile number';
  if (!d.openTime || !d.closeTime) e.openTime = 'Pick both times';
  else if (d.openTime === d.closeTime) e.closeTime = 'Opening and closing time can not be the same';
  if (!Number.isFinite(d.nightDeliveryCharge) || d.nightDeliveryCharge < 0 || d.nightDeliveryCharge > 500) e.nightDeliveryCharge = 'Between ₹0 and ₹500';
  return e;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {hint && <p className="text-sm mt-0.5" style={muted}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls} style={muted}>{label}</label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 text-xs font-bold" style={{ color: 'var(--bad)' }}>{error}</p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-xs" style={muted}>{hint}</p>
      ) : null}
    </div>
  );
}

function Instant() {
  return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-2" style={muted}>Saves instantly</span>;
}

function ToggleRow({ label, sublabel, value, onChange, disabled, note }: { label: string; sublabel: string; value: boolean; onChange: () => void; disabled?: boolean; note?: string }) {
  return (
    <div className="p-4 rounded-xl border" style={cardStyle}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-bold text-sm flex items-center gap-2 flex-wrap">{label} <Instant /></p>
          <p className="text-xs mt-0.5" style={muted}>{sublabel}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label={label}
          disabled={disabled}
          onClick={onChange}
          className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 ${value ? 'bg-primary' : 'bg-surface-2 border'}`}
          style={value ? undefined : { borderColor: 'var(--color-border)' }}
        >
          <span className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-all" style={{ left: value ? '1.375rem' : '0.125rem', backgroundColor: value ? '#121B2E' : 'var(--color-text-muted)' }} />
        </button>
      </div>
      {note && <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--warn)' }}>{note}</p>}
    </div>
  );
}

function ShopSettings() {
  const { store, loading, saving, error, updateStore, toggleStatus } = useStore();

  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [confirmClose, setConfirmClose] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [now, setNow] = useState(() => nowIST());

  // First load: fill the form once. Later refetches (after a toggle) must not overwrite what is being typed.
  useEffect(() => {
    if (store && !base) {
      const d = draftFrom(store);
      setBase(d);
      setDraft(d);
    }
  }, [store, base]);

  // Keep the "open right now" line honest while the page stays open.
  useEffect(() => {
    const t = setInterval(() => setNow(nowIST()), 30_000);
    return () => clearInterval(t);
  }, []);

  const errors = useMemo(() => (draft ? validate(draft) : {}), [draft]);
  const changed = useMemo(() => {
    if (!draft || !base) return [] as (keyof Draft)[];
    return (Object.keys(draft) as (keyof Draft)[]).filter(k => draft[k] !== base[k]);
  }, [draft, base]);
  const dirty = changed.length > 0;

  // Warn before leaving with unsaved edits (tab close or reload).
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => (d ? { ...d, [k]: v } : d));
  const touch = (k: string) => setTouched(t => new Set(t).add(k));
  const err = (k: keyof Draft) => (touched.has(k) ? errors[k] : undefined);

  const handleSave = async () => {
    if (!draft || !base) return;
    setTouched(new Set(Object.keys(draft)));
    if (Object.keys(errors).length > 0) {
      showToast('Fix the highlighted fields first', 'error');
      return;
    }
    const payload: Partial<Store> = {};
    if (changed.includes('name')) payload.name = draft.name.trim();
    if (changed.includes('description')) payload.description = draft.description.trim();
    if (changed.includes('location')) payload.location = draft.location.trim();
    if (changed.includes('phone')) payload.phone = draft.phone;
    if (changed.includes('openTime') || changed.includes('closeTime')) payload.operationTime = { openTime: draft.openTime, closeTime: draft.closeTime };
    if (changed.includes('nightDeliveryCharge')) payload.nightDeliveryCharge = draft.nightDeliveryCharge;

    const ok = await updateStore(payload);
    if (ok) {
      const saved = { ...draft, name: draft.name.trim(), description: draft.description.trim(), location: draft.location.trim() };
      setBase(saved);
      setDraft(saved);
      setTouched(new Set());
      showToast('Changes saved');
    } else {
      showToast('Could not save. Check your connection and try again.', 'error');
    }
  };

  const handleDiscard = () => {
    if (base) setDraft(base);
    setTouched(new Set());
  };

  const handleOpenClose = async () => {
    if (!store) return;
    const closing = store.status === 'open';
    if (closing && !confirmClose) { setConfirmClose(true); return; }
    setConfirmClose(false);
    const ok = await toggleStatus();
    if (ok) showToast(closing ? 'Shop is now closed' : 'Shop is now open');
    else showToast('Could not change shop status', 'error');
  };

  const handleToggle = async (field: 'nightDelivery' | 'isOnlineOrderAvailable') => {
    if (!store) return;
    const turningOn = !store[field];
    if (turningOn && store.status === 'closed') {
      showToast('Open your shop first, then turn this on', 'error');
      return;
    }
    const ok = await updateStore({ [field]: turningOn });
    showToast(ok ? (turningOn ? 'Turned on' : 'Turned off') : 'Could not update', ok ? 'success' : 'error');
  };

  const handleFoodType = async (type: Store['foodType']) => {
    if (!store || store.foodType === type) return;
    const ok = await updateStore({ foodType: type });
    showToast(ok ? 'Food type updated' : 'Could not update', ok ? 'success' : 'error');
  };

  if (loading && !store) {
    return (
      <div className="max-w-5xl space-y-4" aria-busy="true" aria-label="Loading settings">
        <div className="h-24 rounded-xl animate-pulse bg-surface-2" />
        {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-xl animate-pulse bg-surface-2" />)}
      </div>
    );
  }

  if (!store || !draft || !base) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-2 text-center">
        <h2 className="font-display text-xl font-bold">Could not load your store</h2>
        <p className="text-sm" style={muted}>{error || 'Unknown error'}</p>
      </div>
    );
  }

  const open = store.status === 'open';
  const saved = { open: store.operationTime?.openTime || '08:00', close: store.operationTime?.closeTime || '22:00' };
  const state = shopState(store, saved, now);
  // The banner stays neutral; only the dot and the edge carry the state colour.
  const tone = state.kind === 'open' ? 'var(--ok)' : state.kind === 'closed' ? 'var(--bad)' : 'var(--warn)';
  const overnight = isOvernight(draft.openTime, draft.closeTime);

  return (
    <div className="max-w-5xl animate-fade-in pb-28">
      {toast && (
        <div
          role="status"
          className="fixed top-16 md:top-6 right-4 md:right-6 z-[60] px-5 py-3 rounded-lg shadow-xl font-bold text-sm text-white animate-slide-up"
          style={{ backgroundColor: toast.type === 'success' ? '#15803D' : '#C62828' }}
        >
          {toast.msg}
        </div>
      )}

      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest" style={muted}>{base.name}</p>
        <h1 className="text-3xl font-extrabold tracking-tight mt-1">Shop settings</h1>
      </header>

      {error && (
        <div role="alert" className="mb-6 p-4 rounded-xl border text-sm font-semibold" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}>{error}</div>
      )}

      {/* What students can do right now: owner switch + opening hours, together */}
      <div className="p-5 rounded-xl border mb-8" style={{ ...cardStyle, borderLeft: `4px solid ${tone}` }} aria-live="polite">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="font-display text-2xl font-extrabold flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tone }} aria-hidden />
              {state.headline}
            </p>
            <p className="text-sm mt-1" style={muted}>{state.detail}</p>
          </div>
          {!confirmClose && (
            <button
              onClick={handleOpenClose}
              disabled={saving}
              className={`px-5 py-2.5 rounded-lg font-extrabold text-sm disabled:opacity-50 active:scale-[0.98] ${open ? 'border hover:bg-surface-2' : 'bg-primary text-on-primary hover:bg-primary-dark'}`}
              style={open ? { borderColor: 'var(--color-border)' } : undefined}
            >
              {saving ? 'Please wait…' : open ? 'Close shop' : 'Open shop'}
            </button>
          )}
        </div>
        {confirmClose && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-bold">Close the shop? New orders will stop. Orders already placed are not affected.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClose(false)} className="px-4 py-2 rounded-lg text-sm font-bold border hover:bg-surface-2" style={{ borderColor: 'var(--color-border)' }}>Keep open</button>
              <button onClick={handleOpenClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-extrabold text-white disabled:opacity-50" style={{ backgroundColor: '#C62828' }}>Yes, close</button>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-x-8">
        <div className="min-w-0">
          <Section title="Shop details" hint="This is what students see on the canteen list.">
            <div className="rounded-xl border p-5 space-y-4" style={cardStyle}>
              <Field id="ss-name" label="Shop name" error={err('name')}>
                <input id="ss-name" className="field" value={draft.name} maxLength={60} aria-describedby="ss-name-msg" aria-invalid={!!err('name')}
                  onChange={e => set('name', e.target.value)} onBlur={() => touch('name')} />
              </Field>
              <Field id="ss-desc" label="Description" error={err('description')} hint={<span className="tnum">{draft.description.length}/{DESC_MAX}</span>}>
                <textarea id="ss-desc" className="field resize-none" rows={2} value={draft.description} maxLength={DESC_MAX + 20} aria-describedby="ss-desc-msg" aria-invalid={!!err('description')}
                  onChange={e => set('description', e.target.value)} onBlur={() => touch('description')} />
              </Field>
              <Field id="ss-loc" label="Location" error={err('location')}>
                <input id="ss-loc" className="field" value={draft.location} maxLength={80} placeholder="e.g. Near the main gate" aria-describedby="ss-loc-msg" aria-invalid={!!err('location')}
                  onChange={e => set('location', e.target.value)} onBlur={() => touch('location')} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field id="ss-phone" label="Phone number" error={err('phone')} hint="Students call this if there is a problem">
                  <div className="flex">
                    <span className="px-3 flex items-center text-sm font-bold rounded-l-lg border border-r-0 bg-surface-2" style={{ borderColor: 'var(--color-border)' }}>+91</span>
                    <input id="ss-phone" type="tel" inputMode="numeric" autoComplete="tel-national" className="field tnum !rounded-l-none" value={draft.phone} placeholder="98765 43210" aria-describedby="ss-phone-msg" aria-invalid={!!err('phone')}
                      onChange={e => set('phone', toDigits(e.target.value))} onBlur={() => touch('phone')} />
                  </div>
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Opening hours" hint="Students can order only inside these hours (night delivery is the exception).">
            <div className="rounded-xl border p-5 space-y-4" style={cardStyle}>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Quick hours">
                {HOURS_PRESETS.map(p => {
                  const on = draft.openTime === p.open && draft.closeTime === p.close;
                  return (
                    <button key={p.label} type="button" aria-pressed={on}
                      onClick={() => { set('openTime', p.open); set('closeTime', p.close); touch('closeTime'); }}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-bold border ${on ? 'bg-primary text-on-primary border-transparent' : 'hover:bg-surface-2'}`}
                      style={on ? undefined : { borderColor: 'var(--color-border)' }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field id="ss-open" label="Opens at" error={err('openTime')}>
                  <input id="ss-open" type="time" className="field" value={draft.openTime} onChange={e => set('openTime', e.target.value)} onBlur={() => touch('openTime')} />
                </Field>
                <Field id="ss-close" label="Closes at" error={err('closeTime')}>
                  <input id="ss-close" type="time" className="field" value={draft.closeTime} onChange={e => set('closeTime', e.target.value)} onBlur={() => touch('closeTime')} />
                </Field>
              </div>
              {!errors.closeTime && !errors.openTime && (
                <p className="text-sm font-semibold flex items-center gap-2 tnum">
                  <Clock className="w-4 h-4" style={muted} aria-hidden />
                  {fmt12(draft.openTime)} to {fmt12(draft.closeTime)}
                  <span style={muted} className="font-medium">· {openHours(draft.openTime, draft.closeTime)} hours a day{overnight ? ', closes after midnight' : ''}</span>
                </p>
              )}
            </div>
          </Section>

          <Section title="Orders and delivery" hint="These switches take effect the moment you tap them.">
            <div className="space-y-3">
              <ToggleRow label="Accept orders in the app" sublabel="Turn off to pause app orders while students can still see your menu" value={store.isOnlineOrderAvailable} onChange={() => handleToggle('isOnlineOrderAvailable')} disabled={saving}
                note={!open ? 'Your shop is closed, so you can only turn this off right now.' : undefined} />
              <ToggleRow label="Night delivery" sublabel="Accept orders after your regular hours" value={store.nightDelivery} onChange={() => handleToggle('nightDelivery')} disabled={saving} />
              {store.nightDelivery && (
                <div className="p-4 rounded-xl border" style={cardStyle}>
                  <div className="flex justify-between items-center gap-4">
                    <div>
                      <label htmlFor="ss-charge" className="font-bold text-sm">Night delivery charge</label>
                      <p className="text-xs mt-0.5" style={muted}>Added to the cart for night orders</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={muted}>₹</span>
                      <input id="ss-charge" type="number" inputMode="numeric" min={0} max={500} className="field w-20 text-center font-bold tnum" value={Number.isNaN(draft.nightDeliveryCharge) ? '' : draft.nightDeliveryCharge}
                        onChange={e => set('nightDeliveryCharge', e.target.value === '' ? NaN : Number(e.target.value))} onBlur={() => touch('nightDeliveryCharge')} />
                    </div>
                  </div>
                  {err('nightDeliveryCharge') && <p role="alert" className="mt-2 text-xs font-bold text-right" style={{ color: 'var(--bad)' }}>{errors.nightDeliveryCharge}</p>}
                </div>
              )}
            </div>
          </Section>

          <Section title="Food type" hint="Shown to students as a veg or non-veg mark.">
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Food type">
              {(['veg', 'non-veg', 'both'] as const).map((type) => {
                const on = store.foodType === type;
                return (
                  <button key={type} role="radio" aria-checked={on} onClick={() => handleFoodType(type)} disabled={saving}
                    className={`py-3.5 rounded-xl font-bold text-sm border-2 disabled:opacity-50 flex items-center justify-center gap-1.5 ${on ? 'border-primary bg-primary/15' : 'hover:bg-surface-2'}`}
                    style={on ? undefined : { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                    {on && <Check className="w-4 h-4" aria-hidden />}
                    {type === 'veg' ? 'Veg only' : type === 'non-veg' ? 'Non-veg' : 'Both'}
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Live preview of the card students see, built from the unsaved draft */}
        <aside className="lg:sticky lg:top-6 self-start mb-8 order-first lg:order-none" aria-label="Preview">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={muted}>How students see it</p>
          <div className="rounded-xl border p-4" style={{ ...cardStyle, opacity: open ? 1 : 0.78 }}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-extrabold leading-tight break-words min-w-0">{draft.name.trim() || 'Your shop name'}</h3>
              <span className="shrink-0 flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-extrabold" style={open ? { backgroundColor: 'color-mix(in srgb, var(--ok) 16%, transparent)', color: 'var(--ok)' } : { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />{open ? 'Open' : 'Closed'}
              </span>
            </div>
            <p className="mt-1.5 text-sm line-clamp-2 leading-relaxed" style={muted}>{draft.description.trim() || 'Your description appears here.'}</p>
            <div className="mt-4 pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-semibold" style={{ borderColor: 'var(--color-border)' }}>
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" style={muted} aria-hidden />{draft.location.trim() || 'Location'}</span>
              <span className="flex items-center gap-1.5 tnum"><Clock className="w-3.5 h-3.5" style={muted} aria-hidden />{draft.openTime} to {draft.closeTime}</span>
              {store.foodType !== 'both' && (
                <span className="flex items-center gap-1.5">
                  <span className="flex w-3.5 h-3.5 items-center justify-center rounded-[3px] border-2" style={{ borderColor: store.foodType === 'veg' ? 'var(--ok)' : 'var(--bad)' }} aria-hidden>
                    <span className="block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: store.foodType === 'veg' ? 'var(--ok)' : 'var(--bad)' }} />
                  </span>
                  {store.foodType === 'veg' ? 'Veg only' : 'Non-veg'}
                </span>
              )}
              {store.nightDelivery && <span className="flex items-center gap-1.5"><Moon className="w-3.5 h-3.5" style={muted} aria-hidden />Night delivery</span>}
            </div>
          </div>
          <p className="mt-2 text-xs" style={muted}>Updates as you type. Nothing goes live until you save.</p>
        </aside>
      </div>

      {/* Unsaved changes bar: only text fields need it, the switches above save on their own */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 border-t animate-fade-in pr-20" style={cardStyle} role="region" aria-label="Unsaved changes">
          <div className="max-w-5xl px-4 lg:px-8 py-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold hidden sm:block">You have unsaved changes</p>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={handleDiscard} disabled={saving} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold border hover:bg-surface-2 disabled:opacity-50" style={{ borderColor: 'var(--color-border)' }}>
                <RotateCcw className="w-4 h-4" aria-hidden /> Discard
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-extrabold bg-primary text-on-primary hover:bg-primary-dark disabled:opacity-50 active:scale-[0.98]">
                <Save className="w-4 h-4" aria-hidden /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShopSettings;

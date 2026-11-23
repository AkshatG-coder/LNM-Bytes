import { useState, useEffect } from 'react';
import { Check, Save } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { Store } from '../types';

const labelCls = 'block text-[11px] font-bold uppercase tracking-widest mb-1.5';
const muted = { color: 'var(--color-text-muted)' };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-extrabold mb-3">{children}</h2>;
}

function ToggleSwitch({ label, sublabel, value, onChange }: { label: string; sublabel?: string; value: boolean; onChange: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-xl border"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div>
        <p className="font-bold text-sm">{label}</p>
        {sublabel && <p className="text-xs mt-0.5" style={muted}>{sublabel}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${value ? 'bg-primary' : 'bg-surface-2 border'}`}
        style={value ? undefined : { borderColor: 'var(--color-border)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-all"
          style={{ left: value ? '1.375rem' : '0.125rem', backgroundColor: value ? '#121B2E' : 'var(--color-text-muted)' }}
        />
      </button>
    </div>
  );
}

function ShopSettings() {
  const { store, loading, saving, error, updateStore, toggleStatus } = useStore();
  const [phone, setPhone] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState(10);
  const [initialized, setInitialized] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Initialize local form state once store loads
  useEffect(() => {
    if (store && !initialized) {
      setPhone(store.phone || '');
      setOpenTime(store.operationTime?.openTime || '');
      setCloseTime(store.operationTime?.closeTime || '');
      setDeliveryCharge(store.nightDeliveryCharge ?? 10);
      setInitialized(true);
    }
  }, [store, initialized]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveContact = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      showToast('Please enter exactly 10 digits for the phone number', 'error');
      return;
    }
    const ok = await updateStore({
      phone,
      operationTime: { openTime, closeTime },
      nightDeliveryCharge: deliveryCharge,
    });
    if (ok) showToast('Settings saved!');
    else showToast('Failed to save', 'error');
  };

  const handleToggleStatus = async () => {
    const ok = await toggleStatus();
    if (ok) showToast(`Shop is now ${store?.status === 'open' ? 'CLOSED' : 'OPEN'}!`);
    else showToast('Failed to toggle status', 'error');
  };

  const handleToggle = async (field: 'nightDelivery' | 'isOnlineOrderAvailable') => {
    if (!store) return;
    if (store.status === 'closed') {
      showToast('Cannot enable delivery while shop is closed!', 'error');
      return;
    }
    const ok = await updateStore({ [field]: !store[field] });
    if (ok) showToast('Updated!');
    else showToast('Failed to update', 'error');
  };

  const handleFoodType = async (type: Store['foodType']) => {
    const ok = await updateStore({ foodType: type });
    if (ok) showToast('Food type updated!');
    else showToast('Update failed', 'error');
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4" aria-busy="true" aria-label="Loading settings">
        {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-xl animate-pulse bg-surface-2" />)}
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-2 text-center">
        <h2 className="font-display text-xl font-bold">Could not load your store</h2>
        <p className="text-sm" style={muted}>{error || 'Unknown error'}</p>
      </div>
    );
  }

  const open = store.status === 'open';

  return (
    <div className="max-w-2xl animate-fade-in">
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
        <p className="text-xs font-bold uppercase tracking-widest" style={muted}>{store.name}</p>
        <h1 className="text-3xl font-extrabold tracking-tight mt-1">Shop settings</h1>
        <p className="text-sm mt-1.5" style={muted}>{store.location} · Owner: {store.ownerName}{store.description ? ` · ${store.description}` : ''}</p>
      </header>

      {error && (
        <div role="alert" className="mb-6 p-4 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}>{error}</div>
      )}

      {/* Open / closed: the one big switch of the day */}
      <section className="mb-8">
        <div
          className={`p-5 rounded-xl flex items-center justify-between gap-4 flex-wrap ${open ? 'bg-primary text-on-primary' : ''}`}
          style={open ? undefined : { backgroundColor: '#121B2E', color: '#EEF1F7' }}
        >
          <div>
            <p className="font-display text-2xl font-extrabold">{open ? 'Shop is open' : 'Shop is closed'}</p>
            <p className="text-sm mt-0.5 opacity-80">
              {open ? 'Students can browse and order right now.' : 'Orders are paused. Nobody can place a new order.'}
            </p>
          </div>
          <button
            onClick={handleToggleStatus}
            disabled={saving}
            className={`px-5 py-2.5 rounded-lg font-extrabold text-sm disabled:opacity-50 active:scale-[0.98] ${open ? 'bg-[#121B2E] text-white' : 'bg-primary text-on-primary'}`}
          >
            {saving ? 'Please wait…' : open ? 'Close shop' : 'Open shop'}
          </button>
        </div>
      </section>

      <section className="mb-8">
        <SectionTitle>Contact and hours</SectionTitle>
        <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div>
            <label htmlFor="ss-phone" className={labelCls} style={muted}>Phone number</label>
            <input
              id="ss-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+]/g, ''))}
              placeholder="+91 99999 99999"
              className="field tnum"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ss-open" className={labelCls} style={muted}>Opens at</label>
              <input id="ss-open" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="field" />
            </div>
            <div>
              <label htmlFor="ss-close" className={labelCls} style={muted}>Closes at</label>
              <input id="ss-close" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="field" />
            </div>
          </div>
          <button
            onClick={handleSaveContact}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-on-primary rounded-lg font-extrabold text-sm hover:bg-primary-dark disabled:opacity-50 active:scale-[0.98]"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save contact and hours'}
          </button>
        </div>
      </section>

      <section className="mb-8">
        <SectionTitle>Delivery and orders</SectionTitle>
        <div className="space-y-3">
          <ToggleSwitch label="Night delivery" sublabel="Allow orders after regular hours" value={store.nightDelivery} onChange={() => handleToggle('nightDelivery')} />
          <ToggleSwitch label="Online orders" sublabel="Accept orders through the app" value={store.isOnlineOrderAvailable} onChange={() => handleToggle('isOnlineOrderAvailable')} />

          {store.nightDelivery && (
            <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex justify-between items-center gap-4">
                <div>
                  <label htmlFor="ss-charge" className="font-bold text-sm">Night delivery charge</label>
                  <p className="text-xs mt-0.5" style={muted}>Added to the student's cart for night orders</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold" style={muted}>₹</span>
                  <input
                    id="ss-charge"
                    type="number"
                    value={deliveryCharge}
                    onChange={(e) => setDeliveryCharge(Number(e.target.value))}
                    min="0"
                    max="500"
                    className="field w-20 text-center font-bold tnum"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveContact}
                disabled={saving}
                className="mt-4 w-full py-2.5 rounded-lg font-bold text-sm border hover:bg-surface-2 disabled:opacity-50"
                style={{ borderColor: 'var(--color-border)' }}
              >
                Save charge
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle>Food type</SectionTitle>
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Food type">
          {(['veg', 'non-veg', 'both'] as const).map((type) => {
            const on = store.foodType === type;
            return (
              <button
                key={type}
                role="radio"
                aria-checked={on}
                onClick={() => handleFoodType(type)}
                disabled={saving}
                className={`py-3.5 rounded-xl font-bold text-sm border-2 disabled:opacity-50 flex items-center justify-center gap-1.5 ${on ? 'border-primary bg-primary/15' : 'hover:bg-surface-2'}`}
                style={on ? undefined : { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              >
                {on && <Check className="w-4 h-4" />}
                {type === 'veg' ? 'Veg only' : type === 'non-veg' ? 'Non-veg' : 'Both'}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default ShopSettings;

import { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import type { Store } from '../types';

function ToggleSwitch({
  label,
  sublabel,
  value,
  onChange,
  colorClass = 'bg-primary',
  size = 'normal',
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: () => void;
  colorClass?: string;
  size?: 'normal' | 'large';
}) {
  return (
    <div className={`flex items-center justify-between ${size === 'large' ? 'p-5' : 'p-4'} bg-white rounded-2xl border border-gray-100 hover:border-gray-200 transition-all`}>
      <div>
        <p className={`font-black text-gray-800 ${size === 'large' ? 'text-base' : 'text-sm'}`}>{label}</p>
        {sublabel && <p className="text-xs font-medium text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      <button
        onClick={onChange}
        className={`relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0 ${value ? colorClass : 'bg-gray-200'}`}
      >
        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${value ? 'left-8' : 'left-1'}`} />
      </button>
    </div>
  );
}

function ShopSettings() {
  const { store, loading, saving, error, updateStore, toggleStatus } = useStore();
  const [phone, setPhone] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Initialize local form state once store loads
  useEffect(() => {
    if (store && !initialized) {
      setPhone(store.phone || '');
      setOpenTime(store.operationTime?.openTime || '');
      setCloseTime(store.operationTime?.closeTime || '');
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
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
        <p className="text-primary font-black text-sm uppercase tracking-widest animate-pulse">Loading settings...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <span className="text-6xl">⚠️</span>
        <h2 className="text-xl font-black text-gray-700">Could not load store</h2>
        <p className="text-gray-400 text-sm font-medium">{error || 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl shadow-xl font-black text-sm text-white animate-slide-up ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-gray-800">Shop Settings</h1>
        <p className="text-gray-500 text-sm mt-1 font-medium">Manage your store configuration</p>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 font-bold text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Store Info */}
      <section className="mb-6">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Store Info</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-2xl shadow-inner">
              {store.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-800">{store.name}</h3>
              <p className="text-sm text-gray-500 font-medium">Owner: {store.ownerName}</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">{store.location}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500 font-medium leading-relaxed border-t border-gray-50 pt-4">{store.description}</p>
        </div>
      </section>


      {/* 🔴/🟢 Shop Open/Close — Big Toggle */}
      <section className="mb-6">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Shop Status</h2>
        <div className={`p-6 rounded-2xl border-2 transition-all ${store.status === 'open' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-lg font-black ${store.status === 'open' ? 'text-green-700' : 'text-red-600'}`}>
                {store.status === 'open' ? '🟢 Shop is OPEN' : '🔴 Shop is CLOSED'}
              </p>
              <p className="text-sm font-medium mt-1 opacity-70 text-gray-700">
                {store.status === 'open' ? 'Customers can browse and order from your store' : 'Orders are paused — no new orders'}
              </p>
            </div>
            <button
              onClick={handleToggleStatus}
              disabled={saving}
              className={`px-6 py-3 rounded-xl font-black text-sm text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${
                store.status === 'open' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200'
              }`}
            >
              {saving ? '⏳...' : store.status === 'open' ? 'Close Shop' : 'Open Shop'}
            </button>
          </div>
        </div>
      </section>

      {/* Contact & Hours */}
      <section className="mb-6">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Contact & Hours</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const sanitized = e.target.value.replace(/[^\d\s+]/g, '');
                setPhone(sanitized);
              }}
              placeholder="+91 99999 99999"
              className="mt-2 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Opens At</label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="mt-2 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Closes At</label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="mt-2 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>
          <button
            onClick={handleSaveContact}
            disabled={saving}
            className="w-full py-3.5 bg-primary text-white rounded-xl font-black text-sm hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? '⏳ Saving...' : '💾 Save Contact & Hours'}
          </button>
        </div>
      </section>

      {/* Toggles */}
      <section className="mb-6">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Delivery & Orders</h2>
        <div className="space-y-3">
          <ToggleSwitch
            label="🌙 Night Delivery"
            sublabel="Allow orders after regular hours"
            value={store.nightDelivery}
            onChange={() => handleToggle('nightDelivery')}
            colorClass="bg-indigo-500"
          />
          <ToggleSwitch
            label="📱 Online Orders"
            sublabel="Accept orders through the app"
            value={store.isOnlineOrderAvailable}
            onChange={() => handleToggle('isOnlineOrderAvailable')}
            colorClass="bg-primary"
          />
        </div>
      </section>

      {/* Food Type */}
      <section className="mb-10">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Food Type</h2>
        <div className="flex gap-3">
          {(['veg', 'non-veg', 'both'] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleFoodType(type)}
              disabled={saving}
              className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all border-2 disabled:opacity-50 ${
                store.foodType === type
                  ? type === 'veg'
                    ? 'bg-green-100 text-green-700 border-green-300 shadow-md'
                    : type === 'non-veg'
                    ? 'bg-red-100 text-red-700 border-red-300 shadow-md'
                    : 'bg-orange-100 text-orange-700 border-orange-300 shadow-md'
                  : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
              }`}
            >
              {type === 'veg' ? '🥦 Veg Only' : type === 'non-veg' ? '🍗 Non-Veg' : '🍱 Both'}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ShopSettings;

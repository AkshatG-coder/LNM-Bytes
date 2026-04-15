import { useState } from 'react';
import { useMenu } from '../hooks/useMenu';
import type { NewMenuItem } from '../hooks/useMenu';
import type { MenuItem, MenuCategory } from '../types';

const CATEGORIES: { value: MenuCategory; label: string; emoji: string }[] = [
  { value: 'snacks', label: 'Snacks', emoji: '🍟' },
  { value: 'drinks', label: 'Drinks', emoji: '🥤' },
  { value: 'meals', label: 'Meals', emoji: '🍱' },
  { value: 'dessert', label: 'Dessert', emoji: '🍨' },
  { value: 'other', label: 'Other', emoji: '🍽️' },
];

const EMPTY_FORM: NewMenuItem = {
  name: '',
  price: 0,
  hasHalf: false,
  halfPrice: undefined,
  category: 'snacks',
  isVeg: true,
  isAvailable: true,
};

// ─── Modal ────────────────────────────────────────────────────────────────────
function ItemModal({
  open, title, form, saving, onChange, onSubmit, onClose,
}: {
  open: boolean; title: string; form: NewMenuItem; saving: boolean;
  onChange: (updated: NewMenuItem) => void;
  onSubmit: () => void; onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-8 animate-slide-up border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Item Name</label>
            <input
              type="text"
              placeholder="e.g. Samosa, Chai, Burger..."
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Full Price */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              {form.hasHalf ? 'Full Portion Price (₹)' : 'Price (₹)'}
            </label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={form.price || ''}
              onChange={(e) => onChange({ ...form, price: parseFloat(e.target.value) || 0 })}
              className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Has Half Toggle */}
          <div
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
              form.hasHalf ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'
            }`}
            onClick={() => onChange({ ...form, hasHalf: !form.hasHalf, halfPrice: !form.hasHalf ? undefined : form.halfPrice })}
          >
            <div>
              <p className={`font-black text-sm ${form.hasHalf ? 'text-blue-700' : 'text-gray-600'}`}>
                🍜 Has Half Portion?
              </p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Offer a smaller portion at a lower price
              </p>
            </div>
            <div className={`w-10 h-6 rounded-full transition-all duration-300 relative flex-shrink-0 ${form.hasHalf ? 'bg-blue-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.hasHalf ? 'left-5' : 'left-1'}`} />
            </div>
          </div>

          {/* Half Price (only shown when hasHalf is true) */}
          {form.hasHalf && (
            <div className="animate-fade-in">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Half Portion Price (₹)</label>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={form.halfPrice || ''}
                onChange={(e) => onChange({ ...form, halfPrice: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              />
              {form.price > 0 && (form.halfPrice || 0) > 0 && (
                <p className="text-xs text-gray-400 font-medium mt-1 ml-1">
                  Full ₹{form.price} · Half ₹{form.halfPrice}
                </p>
              )}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => onChange({ ...form, category: cat.value })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                    form.category === cat.value
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-primary/30 hover:text-primary'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* isVeg + isAvailable */}
          <div className="flex gap-4">
            <button
              onClick={() => onChange({ ...form, isVeg: !form.isVeg })}
              className={`flex-1 py-3 rounded-xl font-black text-sm border transition-all ${
                form.isVeg ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
              }`}
            >
              {form.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
            </button>
            <button
              onClick={() => onChange({ ...form, isAvailable: !form.isAvailable })}
              className={`flex-1 py-3 rounded-xl font-black text-sm border transition-all ${
                form.isAvailable ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
            >
              {form.isAvailable ? '✅ Available' : '❌ Unavailable'}
            </button>
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={saving || !form.name.trim() || form.price <= 0 || (form.hasHalf && !form.halfPrice)}
          className="mt-8 w-full py-4 bg-primary text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '⏳ Saving...' : title}
        </button>

        {form.hasHalf && !form.halfPrice && (
          <p className="mt-2 text-center text-xs text-red-500 font-bold">Half price is required when half portion is enabled</p>
        )}
      </div>
    </div>
  );
}

// ─── Menu Item Card ───────────────────────────────────────────────────────────
function MenuItemCard({
  item, onEdit, onDelete, onToggle,
}: { item: MenuItem; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const cat = CATEGORIES.find((c) => c.value === item.category);
  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 hover:shadow-md group ${item.isAvailable ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
      <div className="p-4 flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
          {cat?.emoji || '🍽️'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-800 text-sm truncate">{item.name}</h3>
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${item.isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {item.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item.hasHalf && item.halfPrice ? (
              <>
                <span className="text-sm font-black text-primary">₹{item.price} <span className="text-gray-400 font-medium text-xs">full</span></span>
                <span className="text-sm font-black text-blue-500">₹{item.halfPrice} <span className="text-gray-400 font-medium text-xs">half</span></span>
              </>
            ) : (
              <span className="text-base font-black text-primary">₹{item.price}</span>
            )}
            <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-0.5 rounded-lg">{item.category}</span>
            {item.hasHalf && <span className="text-[9px] bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full">Half available</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggle}
            title={item.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
            className={`w-10 h-6 rounded-full transition-all duration-300 relative ${item.isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${item.isAvailable ? 'left-5' : 'left-1'}`} />
          </button>
          <button onClick={onEdit} className="p-2 rounded-xl text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors" title="Edit">✏️</button>
          <button onClick={onDelete} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function MenuEditor() {
  const { items, loading, saving, error, addItem, updateItem, deleteItem, toggleAvailability } = useMenu();
  const [activeCategory, setActiveCategory] = useState<MenuCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<NewMenuItem>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      price: item.price,
      hasHalf: item.hasHalf ?? false,
      halfPrice: item.halfPrice ?? undefined,
      category: item.category,
      isVeg: item.isVeg,
      isAvailable: item.isAvailable,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (editingItem) {
      const ok = await updateItem(editingItem._id, {
        name: form.name,
        price: form.price,
        hasHalf: form.hasHalf,
        halfPrice: form.hasHalf ? form.halfPrice : null,
        category: form.category,
        isVeg: form.isVeg,
        isAvailable: form.isAvailable,
      });
      if (ok) { showToast('Item updated!'); setShowModal(false); }
      else showToast('Update failed', 'error');
    } else {
      const ok = await addItem(form);
      if (ok) { showToast('Item added!'); setShowModal(false); }
      else showToast('Add failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteItem(id);
    if (ok) showToast('Item deleted!');
    else showToast('Delete failed', 'error');
    setConfirmDelete(null);
  };

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);
  const counts: Record<string, number> = {
    all: items.length,
    ...Object.fromEntries(CATEGORIES.map((c) => [c.value, items.filter((i) => i.category === c.value).length])),
  };

  return (
    <div className="animate-fade-in">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl shadow-xl font-black text-sm text-white animate-slide-up ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-800">Menu Editor</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">{items.length} items · Manage your menu</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-black text-sm hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
          <span className="text-lg">+</span> Add Item
        </button>
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 font-bold text-sm">⚠️ {error}</div>
      )}

      {/* Category filter */}
      <div className="mb-6 border-b border-gray-100">
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2">
          {[{ value: 'all', label: 'All', emoji: '🍽️', key: 'all' }, ...CATEGORIES.map((c) => ({ ...c, key: c.value }))].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.value as MenuCategory | 'all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all ${
                activeCategory === cat.value ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeCategory === cat.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {counts[cat.value] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
          <p className="text-primary font-black text-sm uppercase tracking-widest animate-pulse">Loading menu...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-100">
          <span className="text-6xl mb-4 opacity-40">🍽️</span>
          <h3 className="text-xl font-black text-gray-700">No items here</h3>
          <p className="text-gray-400 font-medium mt-2 text-sm">Add your first menu item to get started</p>
          <button onClick={openAdd} className="mt-6 px-6 py-3 bg-primary text-white rounded-xl font-black text-sm hover:bg-primary-dark transition-all shadow-lg shadow-primary/20">
            + Add Item
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item._id} className="relative">
              {confirmDelete === item._id ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between animate-shake">
                  <p className="font-bold text-red-700 text-sm">Delete <span className="font-black">{item.name}</span>?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl text-sm font-black text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-all">Cancel</button>
                    <button onClick={() => handleDelete(item._id)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-black text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50">
                      {saving ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <MenuItemCard
                  item={item}
                  onEdit={() => openEdit(item)}
                  onDelete={() => setConfirmDelete(item._id)}
                  onToggle={() => toggleAvailability(item)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <ItemModal
        open={showModal}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
        form={form}
        saving={saving}
        onChange={setForm}
        onSubmit={handleSubmit}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}

export default MenuEditor;

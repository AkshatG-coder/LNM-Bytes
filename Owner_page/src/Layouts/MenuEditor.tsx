import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useMenu } from '../hooks/useMenu';
import type { NewMenuItem } from '../hooks/useMenu';
import type { MenuItem, MenuCategory } from '../types';

const CATEGORIES: { value: MenuCategory; label: string }[] = [
  { value: 'snacks', label: 'Snacks' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'meals', label: 'Meals' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'other', label: 'Other' },
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

/** The standard Indian veg / non-veg mark: a square outline with a dot. */
function DietMark({ veg }: { veg: boolean }) {
  const c = veg ? 'var(--ok)' : 'var(--bad)';
  return (
    <span
      role="img"
      aria-label={veg ? 'Veg' : 'Non-veg'}
      className="inline-flex w-4 h-4 items-center justify-center rounded-[3px] border-2 flex-shrink-0"
      style={{ borderColor: c }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
    </span>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${on ? 'bg-primary' : 'bg-surface-2 border'}`}
      style={on ? undefined : { borderColor: 'var(--color-border)' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-all"
        style={{ left: on ? '1.375rem' : '0.125rem', backgroundColor: on ? '#121B2E' : 'var(--color-text-muted)' }}
      />
    </button>
  );
}

const labelCls = 'block text-[11px] font-bold uppercase tracking-widest mb-1.5';

// ─── Modal ────────────────────────────────────────────────────────────────────
function ItemModal({
  open, title, form, saving, onChange, onSubmit, onClose,
}: {
  open: boolean; title: string; form: NewMenuItem; saving: boolean;
  onChange: (updated: NewMenuItem) => void;
  onSubmit: () => void; onClose: () => void;
}) {
  if (!open) return null;
  const muted = { color: 'var(--color-text-muted)' };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 border max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="mi-name" className={labelCls} style={muted}>Item name</label>
            <input
              id="mi-name"
              type="text"
              placeholder="e.g. Samosa, Chai, Burger"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="mi-price" className={labelCls} style={muted}>{form.hasHalf ? 'Full portion price (₹)' : 'Price (₹)'}</label>
            <input
              id="mi-price"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="0"
              value={form.price || ''}
              onChange={(e) => onChange({ ...form, price: parseFloat(e.target.value) || 0 })}
              className="field tnum"
            />
          </div>

          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-2">
            <div>
              <p className="font-bold text-sm">Has a half portion</p>
              <p className="text-xs mt-0.5" style={muted}>Offer a smaller portion at a lower price</p>
            </div>
            <Switch
              on={!!form.hasHalf}
              label="Has a half portion"
              onChange={() => onChange({ ...form, hasHalf: !form.hasHalf, halfPrice: !form.hasHalf ? undefined : form.halfPrice })}
            />
          </div>

          {form.hasHalf && (
            <div className="animate-fade-in">
              <label htmlFor="mi-half" className={labelCls} style={muted}>Half portion price (₹)</label>
              <input
                id="mi-half"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0"
                value={form.halfPrice || ''}
                onChange={(e) => onChange({ ...form, halfPrice: parseFloat(e.target.value) || 0 })}
                className="field tnum"
              />
              {form.price > 0 && (form.halfPrice || 0) > 0 && (
                <p className="text-xs mt-1.5" style={muted}>Full ₹{form.price} · Half ₹{form.halfPrice}</p>
              )}
            </div>
          )}

          <div>
            <span className={labelCls} style={muted}>Category</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((cat) => {
                const on = form.category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange({ ...form, category: cat.value })}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-bold border ${on ? 'bg-primary text-on-primary border-transparent' : 'hover:bg-surface-2'}`}
                    style={on ? undefined : { borderColor: 'var(--color-border)' }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange({ ...form, isVeg: !form.isVeg })}
              className="flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm border hover:bg-surface-2"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <DietMark veg={form.isVeg} /> {form.isVeg ? 'Veg' : 'Non-veg'}
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...form, isAvailable: !form.isAvailable })}
              className="flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm border hover:bg-surface-2"
              style={{ borderColor: 'var(--color-border)', color: form.isAvailable ? 'var(--ok)' : 'var(--color-text-muted)' }}
            >
              {form.isAvailable ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {form.isAvailable ? 'Available' : 'Unavailable'}
            </button>
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={saving || !form.name.trim() || form.price <= 0 || (form.hasHalf && !form.halfPrice)}
          className="mt-6 w-full py-3.5 bg-primary text-on-primary rounded-lg font-extrabold text-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : title}
        </button>

        {form.hasHalf && !form.halfPrice && (
          <p className="mt-2 text-center text-xs font-bold" style={{ color: 'var(--bad)' }}>Half price is required when half portion is enabled</p>
        )}
      </div>
    </div>
  );
}

// ─── Menu item row ────────────────────────────────────────────────────────────
function MenuItemCard({
  item, onEdit, onDelete, onToggle,
}: { item: MenuItem; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  return (
    <div
      className={`rounded-xl border ${item.isAvailable ? '' : 'opacity-60'}`}
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="p-3.5 sm:p-4 flex items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <DietMark veg={item.isVeg} />
            <h3 className="font-bold truncate">{item.name}</h3>
          </div>
          <div className="mt-1 flex items-baseline gap-x-2 gap-y-0.5 flex-wrap text-sm">
            {item.hasHalf && item.halfPrice ? (
              <>
                <span className="font-extrabold tnum">₹{item.price} <span className="font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>full</span></span>
                <span className="font-extrabold tnum">₹{item.halfPrice} <span className="font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>half</span></span>
              </>
            ) : (
              <span className="font-extrabold tnum">₹{item.price}</span>
            )}
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{item.category}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Switch on={item.isAvailable} onChange={onToggle} label={item.isAvailable ? `Mark ${item.name} unavailable` : `Mark ${item.name} available`} />
          <span className="hidden sm:inline text-xs font-bold w-20 pl-2" style={{ color: item.isAvailable ? 'var(--ok)' : 'var(--color-text-muted)' }}>
            {item.isAvailable ? 'Available' : 'Sold out'}
          </span>
          <button onClick={onEdit} aria-label={`Edit ${item.name}`} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface-2"><Pencil className="w-4 h-4" /></button>
          <button onClick={onDelete} aria-label={`Delete ${item.name}`} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface-2" style={{ color: 'var(--bad)' }}><Trash2 className="w-4 h-4" /></button>
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
    <div className="animate-fade-in max-w-4xl">
      {toast && (
        <div
          role="status"
          className="fixed top-16 md:top-6 right-4 md:right-6 z-50 px-5 py-3 rounded-lg shadow-xl font-bold text-sm text-white animate-slide-up"
          style={{ backgroundColor: toast.type === 'success' ? '#15803D' : '#C62828' }}
        >
          {toast.msg}
        </div>
      )}

      <header className="flex justify-between items-end gap-3 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{items.length} items</p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Menu</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-on-primary rounded-lg font-extrabold text-sm hover:bg-primary-dark active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" /> Add item
        </button>
      </header>

      {error && (
        <div role="alert" className="mb-6 p-4 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}>{error}</div>
      )}

      <div className="mb-5 flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Category">
        {[{ value: 'all', label: 'All' }, ...CATEGORIES].map((cat) => {
          const on = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value as MenuCategory | 'all')}
              aria-pressed={on}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-bold whitespace-nowrap border ${on ? 'bg-primary text-on-primary border-transparent' : 'hover:bg-surface-2'}`}
              style={on ? undefined : { borderColor: 'var(--color-border)' }}
            >
              {cat.label}
              <span className={`min-w-5 px-1.5 py-0.5 text-[11px] leading-none rounded-full tnum text-center ${on ? 'bg-[#121B2E] text-white' : 'bg-surface-2'}`}>
                {counts[cat.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading menu">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[72px] rounded-xl animate-pulse bg-surface-2" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border-2 border-dashed" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="font-display text-lg font-bold">No items here</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Add your first menu item to get started.</p>
          <button onClick={openAdd} className="mt-5 flex items-center gap-1.5 px-5 py-2.5 bg-primary text-on-primary rounded-lg font-extrabold text-sm hover:bg-primary-dark">
            <Plus className="w-4 h-4" /> Add item
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => (
            <div key={item._id}>
              {confirmDelete === item._id ? (
                <div
                  className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 border"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--bad)' }}
                >
                  <p className="font-semibold text-sm">Delete <span className="font-extrabold">{item.name}</span>? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-bold border hover:bg-surface-2" style={{ borderColor: 'var(--color-border)' }}>Keep</button>
                    <button onClick={() => handleDelete(item._id)} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#C62828' }}>
                      {saving ? '…' : 'Delete'}
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
        title={editingItem ? 'Edit item' : 'Add new item'}
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

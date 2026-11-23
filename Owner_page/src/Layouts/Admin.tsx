import { useState } from 'react';
import { RefreshCw, Flame, ChefHat, BellRing, IndianRupee } from 'lucide-react';
import { StatsCard } from '../components/StatsCard';
import TabButton from '../components/TabFilter';
import EmptyState from '../components/EmptyState';
import UserAccordion from '../components/UserAccordion';
import DemandHints from '../components/DemandHints';
import { useOrders } from '../hooks/useOrders';
import { type OrderStatus } from '../types';

// flow is: pending -> preparing -> ready
const TABS: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'New' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
  { status: 'cancelled', label: 'Cancelled' },
];

function Admin() {
  const {
    users, loading, error,
    acceptOrder, rejectOrder, markReady,
    refreshOrders,
  } = useOrders();

  const [activeTab, setActiveTab] = useState<OrderStatus>('pending');

  const count = (s: OrderStatus) => users.filter(u => u.status === s).length;

  const revenue = users
    .filter(u => u.status === 'ready' || u.status === 'delivered')
    .reduce((acc, u) => acc + (u.totalAmount ?? 0), 0);

  const filteredUsers = users.filter(u => u.status === activeTab);
  const newCount = count('pending');

  return (
    <div className="animate-fade-in max-w-5xl">
      <header className="flex justify-between items-end gap-3 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Kitchen</h1>
        </div>
        <button
          onClick={refreshOrders}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold border disabled:opacity-50 hover:bg-surface-2"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="mb-6 p-4 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}>
          {error}. Make sure the backend is running.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatsCard title="New" value={newCount} Icon={Flame} tone={newCount > 0 ? 'alert' : 'default'} hint={newCount > 0 ? 'Waiting for you' : 'All caught up'} />
        <StatsCard title="Preparing" value={count('preparing')} Icon={ChefHat} />
        <StatsCard title="Ready" value={count('ready')} Icon={BellRing} hint="Waiting for pickup" />
        <StatsCard title="Revenue" value={`₹${revenue}`} Icon={IndianRupee} tone="ink" hint="Ready + delivered" />
      </div>

      <DemandHints />

      <div
        className="mb-5 sticky top-14 md:top-0 z-10 py-3 -mx-4 px-4 lg:-mx-8 lg:px-8"
        style={{ backgroundColor: 'var(--color-background)' }}
        role="group"
        aria-label="Order status"
      >
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <TabButton
              key={t.status}
              label={t.label}
              count={count(t.status)}
              active={activeTab === t.status}
              onClick={() => setActiveTab(t.status)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 pb-10">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading orders">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-24 rounded-xl animate-pulse bg-surface-2" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState message={`No ${activeTab === 'pending' ? 'new' : activeTab} orders`} />
        ) : (
          filteredUsers.map(user => (
            <UserAccordion
              key={user.userId}
              {...user}
              onAccept={acceptOrder}
              onReject={rejectOrder}
              onReady={markReady}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default Admin;

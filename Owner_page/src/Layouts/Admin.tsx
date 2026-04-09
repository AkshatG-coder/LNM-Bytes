import { useState } from 'react';
import { StatsCard } from '../components/StatsCard';
import TabButton from '../components/TabFilter';
import EmptyState from '../components/EmptyState';
import UserAccordion from '../components/UserAccordion';
import { useOrders } from '../hooks/useOrders';
import { type OrderStatus } from '../types';

// "accepted" tab removed — flow is: pending → preparing → ready
const TABS: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'pending',   label: 'New Orders', icon: '🔥' },
  { status: 'preparing', label: 'Preparing',  icon: '🍳' },
  { status: 'ready',     label: 'Ready',      icon: '✅' },
  { status: 'cancelled', label: 'Cancelled',  icon: '❌' },
];

function Admin() {
  const {
    users, loading, error,
    acceptOrder, rejectOrder, markReady,
    refreshOrders
  } = useOrders();

  const [activeTab, setActiveTab] = useState<OrderStatus>('pending');

  const count = (s: OrderStatus) => users.filter(u => u.status === s).length;

  const revenue = users
    .filter(u => u.status === 'ready' || u.status === 'delivered')
    .reduce((acc, u) => acc + (u.totalAmount ?? 0), 0);

  const filteredUsers = users.filter(u => u.status === activeTab);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-main)' }}>
            Kitchen Dashboard
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Live order updates · auto-refreshes every 15s
          </p>
        </div>
        <button
          onClick={refreshOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all shadow-sm disabled:opacity-50 border"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--border)', color: 'inherit' }}
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-400 font-bold text-sm">
          ⚠️ {error}. Make sure the backend is running.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="New Orders"  value={count('pending')}   icon="🔥" color="text-secondary-dark" bg="bg-secondary-light/10"  borderColor="border-secondary-light/20" />
        <StatsCard title="Preparing"   value={count('preparing')} icon="🍳" color="text-primary"        bg="bg-primary-light/10"    borderColor="border-primary-light/20"   />
        <StatsCard title="Ready"       value={count('ready')}     icon="✅" color="text-green-600"      bg="bg-green-50"            borderColor="border-green-100"           />
        <StatsCard title="Revenue"     value={`₹${revenue}`}      icon="💰" color="text-white"          bg="bg-gradient-to-r from-primary to-primary-dark" borderColor="border-primary-dark/20" />
      </div>

      {/* Tabs */}
      <div
        className="mb-6 border-b sticky top-0 backdrop-blur z-10 pt-2 transition-colors duration-300"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--color-background)', opacity: 0.97 }}
      >
        <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
          {TABS.map(t => (
            <TabButton
              key={t.status}
              label={`${t.icon} ${t.label}`}
              count={count(t.status)}
              active={activeTab === t.status}
              onClick={() => setActiveTab(t.status)}
            />
          ))}
        </div>
      </div>

      {/* Order list */}
      <div className="space-y-4 pb-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
            <p className="text-primary font-black text-sm uppercase tracking-widest animate-pulse">
              Loading orders...
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState message={`No ${activeTab} orders`} />
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
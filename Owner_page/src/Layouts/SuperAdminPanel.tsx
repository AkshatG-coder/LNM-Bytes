import { useState, useEffect } from 'react';
import api from '../hooks/api';
import type { OwnerRecord } from '../types';

function SuperAdminPanel() {
  const [owners, setOwners] = useState<OwnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchOwners = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/auth/superadmin/owners');
      if (res.data?.success) setOwners(res.data.data || []);
      else setError('Failed to load owners.');
    } catch {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOwners(); }, []);

  const approve = async (owner: OwnerRecord) => {
    try {
      setActionId(owner._id);
      await api.patch(`/auth/superadmin/approve/${owner._id}`);
      await fetchOwners();
      showToast(`✅ ${owner.name}'s store is now active!`);
    } catch {
      showToast('Failed to approve.', 'error');
    } finally {
      setActionId(null);
    }
  };

  const revoke = async (owner: OwnerRecord) => {
    if (!window.confirm(`Revoke access for ${owner.name}? Their store will be deactivated.`)) return;
    try {
      setActionId(owner._id);
      await api.patch(`/auth/superadmin/revoke/${owner._id}`);
      await fetchOwners();
      showToast(`⛔ ${owner.name}'s access revoked.`);
    } catch {
      showToast('Failed to revoke.', 'error');
    } finally {
      setActionId(null);
    }
  };

  const reject = async (owner: OwnerRecord) => {
    if (!window.confirm(`Are you sure you want to reject the request for ${owner.name}? Their data will be deleted.`)) return;
    try {
      setActionId(owner._id);
      await api.delete(`/auth/superadmin/reject/${owner._id}`);
      await fetchOwners();
      showToast(`🗑️ ${owner.name}'s request rejected and deleted.`);
    } catch {
      showToast('Failed to reject.', 'error');
    } finally {
      setActionId(null);
    }
  };

  const pending  = owners.filter(o => !o.isApproved && o.role !== 'superadmin');
  const approved = owners.filter(o =>  o.isApproved && o.role !== 'superadmin');
  const list = activeTab === 'pending' ? pending : approved;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl shadow-xl font-black text-sm text-white animate-slide-up ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-main)' }}>Store Approvals</h1>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-text-muted, #94a3b8)' }}>
          Review and manage canteen owner access requests
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-5">
          <div className="rounded-2xl border p-4" style={{ backgroundColor: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.25)' }}>
            <div className="text-3xl font-black text-yellow-400">{pending.length}</div>
            <div className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: '#ca8a04' }}>Pending Approval</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)' }}>
            <div className="text-3xl font-black text-green-400">{approved.length}</div>
            <div className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: '#16a34a' }}>Approved Stores</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${
            activeTab === 'pending' ? 'bg-yellow-500 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'
          }`}
        >
          ⏳ Pending
          {pending.length > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${activeTab === 'pending' ? 'bg-white/25' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${
            activeTab === 'approved' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'
          }`}
        >
          ✅ Approved ({approved.length})
        </button>
        <button
          onClick={fetchOwners}
          disabled={loading}
          className="ml-auto px-4 py-2.5 rounded-xl text-sm font-black text-gray-400 hover:bg-gray-800 transition-all disabled:opacity-50"
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl border text-sm font-bold text-red-400" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Owner list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
          <p className="text-yellow-400 font-black text-sm uppercase tracking-widest animate-pulse">Loading...</p>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-3xl border-2 border-dashed border-gray-700">
          <span className="text-5xl mb-4 opacity-40">{activeTab === 'pending' ? '✅' : '🏪'}</span>
          <p className="font-black text-gray-400">
            {activeTab === 'pending' ? 'No pending requests — you\'re all caught up!' : 'No approved stores yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(owner => (
            <div
              key={owner._id}
              className="rounded-2xl border p-5 flex items-center gap-4 transition-all"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'rgba(51,65,85,0.8)' }}
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-black text-lg flex-shrink-0">
                {owner.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-gray-100">{owner.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${
                    owner.isApproved
                      ? 'bg-green-900/40 text-green-300 border-green-700/40'
                      : 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40'
                  }`}>
                    {owner.isApproved ? '✅ Active' : '⏳ Pending'}
                  </span>
                </div>
                <div className="text-xs text-blue-400 font-medium mt-0.5 truncate">{owner.email}</div>
                {owner.storeId && (
                  <div className="text-xs font-medium mt-0.5" style={{ color: '#94a3b8' }}>
                    🏪 <span className="font-bold text-gray-300">{owner.storeId.name}</span>
                    {owner.storeId.location && <span className="text-gray-500"> · {owner.storeId.location}</span>}
                  </div>
                )}
                <div className="text-[10px] text-gray-600 mt-0.5">
                  Registered {new Date(owner.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Action */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {!owner.isApproved ? (
                  <>
                    <button
                      onClick={() => reject(owner)}
                      disabled={actionId === owner._id}
                      className="px-4 py-2.5 rounded-xl text-sm font-black text-red-500 hover:text-white hover:bg-red-600 border border-red-500/30 hover:border-transparent transition-all active:scale-95 disabled:opacity-50"
                    >
                      {actionId === owner._id ? '⏳' : '❌ Reject'}
                    </button>
                    <button
                      onClick={() => approve(owner)}
                      disabled={actionId === owner._id}
                      className="px-6 py-2.5 rounded-xl text-sm font-black text-white bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {actionId === owner._id ? '⏳' : '✅ Approve'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => revoke(owner)}
                    disabled={actionId === owner._id}
                    className="px-6 py-2.5 rounded-xl text-sm font-black text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-transparent hover:border-red-800/40 transition-all disabled:opacity-50"
                  >
                    {actionId === owner._id ? '⏳' : '⛔ Revoke'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SuperAdminPanel;

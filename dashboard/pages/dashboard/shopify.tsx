import React, { useEffect, useState } from 'react';
import ShopifyConnect from '../../components/ShopifyConnect';
import StoresList from '../../components/StoresList';
import FunnelGraph from '../../components/FunnelGraph';
import { getFirebaseApp } from '../../lib/firebaseClient';

export default function ShopifyDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getToken() {
    const { auth } = getFirebaseApp();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return await user.getIdToken();
  }

  async function loadStats() {
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load stats');
      setStats(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <ShopifyConnect getToken={getToken} />
      <StoresList getToken={getToken} onDisconnected={() => loadStats()} />

      <div className="p-4 border rounded bg-white">
        <h3 className="text-lg font-semibold mb-2">Email Funnel</h3>
        {loading && <div>Loading stats...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {stats && <FunnelGraph data={stats.funnel} />}
      </div>
    </div>
  );
}





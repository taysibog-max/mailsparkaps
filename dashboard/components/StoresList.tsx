import React, { useEffect, useState } from 'react';

type StoreInfo = {
  id: string;
  shop: string;
  active: boolean;
  connectedAt?: { seconds?: number; nanoseconds?: number } | Date;
};

type Props = {
  getToken: () => Promise<string>;
  onDisconnected?: (id: string) => void;
};

export default function StoresList({ getToken, onDisconnected }: Props) {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/shopify/stores', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load stores');
      setStores(data.stores || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function disconnectStore(id: string) {
    try {
      const token = await getToken();
      const res = await fetch('/api/shopify/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect');
      onDisconnected?.(id);
      load();
    } catch (e) {
      // noop
    }
  }

  if (loading) return <div className="p-4">Loading stores...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="grid gap-3">
      {stores.map((s) => (
        <div key={s.id} className="p-3 border rounded flex items-center justify-between bg-white">
          <div>
            <div className="font-medium">{s.shop}</div>
            <div className="text-sm text-gray-500">Status: {s.active ? 'Active' : 'Disconnected'}</div>
          </div>
          <div>
            {s.active && (
              <button onClick={() => disconnectStore(s.id)} className="px-3 py-1 border rounded hover:bg-gray-50">Disconnect</button>
            )}
          </div>
        </div>
      ))}
      {stores.length === 0 && <div className="text-gray-500">No stores connected yet.</div>}
    </div>
  );
}





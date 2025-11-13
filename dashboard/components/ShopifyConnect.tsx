import React, { useState } from 'react';
import { motion } from 'framer-motion';

type Props = {
  getToken: () => Promise<string>;
};

export default function ShopifyConnect({ getToken }: Props) {
  const [shop, setShop] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startAuth() {
    setError(null);
    if (!shop) return setError('Enter your shop domain');
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/shopify/auth?shop=${encodeURIComponent(shop)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start auth');
      window.location.href = data.authUrl;
    } catch (e: any) {
      setError(e?.message || 'Failed to start auth');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <img src="/icons/shopify.svg" alt="Shopify" className="w-6 h-6" />
        <h3 className="text-lg font-semibold">Connect Shopify Store</h3>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="your-store.myshopify.com"
          className="input input-bordered w-full border rounded px-3 py-2"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={startAuth}
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Redirecting...' : 'Connect'}
        </motion.button>
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}





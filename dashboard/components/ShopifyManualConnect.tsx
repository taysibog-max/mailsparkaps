import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getFirebaseApp } from '../lib/firebaseClient';
import { LoadingSpinner } from './LoadingSkeleton';
import HowToCreateShopifyToken from './HowToCreateShopifyToken';

interface ApiResponse {
  ok: boolean;
  error?: string;
  shopDomain?: string;
}

export default function ShopifyManualConnect() {
  const [shopDomain, setShopDomain] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uid, setUid] = useState('');

  useEffect(() => {
    try {
      const { auth } = getFirebaseApp();
      if (auth.currentUser?.uid) {
        setUid(auth.currentUser.uid);
        return;
      }
      const unsub = auth.onAuthStateChanged((user) => {
        setUid(user?.uid || '');
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    } catch (err) {
      console.error('[ShopifyManualConnect] Failed to bind auth state:', err);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!uid) {
      setError('Please sign in again to connect Shopify.');
      return;
    }

    const cleanedDomain = shopDomain.trim().toLowerCase();
    const cleanedToken = token.trim();
    if (!cleanedDomain.endsWith('.myshopify.com')) {
      setError('Shop domain must end with .myshopify.com');
      return;
    }
    if (cleanedToken.length < 20) {
      setError('Admin API token looks too short.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/shopify/manual-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopDomain: cleanedDomain,
          token: cleanedToken,
          uid,
        }),
      });
      const data: ApiResponse = await response.json().catch(() => ({ ok: false, error: 'unknown_error' }));
      if (!data.ok) {
        setError(data.error || 'Failed to connect Shopify store.');
        setSuccess(null);
      } else {
        setSuccess(`Connected to ${data.shopDomain}.`);
        setToken('');
      }
    } catch (_err) {
      setError('Network error while connecting Shopify.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-zinc-950/60 shadow-[0_10px_30px_rgba(0,0,0,0.25)] p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-fuchsia-300/80">Shopify Integration</p>
          <h2 className="text-xl font-semibold text-white">Manual Connect</h2>
        </div>
        {loading && <LoadingSpinner size="sm" />}
      </div>
      <p className="mb-4 text-sm text-neutral-300">
        Enter your <span className="font-semibold text-white">.myshopify.com</span> domain and Admin API token. We’ll verify
        access instantly and encrypt your token on our servers.
      </p>
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      )}
      <form className="space-y-3" onSubmit={handleSubmit}>
        <input
          className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 text-white placeholder:text-zinc-500 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
          placeholder="brand.myshopify.com"
          value={shopDomain}
          onChange={(e) => setShopDomain(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <textarea
          className="min-h-[110px] w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
          placeholder="Admin API access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-600 px-5 py-2.5 font-semibold text-white shadow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Connecting…' : 'Connect Shopify'}
        </button>
      </form>
      <HowToCreateShopifyToken />
    </motion.div>
  );
}



import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LoadingSpinner } from '../LoadingSkeleton';

export interface ShopifyStatus {
  connected: boolean;
  shopDomain?: string;
  lastSynced?: string | null;
}

const fallbackStatus: ShopifyStatus = {
  connected: false,
  lastSynced: null,
};

const statusStyles = {
  connected: 'border-emerald-700/40 bg-emerald-500/10 text-emerald-300',
  disconnected: 'border-rose-700/40 bg-rose-500/10 text-rose-300',
};

function StatusDot({ variant }: { variant: 'connected' | 'disconnected' }) {
  const color = variant === 'connected' ? 'bg-emerald-400' : 'bg-rose-500';
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-75 animate-ping`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

function StatusPill({ status, loading }: { status: ShopifyStatus; loading: boolean }) {
  const variant = status.connected ? 'connected' : 'disconnected';
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full border inline-flex items-center gap-2 ${statusStyles[variant]}`}
    >
      <StatusDot variant={variant} />
      {loading ? 'Checking…' : status.connected ? 'Connected' : 'Not Connected'}
    </span>
  );
}

function formatLastSynced(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
}

export function ShopifyIntegrationCard() {
  const [storeDomain, setStoreDomain] = useState('');
  const [status, setStatus] = useState<ShopifyStatus>(fallbackStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function fetchStatus() {
      try {
        const response = await fetch('/api/user/integrations', { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to load integrations');

        const payload = await response.json().catch(() => ({}));
        const shopifyData =
          payload?.shopify ??
          payload?.integrations?.shopify ??
          payload?.data?.shopify ??
          payload?.data?.integrations?.shopify;

        const nextStatus: ShopifyStatus = {
          connected: Boolean(shopifyData?.connected),
          shopDomain:
            shopifyData?.shopDomain ||
            shopifyData?.domain ||
            shopifyData?.shop ||
            shopifyData?.shopifyDomain ||
            '',
          lastSynced: shopifyData?.lastSynced ?? shopifyData?.lastSyncAt ?? null,
        };

        setStatus(
          nextStatus.connected || nextStatus.shopDomain || nextStatus.lastSynced ? nextStatus : fallbackStatus,
        );
        setStoreDomain((nextStatus.shopDomain || '').toString());
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setStatus(fallbackStatus);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    return () => controller.abort();
  }, []);

  function normalizeDomain(raw: string) {
    return raw.trim().replace(/^https?:\/\//i, '').split('/')[0];
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const normalized = normalizeDomain(storeDomain);

    if (!normalized) {
      setError('Store domain is required');
      return;
    }

    const target = `/api/shopify/auth?shop=${encodeURIComponent(normalized)}`;
    if (typeof window !== 'undefined') {
      window.location.href = target;
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-zinc-950/60 shadow-[0_10px_30px_rgba(0,0,0,0.25)] p-6"
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="text-lg font-semibold text-white">Shopify</div>
          <p className="text-sm text-neutral-400">Connect your Shopify store in a few seconds.</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <LoadingSpinner size="sm" />}
          <StatusPill status={status} loading={loading} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-400">Store Domain</span>
          <input
            type="text"
            placeholder="example.myshopify.com"
            className="w-full h-11 rounded-xl bg-zinc-900/70 text-white placeholder:text-zinc-500 px-3 focus:outline-none focus:ring-2 focus:ring-pink-500/60"
            value={storeDomain}
            onChange={(event) => setStoreDomain(event.target.value)}
          />
        </label>

        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 font-medium text-white transition hover:brightness-110"
          style={{ backgroundColor: '#ff40a1' }}
        >
          Connect Store
        </button>
      </form>

      <div className="mt-4 text-xs text-neutral-400">
        Last synced: <span className="text-neutral-200">{formatLastSynced(status.lastSynced)}</span>
      </div>

      {error && <div className="mt-2 text-xs text-rose-400">{error}</div>}
    </motion.div>
  );
}

export default ShopifyIntegrationCard;


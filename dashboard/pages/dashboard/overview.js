import AppShell from '../../components/AppShell';
import RequireAuth from '../../components/RequireAuth';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../lib/apiClient';
import { useProgressBar } from '../../components/ProgressBar';
import { LoadingSpinner } from '../../components/LoadingSkeleton';
import { useStore } from '../../context/StoreContext';
import { getFirebaseApp } from '../../lib/firebaseClient';
import { ref, get } from 'firebase/database';
import { BarChart3, Megaphone, Mail, Users } from 'lucide-react';

export default function OverviewPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Overview />
      </AppShell>
    </RequireAuth>
  );
}

function Overview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    newContactsLast7Days: 0,
    activeCampaigns: 0,
    emailsSentToday: 0,
    emailsSentThisWeek: 0,
    totalContacts: 0
  });
  const [storeStatus, setStoreStatus] = useState({ connected: false, platform: null, lastSync: null, storeUrl: null });
  const [recentContacts, setRecentContacts] = useState([]);
  const progressBar = useProgressBar();
  const { isConnected, store } = useStore();

  // Load all data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      progressBar.start();

      const { auth, db } = getFirebaseApp();
      const user = auth.currentUser;

      if (!user) {
        setLoading(false);
        progressBar.complete();
        return;
      }

      progressBar.update(20);

      // Load store status from API (which checks RTDB)
      let platform = null;
      let lastSync = null;
      let storeUrl = null;

      try {
        const [wooStatus, shopifyStatus] = await Promise.all([
          apiGet('/api/integrations/woo/status').catch(() => null),
          apiGet('/api/shopify/status').catch(() => null)
        ]);

        if (wooStatus?.store) {
          platform = 'woocommerce';
          lastSync = wooStatus.store.lastSynced || wooStatus.store.connectedAt;
          storeUrl = wooStatus.store.shopUrl || wooStatus.store.storeUrl;
        } else if (shopifyStatus?.store) {
          platform = 'shopify';
          lastSync = shopifyStatus.store.lastSynced || shopifyStatus.store.connectedAt;
          storeUrl = shopifyStatus.store.shop || shopifyStatus.store.storeUrl;
        }
      } catch (e) {
        console.error('Failed to load store status:', e);
      }

      setStoreStatus({ connected: !!platform, platform, lastSync, storeUrl });

      progressBar.update(40);

      // Load contacts
      let contacts = [];
      try {
        const contactsResp = await apiGet('/api/contacts');
        contacts = contactsResp?.contacts || [];
      } catch (e) {
        console.error('Failed to load contacts:', e);
      }

      progressBar.update(60);

      // Calculate stats
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const startOfToday = new Date().setHours(0, 0, 0, 0);
      const startOfWeek = now - 7 * 24 * 60 * 60 * 1000;

      const newContactsLast7Days = contacts.filter(c => {
        const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
        return created >= sevenDaysAgo;
      }).length;

      // Get recent 5 contacts (sorted by createdAt)
      const sorted = [...contacts].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      setRecentContacts(sorted.slice(0, 5));

      progressBar.update(80);

      setStats({
        newContactsLast7Days,
        activeCampaigns: 0, // TODO: Implement campaigns count
        emailsSentToday: 0, // TODO: Implement from email logs
        emailsSentThisWeek: 0, // TODO: Implement from email logs
        totalContacts: contacts.length
      });

      progressBar.update(100);
      progressBar.complete();
    } catch (e) {
      console.error('Failed to load dashboard:', e);
      progressBar.reset();
    } finally {
      setLoading(false);
    }
  }


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-neutral-300">
          <LoadingSpinner size="sm" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-neutral-400">Welcome back! Here's what's happening.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="New Contacts (7 days)"
          value={stats.newContactsLast7Days}
          Icon={BarChart3}
          color="from-blue-500 to-cyan-500"
        />
        <StatCard
          label="Active Campaigns"
          value={stats.activeCampaigns}
          Icon={Megaphone}
          color="from-fuchsia-500 to-pink-500"
        />
        <StatCard
          label="Emails Sent Today"
          value={stats.emailsSentToday}
          Icon={Mail}
          color="from-emerald-500 to-teal-500"
        />
        <StatCard
          label="Total Contacts"
          value={stats.totalContacts}
          Icon={Users}
          color="from-purple-500 to-indigo-500"
        />
      </div>

      {/* Store Status */}
      <div className="rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/40 to-zinc-900/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Store Connection</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {storeStatus.connected ? (
            <>
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="font-medium">Connected</span>
              </div>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-400 capitalize">{storeStatus.platform}</span>
              {storeStatus.storeUrl && (
                <>
                  <span className="text-neutral-600">•</span>
                  <a 
                    href={storeStatus.storeUrl.startsWith('http') ? storeStatus.storeUrl : `https://${storeStatus.storeUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-fuchsia-400 hover:text-fuchsia-300 underline"
                  >
                    {storeStatus.storeUrl}
                  </a>
                </>
              )}
              {storeStatus.lastSync && (
                <>
                  <span className="text-neutral-600">•</span>
                  <span className="text-xs text-neutral-500">
                    Last sync: {new Date(storeStatus.lastSync).toLocaleString()}
                  </span>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-rose-400">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <span className="font-medium">Not Connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Contacts Table */}
      <div className="rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/40 to-zinc-900/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800/60">
          <h3 className="text-lg font-semibold text-white">Last 5 Imported Contacts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-900/60">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">Imported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {recentContacts.length > 0 ? (
                recentContacts.map((contact, idx) => (
                  <tr key={contact.email} className="hover:bg-zinc-900/40 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                          {contact.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{contact.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-800/80 border border-zinc-700/60 text-neutral-300 capitalize">
                        {contact.sourceStore || contact.source || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-400">
                      {contact.createdAt 
                        ? new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Unknown'
                      }
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <div className="text-neutral-500">No contacts yet</div>
                    <div className="text-sm text-neutral-600 mt-1">Connect your store to start importing contacts</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Stats - Placeholder for future chart */}
      <div className="rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/40 to-zinc-900/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Email Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MiniStat label="Opens" value={0} percentage={0} />
          <MiniStat label="Clicks" value={0} percentage={0} />
          <MiniStat label="Delivered" value={stats.emailsSentThisWeek} percentage={100} />
        </div>
        <div className="mt-4 text-center text-sm text-neutral-500">
          Email tracking coming soon
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, Icon, color }) {
  return (
    <div className="relative rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/40 to-zinc-900/20 p-5 hover:border-fuchsia-500/30 transition-all group overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${color} bg-opacity-10`}>
            <Icon className="h-6 w-6 text-white" strokeWidth={2} />
          </div>
          <div className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${color} text-white font-medium animate-pulse`}>
            Live
          </div>
        </div>
        <div className="text-3xl font-bold text-white mb-1">
          <AnimatedNumber value={value} />
        </div>
        <div className="text-sm text-neutral-400">{label}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, percentage }) {
  return (
    <div className="rounded-lg bg-zinc-900/60 p-4 border border-zinc-800/40">
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-neutral-400 mb-2">{label}</div>
      <div className="w-full bg-zinc-800 rounded-full h-1.5">
        <div 
          className="bg-gradient-to-r from-fuchsia-500 to-purple-600 h-1.5 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const duration = 800;
    const from = display;
    const to = Number(value) || 0;
    function tick(t) {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}



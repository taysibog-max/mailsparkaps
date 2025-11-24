import AppShell from '../../../components/AppShell';
import RequireAuth from '../../../components/RequireAuth';
import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../../context/StoreContext';
import { apiGet } from '../../../lib/apiClient';
import {
  ShoppingCart, Mail, Gift, Star, RefreshCcw, Plus, Zap, TrendingUp, Eye, AlertCircle, Store,
  Activity, BarChart3, Clock, Users, DollarSign, Target, Play, Pause, Edit2, Trash2,
  CheckCircle, XCircle, Send, TrendingDown
} from 'lucide-react';
import { useProgressBar } from '../../../components/ProgressBar';
import { LoadingSpinner } from '../../../components/LoadingSkeleton';
import CampaignModal from '../../../components/CampaignModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function CampaignsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <CampaignsContent />
      </AppShell>
    </RequireAuth>
  );
}

function CampaignsContent() {
  const { isConnected } = useStore();
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState(null); // 'woocommerce' | null
  const [connReady, setConnReady] = useState(false); // finished connection status check
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, my-campaigns, create, analytics
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [modalCampaignType, setModalCampaignType] = useState('');
  const [brevoCampaigns, setBrevoCampaigns] = useState([]);
  const [automatedCampaigns, setAutomatedCampaigns] = useState([]);
  const [campaignStats, setCampaignStats] = useState(null);
  const [funnel, setFunnel] = useState({ abandoned: 0, sent: 0, opened: 0, clicked: 0, recovered: 0 });
  const [abandonedList, setAbandonedList] = useState([]);
  const progressBar = useProgressBar();

  // Campaign type definitions
  const campaignTypes = [
    {
      type: 'abandoned_cart',
      title: 'Abandoned Cart',
      description: 'Automatically recover lost sales when customers leave items in cart',
      icon: ShoppingCart,
      gradient: 'from-orange-500 via-red-500 to-pink-600',
      bg: 'from-orange-500/10 to-red-500/10',
      border: 'border-orange-500/30',
      iconColor: 'text-orange-400',
      automated: true,
      trigger: '30 minutes after cart abandonment',
    },
    {
      type: 'welcome_email',
      title: 'Welcome Email',
      description: 'Automatically greet new customers when they sign up',
      icon: Mail,
      gradient: 'from-blue-500 via-cyan-500 to-teal-500',
      bg: 'from-blue-500/10 to-cyan-500/10',
      border: 'border-blue-500/30',
      iconColor: 'text-blue-400',
      automated: false,
      trigger: 'Coming soon',
      comingSoon: true,
    },
    {
      type: 'post_purchase',
      title: 'Post Purchase',
      description: 'Automatically thank customers after successful purchase',
      icon: Gift,
      gradient: 'from-emerald-500 via-green-500 to-teal-500',
      bg: 'from-emerald-500/10 to-teal-500/10',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
      automated: false,
      trigger: 'Coming soon',
      comingSoon: true,
    },
    {
      type: 'review_request',
      title: 'Review Request',
      description: 'Automatically ask for reviews 7 days after delivery',
      icon: Star,
      gradient: 'from-yellow-500 via-amber-500 to-orange-500',
      bg: 'from-yellow-500/10 to-amber-500/10',
      border: 'border-yellow-500/30',
      iconColor: 'text-yellow-400',
      automated: false,
      trigger: 'Coming soon',
      comingSoon: true,
    },
    {
      type: 'reactivation',
      title: 'Reactivation',
      description: 'Automatically re-engage inactive customers after 30 days',
      icon: RefreshCcw,
      gradient: 'from-purple-500 via-fuchsia-500 to-pink-500',
      bg: 'from-purple-500/10 to-pink-500/10',
      border: 'border-purple-500/30',
      iconColor: 'text-purple-400',
      automated: false,
      trigger: 'Coming soon',
      comingSoon: true,
    },
  ];

  // Tabs configuration
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'my-campaigns', label: 'My Campaigns', icon: Target },
    { id: 'create', label: 'Create New', icon: Plus },
  ];

  // Detect connection platform as a fallback if context isn't hydrated yet
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ts = Date.now();
        const [woo, integrations] = await Promise.all([
          apiGet(`/api/integrations/woo/status?ts=${ts}`).catch(() => ({})),
          apiGet('/api/user/integrations').catch(() => ({})),
        ]);
        if (cancelled) return;
        const shopifyData =
          integrations?.shopify ??
          integrations?.integrations?.shopify ??
          integrations?.data?.shopify ??
          null;
        if (shopifyData?.connected) {
          setPlatform('shopify');
        } else if (woo?.store) {
          setPlatform('woocommerce');
        } else {
          setPlatform(null);
        }
      } catch (_) {
        if (!cancelled) setPlatform(null);
      } finally {
        if (!cancelled) setConnReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const abandonedTimerRef = useRef(null);
  const abandonedBusyRef = useRef(false);
  useEffect(() => {
    if (!connReady) return;
    if (isConnected || platform) {
      loadCampaignsData();
      loadGlobalStats();
      // initial fetch (throttled)
      if (!abandonedBusyRef.current) { abandonedBusyRef.current = true; loadAbandonedList().finally(()=>{abandonedBusyRef.current=false;}); }
      // clear old interval if any
      if (abandonedTimerRef.current) { clearInterval(abandonedTimerRef.current); abandonedTimerRef.current = null; }
      // poll every 30s only when tab is visible
      abandonedTimerRef.current = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        if (abandonedBusyRef.current) return;
        abandonedBusyRef.current = true;
        loadAbandonedList().finally(()=>{abandonedBusyRef.current=false;});
      }, 30000);
      return () => { if (abandonedTimerRef.current) clearInterval(abandonedTimerRef.current); abandonedTimerRef.current = null; };
    } else {
      setLoading(false);
    }
  }, [isConnected, platform, connReady]);

  async function loadCampaignsData() {
    try {
      setLoading(true);
      progressBar.start();

      // Load campaigns from Firebase Realtime Database
      try {
        // Bypass 15s client cache to reflect newly created/updated campaigns instantly
        const campaignsRes = await apiGet(`/api/campaigns/list?ts=${Date.now()}`);
        const loadedCampaigns = campaignsRes.campaigns || [];
        setAutomatedCampaigns(loadedCampaigns);
        
        console.log('[Campaigns] Loaded from Firebase:', loadedCampaigns.length);
        
        // Calculate stats from loaded campaigns
        if (loadedCampaigns.length > 0) {
          const totalEmails = loadedCampaigns.reduce((sum, c) => sum + (c.emailsSent || 0), 0);
          const avgOpenRate = loadedCampaigns.reduce((sum, c) => sum + (c.openRate || 0), 0) / loadedCampaigns.length;
          const avgClickRate = loadedCampaigns.reduce((sum, c) => sum + (c.clickRate || 0), 0) / loadedCampaigns.length;
          const totalRevenue = loadedCampaigns.reduce((sum, c) => sum + (c.revenueRecovered || 0), 0);
          const activeCampaigns = loadedCampaigns.filter(c => c.status === 'active').length;
          const pausedCampaigns = loadedCampaigns.filter(c => c.status === 'paused' || c.status === 'draft').length;

          setCampaignStats({
            totalEmails,
            avgOpenRate: parseFloat(avgOpenRate.toFixed(1)),
            avgClickRate: parseFloat(avgClickRate.toFixed(1)),
            totalRevenue,
            activeCampaigns,
            pausedCampaigns,
          });
        } else {
          setCampaignStats({
            totalEmails: 0,
            avgOpenRate: 0,
            avgClickRate: 0,
            totalRevenue: 0,
            activeCampaigns: 0,
            pausedCampaigns: 0,
          });
        }
      } catch (e) {
        console.warn('Could not load campaigns from Firebase:', e);
        setAutomatedCampaigns([]);
        setCampaignStats({
          totalEmails: 0,
          avgOpenRate: 0,
          avgClickRate: 0,
          totalRevenue: 0,
          activeCampaigns: 0,
          pausedCampaigns: 0,
        });
      }

      progressBar.complete();
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      progressBar.reset();
    } finally {
      setLoading(false);
    }
  }

  async function loadGlobalStats() {
    try {
      const res = await apiGet('/api/stats/global');
      setCampaignStats(prev => ({ ...(prev||{}), totalEmails: res.stats?.sent || 0 }));
    } catch (_) {}
    try {
      const f = await apiGet('/api/stats/funnel');
      setFunnel(f.funnel || funnel);
    } catch (_) {}
  }

  async function loadAbandonedList() {
    try {
      const res = await apiGet(`/api/abandoned/list`);
      let items = res.items || [];

      // If user has an active Abandoned Cart campaign, show only events created AFTER that campaign was created.
      try {
        const activeAbandoned = (automatedCampaigns || [])
          .filter(c => (c.status === 'active') && (c.metadata?.campaignType === 'abandoned_cart'));
        if (activeAbandoned.length > 0) {
          const since = Math.max(...activeAbandoned.map(c => Number(c.createdAt || 0)));
          if (Number.isFinite(since) && since > 0) {
            items = items.filter(it => Number(it.createdAt || it.lastAt || 0) >= since);
          }
        }
      } catch (_) {}

      setAbandonedList(items);
    } catch (_) { setAbandonedList([]); }
  }

  function handleCreateCampaign(title) {
    setModalCampaignType(title);
    setShowCampaignModal(true);
  }

  function handleCampaignModalClose() {
    setShowCampaignModal(false);
    setModalCampaignType('');
  }

  async function handleCampaignSuccess() {
    await loadCampaignsData();
  }

  function getRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  if (!isConnected && !platform && connReady) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Email Campaigns</h1>
          <p className="text-neutral-400">Create and manage automated email campaigns</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-8 flex items-start gap-6"
        >
          <div className="p-4 rounded-xl bg-amber-500/20">
            <Store className="w-8 h-8 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-amber-300 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Connect Your Store First
            </h3>
            <p className="text-amber-200/80 mb-4 text-sm leading-relaxed">
              To create email campaigns, you need to connect your WooCommerce store first.
              This allows us to sync your contacts and trigger automated campaigns based on customer behavior.
            </p>
            <a
              href="/dashboard/integrations"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:shadow-lg hover:scale-105 transition-all"
            >
              Go to Integrations →
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
              <Zap className="w-7 h-7" />
            </div>
            Email Campaigns
          </h1>
          <p className="text-neutral-400">Automated email marketing powered by AI</p>
        </div>
        <button
          onClick={loadCampaignsData}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <LoadingSpinner size="sm" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-all flex items-center gap-2 border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <DashboardTab
            loading={loading}
            stats={campaignStats}
            campaigns={automatedCampaigns}
            abandonedList={abandonedList}
          />
        )}
        {activeTab === 'my-campaigns' && (
          <MyCampaignsTab
            loading={loading}
            campaigns={automatedCampaigns}
            campaignTypes={campaignTypes}
            onRefresh={loadCampaignsData}
          />
        )}
        {activeTab === 'create' && (
          <CreateTab
            loading={loading}
            campaignTypes={campaignTypes}
            onCreateCampaign={handleCreateCampaign}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            loading={loading}
            campaigns={automatedCampaigns}
            stats={campaignStats}
          />
        )}
      </AnimatePresence>

      {/* Campaign Creation Modal */}
      {showCampaignModal && (
        <CampaignModal
          isOpen={showCampaignModal}
          onClose={handleCampaignModalClose}
          campaignType={modalCampaignType}
          onSuccess={handleCampaignSuccess}
        />
      )}
    </div>
  );
}

// Dashboard Tab Component
function DashboardTab({ loading, stats, campaigns, abandonedList = [] }) {
  if (loading) {
    return <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-zinc-900/40 border border-zinc-800" />
        ))}
      </div>
    </div>;
  }

  // Empty state
  if (!campaigns || campaigns.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="text-center py-16"
      >
        <div className="max-w-lg mx-auto">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 w-fit mx-auto mb-6">
            <BarChart3 className="w-16 h-16 text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">Welcome to Campaigns Dashboard</h3>
          <p className="text-neutral-400 mb-6 leading-relaxed">
            Start creating automated campaigns to see your performance metrics, track email engagement, and recover revenue.
          </p>
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-neutral-300">
            <Zap className="w-4 h-4 text-yellow-400" />
            Create your first campaign to unlock powerful analytics
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          icon={Send}
          title="Total Emails Sent"
          value={stats?.totalEmails || 0}
          trend="+12.5%"
          trendUp={true}
          gradient="from-blue-500 to-cyan-500"
        />
        <StatCard
          icon={Eye}
          title="Avg Open Rate"
          value={`${stats?.avgOpenRate || 0}%`}
          trend="+3.2%"
          trendUp={true}
          gradient="from-emerald-500 to-teal-500"
        />
        <StatCard
          icon={Target}
          title="Avg Click Rate"
          value={`${stats?.avgClickRate || 0}%`}
          trend="+1.8%"
          trendUp={true}
          gradient="from-purple-500 to-pink-500"
        />
      </div>

      {/* Funnel Overview */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          Email Funnel
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <FunnelCard label="Abandoned" value={(typeof funnel === 'object' && funnel?.abandoned) || 0} color="text-yellow-300" />
          <FunnelCard label="Sent" value={(typeof funnel === 'object' && funnel?.sent) || 0} color="text-blue-300" />
          <FunnelCard label="Opened" value={(typeof funnel === 'object' && funnel?.opened) || 0} color="text-emerald-300" />
          <FunnelCard label="Clicked" value={(typeof funnel === 'object' && funnel?.clicked) || 0} color="text-pink-300" />
          <FunnelCard label="Recovered" value={(typeof funnel === 'object' && funnel?.recovered) || 0} color="text-purple-300" />
        </div>
      </div>

      {/* Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Campaigns */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            Active Campaigns
          </h3>
          <div className="space-y-3">
            {campaigns.filter(c => c.status === 'active').slice(0, 3).map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                <div>
                  <div className="font-medium text-white">{campaign.title}</div>
                  <div className="text-sm text-neutral-400">{campaign.emailsSent} emails sent</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <span className="text-sm text-green-400">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {campaigns
              .filter(c => (c.lastSent && c.lastSent > 0))
              .sort((a, b) => b.lastSent - a.lastSent)
              .slice(0, 3)
              .map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                <div>
                  <div className="font-medium text-white">{campaign.title}</div>
                  <div className="text-sm text-neutral-400">Last sent {getRelativeTime(campaign.lastSent)}</div>
                </div>
                <div className="text-sm text-blue-400">{campaign.openRate}% opened</div>
              </div>
            ))}
            {campaigns.every(c => !c.lastSent) && (
              <div className="text-sm text-neutral-500">No sends yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Abandoned emails list */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/40 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Abandoned Emails
        </h3>
        {/* Stacked list (one below another) with responsive max width */}
        <div className="grid grid-cols-1 gap-4">
          {(abandonedList || []).map((item) => {
            const status = (item.statusLabel || '').toLowerCase();
            const badgeBottom = (item.anySent || (status.includes('email'))) ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : '';
            return (
              <div
                key={`${item.user_email}-${item.id || ''}`}
                className="group rounded-2xl border border-white/10 p-4 transition-all bg-neutral-900/60 hover:bg-neutral-900/80 hover:border-white/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate text-[15px]">{item.user_email}</div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-300">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 border border-white/10">
                        <span className="h-4 w-4 inline-flex items-center justify-center rounded-full bg-white/10 text-[10px]">{item.cartCount || 1}</span>
                        cart{(item.cartCount||1) > 1 ? 's' : ''}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 border border-white/10">
                        <span className="h-4 w-4 inline-flex items-center justify-center rounded-full bg-white/10 text-[10px]">{item.itemsCount || 0}</span>
                        items
                      </span>
                    </div>
                  </div>
                  {/* Removed explicit status badge as requested */}
                </div>
                <div className="mt-3 h-px rounded bg-white/10 group-hover:bg-white/20" />
                {item.lastAt && (
                  <div className="mt-3 text-[11px] text-neutral-400 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Last activity: {new Date(item.lastAt).toLocaleString()}</span>
                  </div>
                )}
                {/* Removed 'Email sent' badge as requested */}
              </div>
            );
          })}
        </div>
        {(abandonedList || []).length === 0 && (
          <div className="text-sm text-neutral-500 mt-2">Nema napuštenih korpi još uvijek.</div>
        )}
      </div>
    </motion.div>
  );
}

// My Campaigns Tab Component
function MyCampaignsTab({ loading, campaigns, campaignTypes, onRefresh }) {
  const [deletingId, setDeletingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  async function handleToggleStatus(campaign) {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    setUpdatingId(campaign.id);

    try {
      const { getFirebaseApp } = await import('../../../lib/firebaseClient');
      const { auth } = getFirebaseApp();
      const { getIdToken } = await import('firebase/auth');
      const token = await getIdToken(auth.currentUser, false);

      const response = await fetch('/api/campaigns/update-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId: campaign.id,
          status: newStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to update campaign status');

      // Refresh campaigns list
      await onRefresh();
    } catch (error) {
      console.error('Error toggling campaign status:', error);
      alert(`Failed to ${newStatus === 'active' ? 'activate' : 'pause'} campaign`);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(campaignId) {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }

    setDeletingId(campaignId);

    try {
      const { getFirebaseApp } = await import('../../../lib/firebaseClient');
      const { auth } = getFirebaseApp();
      const { getIdToken } = await import('firebase/auth');
      const token = await getIdToken(auth.currentUser, false);

      const response = await fetch(`/api/campaigns/delete?campaignId=${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete campaign');

      // Refresh campaigns list
      await onRefresh();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Failed to delete campaign');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 rounded-xl bg-zinc-900/40 border border-zinc-800 animate-pulse" />
      ))}
    </div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Summary */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {campaigns.filter(c => c.status === 'active').length} Active Campaigns
            </div>
            <div className="text-sm text-neutral-400 mt-1">
              {campaigns.filter(c => c.status === 'paused' || c.status === 'draft').length} paused • {campaigns.length} total
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaigns.map((campaign, idx) => {
          const typeInfo = campaignTypes.find(t => t.type === campaign.metadata?.campaignType);
          const Icon = typeInfo?.icon || Mail;
          const isUpdating = updatingId === campaign.id;
          const isDeleting = deletingId === campaign.id;

          return (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-2xl border ${typeInfo?.border || 'border-zinc-800'} bg-gradient-to-br ${typeInfo?.bg || 'from-zinc-900/80 to-zinc-900/40'} backdrop-blur-sm p-6 hover:shadow-2xl transition-all group ${
                isDeleting ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${typeInfo?.gradient || 'from-blue-600 to-purple-600'} shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{campaign.name}</h3>
                    <p className="text-sm text-neutral-400 mb-2">{campaign.subject}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                        campaign.status === 'active'
                          ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30 shadow-lg shadow-green-500/20'
                          : campaign.status === 'paused'
                          ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border border-yellow-500/30 shadow-lg shadow-yellow-500/20'
                          : 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        ● {campaign.status}
                      </div>
                      <div className="text-xs text-neutral-500">
                        Created {new Date(campaign.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(campaign)}
                    disabled={isUpdating || isDeleting}
                    className={`p-3 rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 ${
                      campaign.status === 'active'
                        ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-yellow-500/40 text-yellow-400 hover:shadow-lg hover:shadow-yellow-500/30'
                        : 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/40 text-green-400 hover:shadow-lg hover:shadow-green-500/30'
                    }`}
                    title={campaign.status === 'active' ? 'Pause Campaign' : 'Activate Campaign'}
                  >
                    {isUpdating ? (
                      <LoadingSpinner size="sm" />
                    ) : campaign.status === 'active' ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    disabled={isDeleting || isUpdating}
                    className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/40 text-red-400 hover:shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110"
                    title="Delete Campaign"
                  >
                    {isDeleting ? <LoadingSpinner size="sm" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Sender Info */}
              <div className="flex items-center gap-2 mb-4 text-sm text-neutral-400">
                <Mail className="w-4 h-4" />
                <span>{campaign.sender?.name || 'Unknown'}</span>
                <span className="text-neutral-600">•</span>
                <span>{campaign.sender?.email || 'N/A'}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {campaigns.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="max-w-md mx-auto">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 w-fit mx-auto mb-6">
              <Target className="w-16 h-16 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Create Your First Campaign</h3>
            <p className="text-neutral-400 mb-6 leading-relaxed">
              Get started with automated email campaigns powered by AI.<br/>
              Choose a campaign type to begin recovering abandoned carts, welcoming new customers, and more.
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                const createTab = document.querySelector('[data-tab-id="create"]');
                if (createTab) createTab.click();
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:shadow-xl hover:scale-105 transition-all"
            >
              <Plus className="w-5 h-5" />
              Create First Campaign
            </a>
            
            {/* Quick tips */}
            <div className="mt-10 pt-8 border-t border-zinc-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center mb-3">
                    <ShoppingCart className="w-4 h-4 text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-1">Abandoned Cart</h4>
                  <p className="text-xs text-neutral-400">Recover lost sales automatically</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
                    <Mail className="w-4 h-4 text-blue-400" />
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-1">Welcome Email</h4>
                  <p className="text-xs text-neutral-400">Greet new customers instantly</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center mb-3">
                    <Gift className="w-4 h-4 text-green-400" />
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-1">Post Purchase</h4>
                  <p className="text-xs text-neutral-400">Thank customers after buying</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Create Tab Component (existing UI)
function CreateTab({ loading, campaignTypes, onCreateCampaign }) {
  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-64 rounded-2xl border border-zinc-800 bg-zinc-900/40 animate-pulse" />
      ))}
    </div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaignTypes.map((campaign, idx) => {
          const Icon = campaign.icon;
          const isDisabled = Boolean(campaign.comingSoon && campaign.type !== 'abandoned_cart');

          return (
            <motion.div
              key={campaign.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative rounded-2xl border ${campaign.border} bg-gradient-to-br ${campaign.bg} backdrop-blur-sm p-6 ${isDisabled ? 'opacity-70 grayscale' : 'hover:shadow-2xl hover:scale-105'} transition-all duration-300 group overflow-hidden`}
            >
              {/* Animated gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${campaign.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>

              <div className="relative z-10">
                {/* Icon */}
                <div className={`p-4 rounded-xl bg-gradient-to-br ${campaign.gradient} w-fit mb-4 shadow-lg`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>

                {/* Automated Badge */}
                {campaign.automated && !isDisabled && (
                  <div className="absolute top-4 right-4 px-2 py-1 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Auto
                  </div>
                )}
                {isDisabled && (
                  <div className="absolute top-4 right-4 px-2 py-1 rounded-lg bg-zinc-700/40 border border-zinc-600/40 text-neutral-300 text-xs font-medium">
                    Coming soon
                  </div>
                )}

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-white mb-2">{campaign.title}</h3>
                <p className="text-sm text-neutral-400 mb-3 leading-relaxed">{campaign.description}</p>
                
                {/* Trigger Info */}
                {campaign.trigger && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-cyan-300 font-medium">{campaign.trigger}</span>
                  </div>
                )}

                {/* Create Button */}
                <button
                  onClick={() => !isDisabled && onCreateCampaign(campaign.title)}
                  disabled={isDisabled}
                  className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${isDisabled ? 'bg-zinc-800 border border-zinc-700 text-neutral-400 cursor-not-allowed' : `bg-gradient-to-r ${campaign.gradient} text-white hover:shadow-xl hover:scale-105`}`}
                >
                  <Plus className="w-5 h-5" />
                  {isDisabled ? 'Coming Soon' : 'Activate Campaign'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Analytics Tab Component
function AnalyticsTab({ loading, campaigns, stats }) {
  if (loading) {
    return <div className="space-y-6">
      <div className="h-64 rounded-xl bg-zinc-900/40 border border-zinc-800 animate-pulse" />
      <div className="grid grid-cols-2 gap-6">
        <div className="h-48 rounded-xl bg-zinc-900/40 border border-zinc-800 animate-pulse" />
        <div className="h-48 rounded-xl bg-zinc-900/40 border border-zinc-800 animate-pulse" />
      </div>
    </div>;
  }

  // Empty state
  if (!campaigns || campaigns.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="text-center py-16"
      >
        <div className="max-w-lg mx-auto">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 w-fit mx-auto mb-6">
            <TrendingUp className="w-16 h-16 text-purple-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">No Analytics Data Yet</h3>
          <p className="text-neutral-400 mb-6 leading-relaxed">
            Create and activate campaigns to start tracking detailed analytics including open rates, click rates, and revenue metrics.
          </p>
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-neutral-300">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Analytics will appear here once campaigns are active
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-semibold text-white">Performance</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Avg Open Rate</span>
              <span className="text-xl font-bold text-emerald-400">{stats?.avgOpenRate || 0}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Avg Click Rate</span>
              <span className="text-xl font-bold text-blue-400">{stats?.avgClickRate || 0}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="font-semibold text-white">Engagement</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Total Emails</span>
              <span className="text-xl font-bold text-white">{stats?.totalEmails || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Active Campaigns</span>
              <span className="text-xl font-bold text-green-400">{stats?.activeCampaigns || 0}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500/20">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="font-semibold text-white">Revenue</h3>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-1">{stats?.totalRevenue || 0} KM</div>
          <div className="text-sm text-green-300/70">Total recovered from abandoned carts</div>
        </div>
      </div>

      {/* Top Performing Campaigns */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" />
          Top Performing Campaigns
        </h3>
        <div className="space-y-3">
          {campaigns
            .sort((a, b) => b.openRate - a.openRate)
            .slice(0, 5)
            .map((campaign, idx) => (
              <div key={campaign.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                    idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                    idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-zinc-700 text-neutral-400'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-white">{campaign.title}</div>
                    <div className="text-sm text-neutral-400">{campaign.emailsSent} emails sent</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-400">{campaign.openRate}%</div>
                  <div className="text-xs text-neutral-400">open rate</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </motion.div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, title, value, trend, trendUp, gradient }) {
  // Parse value to check if it's 0
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
  const showTrend = numericValue > 0 && trend;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-zinc-700 transition"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {showTrend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${
            trendUp ? 'text-green-400' : 'text-red-400'
          }`}>
            {trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {trend}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-neutral-400">{title}</div>
    </motion.div>
  );
}

function FunnelCard({ label, value, color }) {
  return (
    <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-neutral-400 mt-1">{label}</div>
    </div>
  );
}

function getRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

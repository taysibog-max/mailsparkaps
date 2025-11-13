import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from '../../lib/firestoreAdmin';
import { requireUser } from '../../lib/auth';

type FunnelStats = {
  abandoned: number;
  sent: number;
  opened: number;
  clicked: number;
  recovered: number;
};

type DashboardResponse = {
  totalEmailsSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  funnel: FunnelStats;
  activeCampaigns: number;
  recentActivity: any[];
};

const memoryCache = new Map<string, { data: DashboardResponse; expiresAt: number }>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { uid } = await requireUser(req);
    const cacheKey = `dashboard:${uid}`;
    const now = Date.now();
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return res.status(200).json(cached.data);
    }

    const db = getFirestore();
    // Find all stores for this user
    const storesSnap = await db.collection('shopifyConnections').where('userId', '==', uid).where('active', '==', true).get();
    const storeIds = storesSnap.docs.map(d => d.id);

    let funnel: FunnelStats = { abandoned: 0, sent: 0, opened: 0, clicked: 0, recovered: 0 };
    let totalEmailsSent = 0;
    let recentActivity: any[] = [];

    for (const storeId of storeIds) {
      const cartsSnap = await db.collection('stores').doc(storeId).collection('abandoned_carts').limit(200).get();
      cartsSnap.forEach(doc => {
        const c = doc.data() as any;
        funnel.abandoned += 1;
        if (c.emailSent) funnel.sent += 1;
        if (c.opened) funnel.opened += 1;
        if (c.clicked) funnel.clicked += 1;
        if (c.recovered) funnel.recovered += 1;
        if (c.emailEvents) totalEmailsSent += Number(c.emailEvents) || 0;
        recentActivity.push({ type: 'cart', id: doc.id, ts: c.lastUpdate?.toMillis?.() || Date.now(), storeId });
      });

      const ordersSnap = await db.collection('stores').doc(storeId).collection('orders').orderBy('createdAt', 'desc').limit(50).get();
      ordersSnap.forEach(doc => {
        const o = doc.data() as any;
        recentActivity.push({ type: 'order', id: doc.id, ts: o.createdAt?.toMillis?.() || Date.now(), total: o.total, storeId });
      });
    }

    recentActivity.sort((a, b) => b.ts - a.ts);
    const activeCampaigns = storeIds.length; // proxy: connected stores
    const denominatorOpen = Math.max(funnel.sent, 1);
    const avgOpenRate = funnel.opened / denominatorOpen;
    const denominatorClick = Math.max(funnel.sent, 1);
    const avgClickRate = funnel.clicked / denominatorClick;

    const response: DashboardResponse = {
      totalEmailsSent,
      avgOpenRate,
      avgClickRate,
      funnel,
      activeCampaigns,
      recentActivity: recentActivity.slice(0, 50),
    };

    memoryCache.set(cacheKey, { data: response, expiresAt: Date.now() + 15 * 60 * 1000 });

    return res.status(200).json(response);
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return res.status(status).json({ error: e?.message || 'Internal error' });
  }
}





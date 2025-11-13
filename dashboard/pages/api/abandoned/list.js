import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    let uid = null;
    if (token) {
      try { const d = await adminAuth.verifyIdToken(token); uid = d.uid; } catch(_) {}
    }

    // Read per-user carts directly
    if (!uid) return res.status(200).json({ success: true, items: [] });
    const snap = await adminDatabase.ref(`users/${uid}/abandoned_carts`).get();
    const items = [];
    const storeKeysForUser = [];
    if (snap.exists()) {
      const val = snap.val() || {};
      Object.entries(val).forEach(([id, c]) => {
        const cartStoreKey = null; const owned = true; // already scoped to user
        items.push({
          id,
          user_email: c.user_email,
          itemsCount: Array.isArray(c.items)? c.items.length : (c.items ? Object.keys(c.items).length : 0),
          status: c.status,
          statusLabel: c.email_sent ? 'Email sent' : (c.status === 'abandoned' ? 'Abandoned' : 'Pending'),
          createdAt: c.createdAt || 0,
          email_sent_at: c.email_sent_at || 0,
        });
      });
      items.sort((a,b)=> (b.email_sent_at || b.createdAt) - (a.email_sent_at || a.createdAt));

      // Dedupe by user_email and aggregate counts (latest status wins)
      const byEmail = new Map();
      for (const it of items) {
        const key = String(it.user_email || '').toLowerCase();
        const prev = byEmail.get(key);
        if (!prev) {
          byEmail.set(key, {
            id: it.id,
            user_email: it.user_email,
            itemsCount: it.itemsCount,
            cartCount: 1,
            status: it.status,
            statusLabel: it.statusLabel,
            anySent: !!(it.email_sent_at && Number(it.email_sent_at) > 0),
            createdAt: it.createdAt,
            email_sent_at: it.email_sent_at,
            lastAt: it.email_sent_at || it.createdAt || 0,
          });
        } else {
          prev.itemsCount += it.itemsCount;
          prev.cartCount += 1;
          if (it.email_sent_at && Number(it.email_sent_at) > 0) prev.anySent = true;
          const curLast = it.email_sent_at || it.createdAt || 0;
          if (curLast > (prev.lastAt || 0)) {
            prev.id = it.id;
            prev.status = it.status;
            prev.statusLabel = it.statusLabel;
            prev.createdAt = it.createdAt;
            prev.email_sent_at = it.email_sent_at;
            prev.lastAt = curLast;
          }
        }
      }
      const aggregated = Array.from(byEmail.values()).map(v => ({
        ...v,
        statusLabel: v.anySent ? 'Email sent' : v.statusLabel,
      })).sort((a,b)=> (b.lastAt||0) - (a.lastAt||0));
      return res.status(200).json({ success: true, items: aggregated });
    }
    res.status(200).json({ success: true, items: [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load abandoned list', details: e.message });
  }
}



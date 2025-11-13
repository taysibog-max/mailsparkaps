import { adminDatabase, adminAuth } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    let uid = null;
    if (token) {
      try { const d = await adminAuth.verifyIdToken(token); uid = d?.uid || null; } catch (_) {}
    }
    let hintedUid = uid || req.headers['x-user-uid'] || req.headers['X-User-Uid'] || null;
    // Fallback: resolve uid via storeOwners mapping using Origin/Referer
    if (!hintedUid) {
      try {
        const origin = req.headers.origin || req.headers.referer || '';
        if (origin) {
          const host = new URL(origin).hostname.replace(/^www\./,'');
          const storeKey = host.replace(/\./g,'_');
          const snap = await adminDatabase.ref(`storeOwners/${storeKey}`).get();
          if (snap.exists()) hintedUid = snap.val();
        }
      } catch (_) {}
    }

    // Read per-user stats and carts
    let s = {};
    if (hintedUid) {
      const us = await adminDatabase.ref(`users/${hintedUid}/stats`).get();
      s = us.exists() ? (us.val() || {}) : {};
    }
    let abandoned = 0;
    let sentByUser = 0;
    try {
      if (hintedUid) {
        const cartsSnap = await adminDatabase.ref(`users/${hintedUid}/abandoned_carts`).get();
        if (cartsSnap.exists()) {
          const val = cartsSnap.val() || {};
          const carts = Object.values(val);
          abandoned = carts.length;
          carts.forEach(c => { if (c.email_sent) sentByUser += 1; });
        }
      }
    } catch (_) {}
    const funnel = {
      abandoned,
      sent: sentByUser || s.sent || 0,
      opened: s.opens || 0,
      clicked: s.clicks || 0,
      recovered: s.recovered || 0,
    };
    res.status(200).json({ success: true, funnel });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch funnel', details: e.message });
  }
}



import { adminDatabase, adminAuth } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    // Optional: verify auth if needed
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    if (token) {
      try { await adminAuth.verifyIdToken(token); } catch (_) {}
    }

    const snap = await adminDatabase.ref('stats/global').get();
    const val = snap.exists() ? snap.val() : {};
    const stats = {
      sent: val.sent || 0,
      opens: val.opens || 0,
      clicks: val.clicks || 0,
      recovered: val.recovered || 0,
    };
    // If per-user requested, merge user's personal stats
    const userUid = req.headers['x-user-uid'] || req.headers['X-User-Uid'];
    if (userUid) {
      try {
        const uSnap = await adminDatabase.ref(`users/${userUid}/stats`).get();
        const u = uSnap.exists() ? uSnap.val() : {};
        stats.sent = u.sent || stats.sent;
        stats.opens = u.opens || stats.opens;
        stats.clicks = u.clicks || stats.clicks;
        stats.recovered = u.recovered || stats.recovered;
      } catch(_) {}
    }
    res.status(200).json({ success: true, stats });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stats', details: e.message });
  }
}



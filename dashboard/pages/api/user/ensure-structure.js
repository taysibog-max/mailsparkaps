import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    let uid = null;
    try { const d = await adminAuth.verifyIdToken(token); uid = d.uid; } catch (_) {}
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const base = `users/${uid}`;
    const ensure = async (path, defVal) => {
      const ref = adminDatabase.ref(`${base}/${path}`);
      const snap = await ref.get();
      if (!snap.exists()) await ref.set(defVal);
    };

    await Promise.all([
      ensure('abandoned_carts', {}),
      ensure('messages', {}),
      ensure('daily_sends', {}),
      ensure('email_limits', {}),
      ensure('locks', {}),
      ensure('stats', { sent: 0, opens: 0, clicks: 0, recovered: 0 }),
      ensure('stores', {}),
    ]);

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to ensure user structure', details: e.message });
  }
}





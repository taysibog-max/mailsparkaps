import { adminDatabase, adminAuth } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const isManual = String(req.query.manual || '').toLowerCase() === 'true';
    const bearer = (req.headers.authorization || '').replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET || '';
    let scope = String(req.query.scope || '').toLowerCase(); // 'all' | 'user'
    let targetUid = String(req.query.uid || '').trim();

    // Authorization:
    // - Allow manual=true for quick local/prod testing
    // - Or require CRON_SECRET
    // - Or Firebase ID token to clean own data
    let mode = 'manual';
    let authUid = null;
    if (!isManual) {
      if (cronSecret && bearer === cronSecret) {
        mode = 'secret';
      } else {
        try {
          const decoded = await adminAuth.verifyIdToken(bearer);
          authUid = decoded?.uid || null;
          if (!authUid) return res.status(401).json({ error: 'Unauthorized' });
          mode = 'user';
        } catch {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }
    }

    let deleted = 0;
    if (mode === 'user') {
      const uid = authUid;
      await adminDatabase.ref(`events/${uid}/cart_abandoned`).remove();
      deleted = 1;
    } else if (mode === 'secret' || isManual) {
      // If uid is provided, clean only that; otherwise clean all users
      if (targetUid) {
        await adminDatabase.ref(`events/${targetUid}/cart_abandoned`).remove();
        deleted = 1;
      } else {
        const snapshot = await adminDatabase.ref('events').once('value');
        if (snapshot.exists()) {
          const all = snapshot.val() || {};
          const updates = {};
          for (const uid of Object.keys(all)) {
            updates[`${uid}/cart_abandoned`] = null;
            deleted++;
          }
          await adminDatabase.ref('events').update(updates);
        }
      }
    }

    return res.status(200).json({ success: true, deleted });
  } catch (e) {
    console.error('[Admin cleanup] error:', e);
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}



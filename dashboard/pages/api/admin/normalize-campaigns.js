import { adminDatabase } from '../../../lib/firebaseAdmin';

function normalizeType(raw) {
  const v = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
    .trim();
  if (!v) return null;
  // Treat Brevo 'classic' as our abandoned cart automation
  if (v === 'classic') return 'abandoned_cart';
  return v;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const secret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const usersSnap = await adminDatabase.ref('users').once('value');
    if (!usersSnap.exists()) {
      return res.status(200).json({ success: true, updated: 0, users: 0 });
    }

    const users = usersSnap.val() || {};
    let updated = 0;
    let scanned = 0;

    for (const [uid, node] of Object.entries(users)) {
      scanned++;
      const buckets = ['campaigns', 'campaigns_drafts'];
      for (const bucket of buckets) {
        const campaignsNode = node?.[bucket] || {};
        for (const [cid, c] of Object.entries(campaignsNode)) {
          const ref = adminDatabase.ref(`users/${uid}/${bucket}/${cid}`);

          // Derive type
          const metaType = normalizeType(c?.metadata?.campaignType);
          const ownType = normalizeType(c?.type);
          const name = String(c?.name || c?.metadata?.name || '').toLowerCase();
          const looksAbandoned = name.includes('abandoned') || name.includes('napu') || name.includes('cart');
          const inferred =
            metaType || ownType || (looksAbandoned ? 'abandoned_cart' : null);

          // Derive status
          const rootStatus = String(c?.status ?? '').toLowerCase();
          const senderStatus = String(c?.sender?.status ?? '').toLowerCase();

          const patch = {};
          if (inferred && (!c?.metadata || normalizeType(c?.metadata?.campaignType) !== inferred)) {
            patch.metadata = { ...(c?.metadata || {}), campaignType: inferred };
          }
          if ((!rootStatus || rootStatus !== 'active') && senderStatus === 'active') {
            patch.status = 'active';
          }

          if (Object.keys(patch).length > 0) {
            patch.updatedAt = Date.now();
            await ref.update(patch);
            updated++;
          }
        }
      }
    }

    return res.status(200).json({ success: true, updated, users: scanned });
  } catch (e) {
    console.error('[Admin] normalize-campaigns error:', e);
    return res.status(500).json({ error: 'Internal error', message: e?.message });
  }
}



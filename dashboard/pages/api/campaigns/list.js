import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';
import { getCampaigns as brevoGetCampaigns } from '../../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    let uid = null;
    if (token) {
      try { const d = await adminAuth.verifyIdToken(token); uid = d.uid; } catch (_) {}
    }
    // Fallback: allow X-User-Uid for read-only listing when token missing (offline cached UI)
    if (!uid) {
      const hintedUid = req.headers['x-user-uid'] || req.headers['X-User-Uid'];
      if (hintedUid) uid = String(hintedUid);
    }
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[Campaigns List] Fetching campaigns for user:', uid);

    // Fetch campaigns from Firebase Realtime Database (local metadata)
    const campaignsRef = adminDatabase.ref(`users/${uid}/campaigns`);
    const draftsRef = adminDatabase.ref(`users/${uid}/campaigns_drafts`);
    const [snapshot, draftsSnap] = await Promise.all([
      campaignsRef.once('value'),
      draftsRef.once('value')
    ]);
    const campaignsData = snapshot.exists() ? snapshot.val() : {};
    const draftsData = draftsSnap.exists() ? draftsSnap.val() : {};
    const localCampaigns = Object.keys(campaignsData).map(key => ({ id: key, ...campaignsData[key] }));
    const localDrafts = Object.keys(draftsData).map(key => ({ id: key, ...draftsData[key], status: 'draft' }));

    // Fetch campaigns from Brevo (authoritative delivery data)
    let brevoCampaigns = [];
    try {
      const brevoRes = await brevoGetCampaigns({ limit: 100, offset: 0 });
      brevoCampaigns = (brevoRes?.campaigns || []).map(c => ({
        id: c.id,
        brevoId: c.id,
        name: c.name,
        subject: c.subject,
        status: c.status || c.campaignStatus || 'draft',
        emailsSent: c.stats?.delivered || 0,
        openRate: c.stats?.openRate || 0,
        clickRate: c.stats?.clickRate || 0,
        lastSent: c.sentDate ? new Date(c.sentDate).getTime() : 0,
      }));
    } catch (e) {
      console.warn('[Campaigns List] Brevo fetch warning:', e.message);
    }

    // Merge by brevoId/id (Brevo is source of truth; enrich with local metadata)
    const byId = new Map();
    for (const b of brevoCampaigns) byId.set(String(b.id), { ...b });
    for (const l of localCampaigns) {
      const key = String(l.brevoId || l.id);
      byId.set(key, { ...byId.get(key), ...l });
    }

    // Append local-only drafts (that don't exist on Brevo yet)
    for (const d of localDrafts) {
      const key = String(d.brevoId || d.id);
      if (!byId.has(key)) byId.set(key, d);
    }

    let campaigns = Array.from(byId.values());

    // Enrich stats for automation-driven campaigns from RTDB events (SMTP sends are not visible in Brevo list)
    try {
      const eventsSnap = await adminDatabase.ref(`events/${uid}/cart_abandoned`).once('value');
      const eventsNode = eventsSnap.exists() ? (eventsSnap.val() || {}) : {};
      const sentCount = Object.values(eventsNode).filter((e) => e && e.emailSent === true).length;
      campaigns = campaigns.map(c => {
        const isAbandoned = (c.metadata?.campaignType || c.type) === 'abandoned_cart';
        if (!isAbandoned) return c;
        const currentSent = Number(c.emailsSent || 0);
        // Prefer max to avoid decreasing numbers if Brevo list is behind
        return { ...c, emailsSent: Math.max(currentSent, sentCount) };
      });
    } catch (statsErr) {
      console.warn('[Campaigns List] events enrichment skipped:', statsErr?.message || statsErr);
    }
    console.log('[Campaigns List] ✅ Combined campaigns:', campaigns.length);

    res.status(200).json({ success: true, campaigns, total: campaigns.length });

  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      error: 'Failed to fetch campaigns',
      details: error.message,
    });
  }
}


import { adminAuth, adminDatabase } from '../../../../lib/firebaseAdmin';

async function registerWebhooks(shop, accessToken, baseAppUrl) {
  const address = `${baseAppUrl}/api/webhooks/shopify`;
  const topics = ['checkouts/update', 'checkouts/create', 'orders/create', 'app/uninstalled'];
  for (const topic of topics) {
    try {
      await fetch(`https://${shop}/admin/api/2024-07/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
      });
    } catch (_) {}
  }
}

async function installScriptTag(shop, accessToken, baseAppUrl) {
  const src = `${baseAppUrl}/cart-tracker.js`;
  await fetch(`https://${shop}/admin/api/2024-07/script_tags.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ script_tag: { event: 'onload', src, display_scope: 'online_store' } }),
  });
}

async function removeScriptTags(shop, accessToken, baseAppUrl) {
  try {
    const res = await fetch(`https://${shop}/admin/api/2024-07/script_tags.json`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
    });
    const data = await res.json().catch(() => ({}));
    const src = `${baseAppUrl}/cart-tracker.js`;
    const tags = (data?.script_tags || []).filter(t => String(t?.src || '').includes('/cart-tracker.js'));
    for (const t of tags) {
      try {
        await fetch(`https://${shop}/admin/api/2024-07/script_tags/${t.id}.json`, {
          method: 'DELETE',
          headers: { 'X-Shopify-Access-Token': accessToken },
        });
      } catch (_) {}
    }
  } catch (_) {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { mode } = req.body || {};
    const normalizedMode = String(mode || '').toLowerCase() === 'fast' ? 'FAST' : 'SILENT';

    // Read shop + access token
    const snap = await adminDatabase.ref(`users/${uid}/integrations/shopify`).get();
    if (!snap.exists()) return res.status(400).json({ error: 'Shopify not connected' });
    const integ = snap.val() || {};
    const shop = integ.shop;
    const accessToken = integ.accessToken;
    if (!shop || !accessToken) return res.status(400).json({ error: 'Missing shop/accessToken' });

    const baseAppUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

    // Always ensure webhooks
    if (baseAppUrl) {
      await registerWebhooks(shop, accessToken, baseAppUrl);
    }

    if (normalizedMode === 'FAST' && baseAppUrl) {
      await installScriptTag(shop, accessToken, baseAppUrl);
    } else if (normalizedMode === 'SILENT' && baseAppUrl) {
      await removeScriptTags(shop, accessToken, baseAppUrl);
    }

    // Persist choice
    await adminDatabase.ref(`users/${uid}/integrations/shopify`).update({
      mode: normalizedMode,
      lastSynced: Date.now(),
    });

    return res.status(200).json({ success: true, mode: normalizedMode });
  } catch (e) {
    console.error('[Shopify set-mode] error:', e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}



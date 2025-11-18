import { adminDatabase } from '../../../lib/firebaseAdmin';

async function registerWebhooks(shop, accessToken, baseAppUrl) {
  try {
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
  } catch (_) {}
}

async function installScriptTag(shop, accessToken, baseAppUrl) {
  try {
    const src = `${baseAppUrl}/cart-tracker.js`;
    await fetch(`https://${shop}/admin/api/2024-07/script_tags.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ script_tag: { event: 'onload', src, display_scope: 'online_store' } }),
    });
  } catch (_) {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const secret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { uid, shop, accessToken } = req.body || {};
    if (!uid || !shop || !accessToken) {
      return res.status(400).json({ error: 'Missing fields: uid, shop, accessToken' });
    }

    // Store token and mapping in RTDB
    await adminDatabase.ref(`users/${uid}/integrations/shopify`).update({
      shop,
      accessToken,
      platform: 'shopify',
      connectedAt: Date.now(),
      lastSynced: Date.now(),
    });
    const lower = String(shop).toLowerCase();
    const underscore = lower.replace(/\./g, '_');
    await adminDatabase.ref(`storeOwners/${lower}`).set(uid);
    await adminDatabase.ref(`storeOwners/${underscore}`).set(uid);

    const baseAppUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

    if (baseAppUrl) {
      await registerWebhooks(shop, accessToken, baseAppUrl);
      await installScriptTag(shop, accessToken, baseAppUrl);
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}



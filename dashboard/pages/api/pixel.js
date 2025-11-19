/**
 * Lightweight endpoint for receiving checkout pixel events from Shopify.
 * Expects Authorization: Bearer <userIdToken> where token is the Firebase uid (dev/simple).
 * Body: { type: 'contact_info' | 'completed' | 'shipping_info', checkoutToken, email?, lineItems?[] }
 */

import crypto from 'crypto';

function getBearerUserId(req) {
  try {
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = String(auth.slice(7)).trim();
    // Try verify signed token: base64url(uid).signature
    try {
      const [base, sig] = token.split('.');
      if (base && sig) {
        const secret = process.env.SERVER_JWT_SECRET || 'dev_local_secret_change_me';
        const check = crypto.createHmac('sha256', secret).update(base).digest('base64url');
        if (check === sig) {
          const uid = Buffer.from(base, 'base64url').toString('utf8');
          if (uid) return uid;
        }
      }
    } catch(_) {}
    // Fallback: treat whole token as uid (backward compatibility)
    return token || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = getBearerUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { type, checkoutToken, email, lineItems, currency, url } = req.body || {};
    if (!type || !checkoutToken) {
      return res.status(400).json({ error: 'Missing required fields: type, checkoutToken' });
    }

    // Lazy import to avoid issues during preflight and reduce cold start
    const { adminDatabase } = await import('../../lib/firebaseAdmin');
    const eventId = String(checkoutToken);
    const baseRef = adminDatabase.ref(`events/${userId}/cart_abandoned/${eventId}`);

    if (type === 'contact_info') {
      // Accept even without items; some themes/pixels don't send lineItems here
      if (!email) {
        return res.status(200).json({ success: true, ignored: 'missing_email' });
      }
      const normalizedItems = Array.isArray(lineItems) ? lineItems : [];
      // Upsert event with email and optional items
      const now = Date.now();
      const snapshot = await baseRef.get().catch(() => null);
      const exists = snapshot && snapshot.exists();
      const payload = {
        eventId,
        eventType: 'cart_abandoned',
        customerEmail: email || '',
        items: normalizedItems,
        currency: currency || null,
        url: url || null,
        source: 'pixel',
        topic: 'contact_info',
        createdAt: exists ? (snapshot.val()?.createdAt || now) : now,
        lastAt: now,
        isAbandoned: false,
        processedAt: null,
        emailSent: false,
        recovered: false,
        platform: 'shopify',
      };
      await baseRef.update(payload);
      return res.status(200).json({ success: true });
    }

    if (type === 'abandoned') {
      // Mark explicitly as abandoned (triggered on page leave)
      const updates = {
        isAbandoned: true,
        abandonedAt: Date.now(),
        lastAt: Date.now(),
      };
      // If email is provided here and not yet stored, persist it
      if (email) {
        updates['customerEmail'] = email;
      }
      await baseRef.update(updates);
      // Read final event payload and trigger automation immediately (no CRON dependency)
      try {
        const snap = await baseRef.get();
        const ev = snap.exists() ? snap.val() : null;
        if (ev && (ev.customerEmail || email)) {
          const baseUrl =
            process.env.INTERNAL_API_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
          if (baseUrl) {
            const headers = { 'Content-Type': 'application/json' };
            const bypass =
              process.env.VERCEL_PROTECTION_BYPASS ||
              process.env.PROTECTION_BYPASS_TOKEN ||
              process.env.VERCEL_BYPASS_TOKEN;
            if (bypass) headers['x-vercel-protection-bypass'] = bypass;
            // Forward the same pixel Authorization (signed uid) so trigger can authorize
            const fwd = req.headers['authorization'] || req.headers['Authorization'];
            if (fwd) headers['Authorization'] = fwd;
            await fetch(`${baseUrl}/api/automation/trigger`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                userId,
                eventId,
                eventType: 'cart_abandoned',
                eventData: { ...(ev || {}), isAbandoned: true },
              }),
            }).catch(()=>{});
          }
        }
      } catch (_) {}
      return res.status(200).json({ success: true });
    }

    if (type === 'completed') {
      await baseRef.update({
        recovered: true,
        recoveredAt: Date.now(),
      });
      return res.status(200).json({ success: true });
    }

    // Other funnel steps just update timestamp
    await baseRef.update({ lastAt: Date.now() });
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('[Pixel] Error:', e);
    return res.status(500).json({ error: 'Internal server error', message: e?.message || String(e) });
  }
}



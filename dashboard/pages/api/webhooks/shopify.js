/**
 * Shopify Webhook Handler
 * POST /api/webhooks/shopify
 * 
 * Handles events: checkouts/create, carts/update, customers/create, orders/create
 */

import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';
import { extractContactFromEvent, saveOrUpdateContact } from '../../../lib/contactsHelpers';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // Need raw body for HMAC verification
  },
};

// Helper to read raw body
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Verify Shopify HMAC (use raw Buffer, not string)
function verifyShopifyHMAC(rawBodyBuffer, hmacHeader, secret) {
  if (!secret) {
    console.warn('[Shopify Webhook] WEBHOOK_SECRET not set, skipping verification (dev mode)');
    return true;
  }

  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBodyBuffer) // important: raw bytes
    .digest('base64');

  try {
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(String(hmacHeader || ''), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    // fallback
    return computed === hmacHeader;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Helper to fetch checkout details from Shopify when email is missing in webhook
  async function fetchEmailFromShopifyCheckout(shopDomain, checkoutToken, resolvedUserId) {
    try {
      if (!shopDomain || !checkoutToken || !resolvedUserId) return null;
      // Read stored access token from our DB
      const tokenSnap = await adminDatabase.ref(`users/${resolvedUserId}/integrations/shopify/accessToken`).once('value');
      const accessToken = tokenSnap.exists() ? tokenSnap.val() : null;
      if (!accessToken) return null;
      const endpoint = `https://${shopDomain}/admin/api/2025-10/checkouts/${checkoutToken}.json`;
      const r = await fetch(endpoint, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (!r.ok) {
        console.warn('[Shopify Webhook] fetch checkout failed:', r.status);
        return null;
      }
      const data = await r.json();
      const email = data?.checkout?.email || data?.checkout?.contact_email || null;
      return email || null;
    } catch (e) {
      console.warn('[Shopify Webhook] fetch checkout error:', e?.message || e);
      return null;
    }
  }

  try {
    // Get raw body for HMAC verification
    const rawBody = await getRawBody(req);
    const bodyText = rawBody.toString('utf8');
    const payload = JSON.parse(bodyText);

    // Verify HMAC signature (support both Notification-UI signing key and App secret)
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const signingKey = process.env.WEBHOOK_SECRET || '';
    const appSecret = process.env.SHOPIFY_API_SECRET || '';
    console.log('[Shopify Webhook] debug lengths:', {
      signingKeyLen: signingKey ? signingKey.length : 0,
      appSecretLen: appSecret ? appSecret.length : 0,
    });

    const validBySigningKey = signingKey
      ? verifyShopifyHMAC(rawBody, hmacHeader, signingKey)
      : false;
    const validByAppSecret = appSecret
      ? verifyShopifyHMAC(rawBody, hmacHeader, appSecret)
      : false;

    if (!(validBySigningKey || validByAppSecret)) {
      console.error('[Shopify Webhook] Invalid HMAC signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Get event topic from header
    const topic = req.headers['x-shopify-topic'];
    console.log('[Shopify Webhook] Received:', topic);

    // Extract user ID from payload (you may need to customize this)
    // For now, we'll use the shop domain as identifier
    const shopDomain = req.headers['x-shopify-shop-domain'];
    
    // Resolve owner uid from mapping storeOwners/{shopDomain}
    let userId = shopDomain ? shopDomain.replace('.myshopify.com', '') : 'unknown';
    try {
      const keyShop = String(shopDomain||'').toLowerCase().replace(/[^a-z0-9.-]/gi, '_');
      const ownerSnap = await adminDatabase.ref(`storeOwners/${keyShop}`).once('value');
      if (ownerSnap.exists()) {
        userId = ownerSnap.val();
      } else {
        // Fallback auto-discovery: find user that connected this Shopify shop
        try {
          const usersSnap = await adminDatabase.ref('users').once('value');
          if (usersSnap.exists()) {
            const allUsers = usersSnap.val() || {};
            const rawShop = String(shopDomain || '').toLowerCase();
            const underscoreKey = rawShop.replace(/\./g, '_');
            for (const [candidateUid, userNode] of Object.entries(allUsers)) {
              const connectedShop = userNode?.integrations?.shopify?.shop || '';
              if (connectedShop && String(connectedShop).toLowerCase() === rawShop) {
                userId = candidateUid;
                // Persist mapping for next time (both raw and underscored keys)
                try { await adminDatabase.ref(`storeOwners/${rawShop}`).set(candidateUid); } catch (_) {}
                try { await adminDatabase.ref(`storeOwners/${underscoreKey}`).set(candidateUid); } catch (_) {}
                break;
              }
            }
          }
        } catch (autoErr) {
          console.warn('[Shopify Webhook] Auto-discovery mapping failed:', autoErr?.message || autoErr);
        }
      }
    } catch (_) {}

    // Process different event types
    let eventType = 'unknown';
    let eventData = {};

    // Helper to extract email from various fields (handles COD plugins)
    const extractEmail = (p) => {
      const direct = p?.email || p?.customer?.email || p?.contact_email || p?.billing_address?.email || p?.shipping_address?.email;
      if (direct) return direct;
      const notes = Array.isArray(p?.note_attributes) ? p.note_attributes : [];
      const fromNotes = notes.find(n => String(n?.name || '').toLowerCase().includes('email'));
      return fromNotes?.value || '';
    };

    // carts/update se i dalje ignorira (nema email); za checkouts/* NE ignoriramo više – koristimo ih kao signal za napuštenu korpu sa emailom
    if (topic === 'carts/update') {
      return res.status(200).json({ success: true, ignored: true });
    } else if (topic === 'checkouts/create' || topic === 'checkouts/update') {
      // Treat checkout events as "cart_abandoned" candidate WITH email so da možemo odmah okinuti automatiku
      let customerEmail = extractEmail(payload) || null;
      if (!customerEmail) {
        // Fallback: pokušaj povući email preko Admin API koristeći checkout token
        const token = payload?.token || payload?.cart_token || payload?.id || null;
        try {
          const fetched = await fetchEmailFromShopifyCheckout(shopDomain, token, userId);
          if (fetched) customerEmail = fetched;
        } catch (_) {}
      }
      eventType = 'cart_abandoned';
      eventData = {
        customerEmail,
        customerName: payload?.customer?.first_name || payload?.billing_address?.first_name || 'Customer',
        items: (payload?.line_items || []).map(item => ({
          name: item.title,
          quantity: item.quantity,
          price: item.price,
        })),
        token: payload?.token || payload?.cart_token || payload?.id,
        currency: payload?.currency,
        totalPrice: payload?.total_price || payload?.subtotal_price,
        platform: 'shopify',
        shopDomain,
        source: 'shopify',
        // Za FAST režim: ne šalji odmah; čekaj eksplicitni 'abandoned' signal sa pixela
        isAbandoned: false,
      };
    } else if (topic === 'orders/create') {
      eventType = 'order_created';
      eventData = {
        orderId: payload.id,
        orderNumber: payload.order_number,
        customerEmail: payload.email,
        customerName: payload.customer?.first_name || payload.billing_address?.first_name || 'Customer',
        items: (payload.line_items || []).map(item => ({
          name: item.title,
          quantity: item.quantity,
          price: item.price,
        })),
        totalPrice: payload.total_price,
        currency: payload.currency,
        platform: 'shopify',
        shopDomain,
      };
    } else if (topic === 'customers/create') {
      eventType = 'customer_created';
      eventData = {
        customerId: payload.id,
        customerEmail: payload.email,
        customerName: `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || 'Customer',
        platform: 'shopify',
        shopDomain,
      };
    }

    // Store event in Firebase
    const eventId = `shopify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventRef = adminDatabase.ref(`events/${userId}/${eventType}/${eventId}`);

    // Realtime Database ne prihvata undefined vrijednosti.
    // Sanitizuj payload da ukloni undefined (deep) prije upisa.
    const dataToStore = JSON.parse(JSON.stringify({
      ...eventData,
      eventId,
      eventType,
      topic,
      createdAt: Date.now(),
      processedAt: null,
      emailSent: false,
    }));
    
    await eventRef.set(dataToStore);

    console.log('[Shopify Webhook] ✅ Event stored:', eventType, eventId);

    // Extract and save contact (async, don't wait)
    const contactData = extractContactFromEvent(eventData);
    if (contactData) {
      saveOrUpdateContact(adminDatabase, userId, contactData, eventType).catch(err => {
        console.error('[Shopify Webhook] Contact save error:', err);
      });
    }

    // For cart_abandoned do NOT trigger immediately (CRON handles with grace); others yes
    const shouldTriggerImmediately = eventType !== 'cart_abandoned';
    if (shouldTriggerImmediately) {
      triggerAutomation(userId, eventId, eventType, eventData).catch(err => {
        console.error('[Shopify Webhook] Automation trigger error:', err);
      });
    } else {
      console.log('[Shopify Webhook] Skipping immediate automation for event:', eventType);
    }

    return res.status(200).json({
      success: true,
      eventId,
      eventType,
      message: 'Webhook received and processed',
    });

  } catch (error) {
    console.error('[Shopify Webhook] Error:', error);
    // Avoid returning 500 to Shopify to prevent retry loops during development.
    return res.status(200).json({
      success: false,
      error: 'Webhook handling error',
      message: error?.message || String(error),
    });
  }
}

// Trigger automation flow
async function triggerAutomation(userId, eventId, eventType, eventData) {
  try {
    const baseUrl =
      process.env.INTERNAL_API_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const headers = {
      'Content-Type': 'application/json',
    };
    const bypass =
      process.env.VERCEL_PROTECTION_BYPASS ||
      process.env.PROTECTION_BYPASS_TOKEN ||
      process.env.VERCEL_BYPASS_TOKEN;
    if (bypass) {
      headers['x-vercel-protection-bypass'] = bypass;
    }

    const response = await fetch(`${baseUrl}/api/automation/trigger`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        eventId,
        eventType,
        eventData,
      }),
    });

    if (!response.ok) {
      throw new Error('Automation trigger failed');
    }

    console.log('[Shopify Webhook] ✅ Automation triggered');
  } catch (error) {
    console.error('[Shopify Webhook] Automation trigger error:', error);
  }
}

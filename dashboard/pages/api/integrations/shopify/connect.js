import { adminAuth } from '../../../../lib/firebaseAdmin';
import { getAdminDb } from '../../../../lib/firebaseAdminDb';
import axios from 'axios';
import * as admin from 'firebase-admin';

function normalizeShop(input) {
  if (!input) return '';
  const s = String(input).trim();
  if (!s) return '';
  // Accept either full URL or domain; store only domain
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
    return url.hostname.toLowerCase();
  } catch (_) {
    return s.toLowerCase();
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { shop: rawShop, accessToken } = req.body || {};
    // Require BOTH fields explicitly so users cannot connect with arbitrary input
    if (!rawShop || !accessToken) return res.status(400).json({ error: 'Missing required fields: shop and accessToken' });

    const shop = normalizeShop(rawShop);

    // Verify access token with Shopify before saving anything
    try {
      const base = `https://${shop}`;
      const resp = await axios.get(`${base}/admin/api/2024-07/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (resp.status !== 200 || !resp.data?.shop?.id) {
        return res.status(400).json({ error: `Invalid Shopify credentials (status ${resp.status})` });
      }
    } catch (verifyErr) {
      return res.status(400).json({ error: 'Failed to verify Shopify credentials' });
    }

    const storePayload = { platform: 'shopify', shop, accessToken: accessToken || null, connectedAt: Date.now(), lastSynced: Date.now() };

    // Save to Realtime Database
    try {
      const db = getAdminDb();
      await db.ref(`users/${uid}/integrations/shopify`).set(storePayload);
      console.log('[Shopify] Successfully saved to Realtime Database');
      
      // Mirror in stores path
      const mirror = { uid, shop, provider: 'shopify', updatedAt: Date.now(), accessToken };
      await db.ref(`stores/${uid}_shopify`).set(mirror);
    } catch (e) {
      console.error('[Shopify] Failed to save to database:', e.message);
    }

    // Map shop domain → uid for webhook resolution
    try {
      const db = getAdminDb();
      const keyShop = String(shop||'').toLowerCase().replace(/[^a-z0-9.-]/gi, '_');
      await db.ref(`storeOwners/${keyShop}`).set(uid);
    } catch (_) {}

    // Immediately fetch orders and import unique emails into Firestore
    let importedCount = 0;
    try {
      if (accessToken && shop) {
        const base = `https://${shop}`;
        const orders = await axios.get(`${base}/admin/api/2024-07/orders.json`, {
          headers: { 'X-Shopify-Access-Token': accessToken },
          params: { status: 'any', limit: 250 },
          timeout: 15000,
          validateStatus: () => true,
        });
        if (orders.status >= 400) {
          throw new Error(`Shopify API error ${orders.status}: ${orders.data?.errors || 'Unknown'}`);
        }
        const emails = Array.from(new Set((orders.data?.orders||[])
          .map(o=>o?.email)
          .filter(Boolean)
          .map(e=>String(e).toLowerCase())));

        // Write to Firestore using Admin SDK with dedupe-by-id (email)
        try {
          const firestore = admin.firestore();
          const now = admin.firestore.FieldValue.serverTimestamp();
          const baseCol = firestore.collection('users').doc(uid).collection('contacts');
          for (const email of emails) {
            const id = email.toLowerCase();
            const ref = baseCol.doc(id);
            try {
              await ref.create({
                email: id,
                // legacy
                source: 'shopify',
                importedAt: now,
                // per spec
                sourceStore: 'shopify',
                dateImported: now,
                createdAt: new Date().toISOString(),
              });
              importedCount++;
            } catch (_) {
              // already exists
            }
          }
        } catch (writeErr) {
          console.warn('[Shopify connect] Firestore write warning:', writeErr.message);
        }

        // Update counts and lastSynced in Realtime DB
        try {
          const db = getAdminDb();
          await db.ref(`users/${uid}/integrations/shopify/lastSynced`).set(Date.now());
          await db.ref(`users/${uid}/integrations/shopify/contactsCount`).set(importedCount);
        } catch (_) {}

        // Mirror contacts to Realtime Database: users/{uid}/contacts/{email}
        try {
          const db = getAdminDb();
          const nowMs = Date.now();
          const updates = {};
          const toKey = (value) => Buffer.from(String(value).toLowerCase()).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
          for (const email of emails) {
            const id = String(email).toLowerCase();
            const key = toKey(id);
            updates[`users/${uid}/contacts/${key}`] = {
              email: id,
              sourceStore: 'shopify',
              createdAt: new Date().toISOString(),
              dateImported: nowMs,
            };
          }
          if (Object.keys(updates).length) {
            await db.ref().update(updates);
          }
        } catch (e) {
          console.warn('[Shopify connect] RTDB mirror warning:', e.message);
        }

        // Auto-sync contacts to Brevo
        try {
          const brevo = await import('../../../../lib/brevo');
          let brevoSynced = 0;
          for (const email of emails) {
            try {
              await brevo.addOrUpdateContact({
                email: email.toLowerCase(),
                attributes: {
                  SOURCE: 'shopify',
                  STORE_URL: `https://${shop}`,
                  IMPORTED_AT: new Date().toISOString(),
                },
              });
              brevoSynced++;
            } catch (brevoErr) {
              console.warn(`[Brevo] Failed to sync ${email}:`, brevoErr.message);
            }
          }
          console.log(`[Brevo] Successfully synced ${brevoSynced}/${emails.length} contacts`);
        } catch (brevoError) {
          console.warn('[Brevo] Auto-sync warning:', brevoError.message);
        }
      }
    } catch (e) {
      console.error('[Shopify] Initial import failed:', e.message);
    }

    return res.status(200).json({ ok: true, store: storePayload, imported: importedCount });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}



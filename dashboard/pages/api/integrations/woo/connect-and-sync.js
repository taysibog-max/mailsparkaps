import axios from 'axios';
import { adminAuth } from '../../../../lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { getAdminDb } from '../../../../lib/firebaseAdminDb';
import fs from 'fs';
import path from 'path';

function normalizeUrl(url){
  if (!url) return '';
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u.replace(/\/$/, '') : 'https://' + u.replace(/\/$/, '');
}

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { storeUrl, consumer_key, consumer_secret, backupApi } = req.body || {};
    if (!storeUrl || !consumer_key || !consumer_secret) return res.status(400).json({ error: 'Missing fields' });
    const base = normalizeUrl(storeUrl);

    // Strict path as requested
    const ordersUrl = `${base}/wp-json/wc/v3/orders`;

    let orders = [];
    try {
      const r = await axios.get(ordersUrl, {
        auth: { username: consumer_key, password: consumer_secret },
        params: { per_page: 100, status: 'any' },
        timeout: 15000,
        validateStatus: () => true,
      });
      if (r.status === 404) throw new Error('WooCommerce REST not found at ' + ordersUrl);
      if (r.status >= 400) throw new Error(`Woo API error ${r.status}: ${r.data?.message || 'Unknown'}`);
      orders = Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }

    const emailsSet = new Set();
    for (const o of orders) {
      const em = o?.billing?.email;
      if (em && /@/.test(em)) emailsSet.add(em.toLowerCase());
    }
    const emails = Array.from(emailsSet);

    // Try to subscribe to order.created webhook so new orders auto-sync
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`;
      const delivery = `${baseUrl}/api/webhooks/woocommerce`;
      await axios.post(`${base}/wp-json/wc/v3/webhooks`, {
        name: 'Automailer Orders',
        topic: 'order.created',
        delivery_url: delivery,
        secret: 'automailer'
      }, { auth: { username: consumer_key, password: consumer_secret }, timeout: 10000, validateStatus: ()=>true });
    } catch (_) { /* optional; ignore errors */ }

    // Save connection to Realtime Database under users/{uid}/integrations/woocommerce
    try {
      const db = getAdminDb();
      await db.ref(`users/${uid}/integrations/woocommerce`).set({
        platform: 'woocommerce',
        shopUrl: base,
        key: consumer_key,
        secret: consumer_secret,
        consumerKey: consumer_key,
        consumerSecret: consumer_secret,
        connectedAt: Date.now(),
        lastSynced: Date.now(),
        contactsCount: emails.length,
      });
      console.log('[WooCommerce] Successfully saved to Realtime Database');
    } catch (e) {
      console.error('[WooCommerce] Failed to save to database:', e.message);
      // Fallback: continue anyway so the response is sent to client
    }

    // Map store host → uid (for webhook -> user resolution)
    try {
      const db = getAdminDb();
      let host = '';
      try { host = new URL(base).host || base; } catch (_) { host = String(base||''); }
      const keyHost = host.toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '_');
      await db.ref(`storeOwners/${keyHost}`).set(uid);
    } catch (_) { /* non-fatal */ }

    // Mirror in 'stores' path
    try { 
      const db = getAdminDb();
      await db.ref(`stores/${uid}_woo`).set({ 
        shopUrl: base, 
        uid, 
        contactsCount: emails.length, 
        updatedAt: Date.now() 
      }); 
    } catch (_) {}

    // Local JSON backup per store
    const backupsDir = path.join(process.cwd(), '..', 'data', 'backups');
    const fileSafe = base.replace(/[^a-z0-9.-]/gi, '_');
    const filePath = path.join(backupsDir, `${fileSafe}.json`);
    await fs.promises.mkdir(backupsDir, { recursive: true });
    let existing = [];
    try { const raw = await fs.promises.readFile(filePath, 'utf8'); existing = JSON.parse(raw)?.emails || []; } catch (_) {}
    const setAll = new Set([ ...existing.map(e=>e.toLowerCase()), ...emails ]);
    const merged = Array.from(setAll);
    await fs.promises.writeFile(filePath, JSON.stringify({ account: base, emails: merged, updatedAt: Date.now() }, null, 2));

    // Remote backup
    if (backupApi) {
      try {
        await axios.post(backupApi, { account: base, emails: merged }, { timeout: 12000 });
      } catch (e) {
        // non-fatal
        console.warn('[backupApi] failed:', e.message);
      }
    }

    // Auto-upis u Firestore (users/{uid}/contacts) bez duplikata i odmah vrati ažuriran broj
    try {
      const firestore = admin.firestore();
      const baseCol = firestore.collection('users').doc(uid).collection('contacts');
      const now = admin.firestore.FieldValue.serverTimestamp();
      let created = 0, skipped = 0;
      for (const email of emails) {
        const id = email.toLowerCase();
        const ref = baseCol.doc(id);
        try {
          await ref.create({
            email: id,
            // legacy
            source: 'woocommerce',
            importedAt: now,
            // per spec
            sourceStore: 'woocommerce',
            dateImported: now,
            createdAt: new Date().toISOString(),
          });
          created++;
        } catch (_) { /* already exists */ }
      }
      // Update counts u Realtime DB
      try { const db = getAdminDb(); await db.ref(`users/${uid}/integrations/woocommerce/contactsCount`).set(admin.firestore.FieldValue?.increment ? undefined : emails.length); } catch(_) {}
    } catch (e) {
      console.warn('[Woo sync] Firestore write warning:', e.message);
    }

    // Mirror u Realtime Database: users/{uid}/contacts/{email}
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
          sourceStore: 'woocommerce',
          createdAt: new Date().toISOString(),
          dateImported: nowMs,
        };
      }
      if (Object.keys(updates).length) {
        await db.ref().update(updates);
      }
    } catch (e) {
      console.warn('[Woo sync] RTDB mirror warning:', e.message);
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
              SOURCE: 'woocommerce',
              STORE_URL: base,
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

    return res.status(200).json({ ok: true, account: base, emails, total: merged.length, filePath });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}



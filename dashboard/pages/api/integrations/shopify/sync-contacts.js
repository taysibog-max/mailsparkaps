import axios from 'axios';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';
import { getAdminDb } from '../../../../lib/firebaseAdminDb';
import * as admin from 'firebase-admin';

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    
    // Try Realtime DB first
    let integ = null;
    let shop = null;
    let accessToken = null;
    
    try {
      const db = getAdminDb();
      const snapshot = await db.ref(`users/${uid}/integrations/shopify`).once('value');
      integ = snapshot.val();
      if (integ) {
        shop = integ.shop;
        accessToken = integ.accessToken;
      }
    } catch (_) {}
    
    // Fallback to Firestore if not in RTDB
    if (!integ) {
      const integRef = adminDb.collection('users').doc(uid).collection('integrations').doc('shopify');
      const snap = await integRef.get();
      if (!snap.exists) return res.status(400).json({ error: 'No connected store' });
      integ = snap.data();
      shop = integ.shop;
      accessToken = integ.accessToken;
    }
    
    if (!shop || !accessToken) return res.status(400).json({ error: 'Invalid store configuration' });
    
    const base = `https://${shop}`.replace(/\/$/, '');

    async function fetchAllEmails() {
      const seen = new Set();
      let customersCount = 0;
      let ordersCount = 0;

      // 1) Customers endpoint (svi kupci sa emailom)
      let nextUrl = `${base}/admin/api/2024-07/customers.json?limit=250&fields=email`;
      while (nextUrl) {
        const r = await axios.get(nextUrl, {
          headers: { 'X-Shopify-Access-Token': accessToken },
          timeout: 20000,
          validateStatus: () => true,
        });
        if (r.status >= 400) throw new Error(`Shopify customers error ${r.status}`);
        const list = (r.data?.customers || []).map(c => c?.email).filter(Boolean);
        for (const e of list) seen.add(String(e).toLowerCase());
        customersCount += list.length;
        const link = r.headers?.link || r.headers?.Link;
        if (link && /rel="next"/i.test(link)) {
          const m = link.match(/<([^>]+)>; rel="next"/i);
          nextUrl = m ? m[1] : null;
        } else {
          nextUrl = null;
        }
      }

      // 2) Orders endpoint (fallback ako neki email nije u customers)
      //    Neki shopovi koriste contact_email umjesto email → povuci oba polja
      nextUrl = `${base}/admin/api/2024-07/orders.json?status=any&limit=250&fields=email,contact_email,customer,note_attributes`;
      while (nextUrl) {
        const r = await axios.get(nextUrl, {
          headers: { 'X-Shopify-Access-Token': accessToken },
          timeout: 20000,
          validateStatus: () => true,
        });
        if (r.status >= 400) throw new Error(`Shopify orders error ${r.status}`);
        const orders = Array.isArray(r.data?.orders) ? r.data.orders : [];
        const extracted = [];
        for (const o of orders) {
          const direct = o?.email || o?.contact_email || o?.customer?.email;
          if (direct) extracted.push(direct);
          // Some COD apps store email in note_attributes [{name, value}]
          const attrs = Array.isArray(o?.note_attributes) ? o.note_attributes : [];
          for (const a of attrs) {
            const key = String(a?.name||'').toLowerCase();
            const val = String(a?.value||'').trim();
            if (!val) continue;
            if (/(^|_|-|\s)(email|e-mail|mail)(_|-|\s|$)/i.test(key)) {
              extracted.push(val);
            }
          }
        }
        const list = extracted.filter(Boolean);
        for (const e of list) seen.add(String(e).toLowerCase());
        ordersCount += list.length;
        const link = r.headers?.link || r.headers?.Link;
        if (link && /rel="next"/i.test(link)) {
          const m = link.match(/<([^>]+)>; rel="next"/i);
          nextUrl = m ? m[1] : null;
        } else {
          nextUrl = null;
        }
      }

      // 3) Fallback: customers bez fields filtera (neki shopovi ne vraćaju email uz fields)
      if (seen.size === 0) {
        let next2 = `${base}/admin/api/2024-07/customers.json?limit=250`;
        while (next2) {
          const r2 = await axios.get(next2, {
            headers: { 'X-Shopify-Access-Token': accessToken },
            timeout: 20000,
            validateStatus: () => true,
          });
          if (r2.status >= 400) break;
          const list2 = (r2.data?.customers || []).map(c => c?.email).filter(Boolean);
          for (const e of list2) seen.add(String(e).toLowerCase());
          const link2 = r2.headers?.link || r2.headers?.Link;
          if (link2 && /rel="next"/i.test(link2)) {
            const m2 = link2.match(/<([^>]+)>; rel="next"/i);
            next2 = m2 ? m2[1] : null;
          } else {
            next2 = null;
          }
        }
      }

      const emails = Array.from(seen);
      return { emails, customersCount, ordersCount };
    }

    const { emails, customersCount, ordersCount } = await fetchAllEmails();
    
    // Write to Firestore
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
            source: 'shopify',
            importedAt: now,
            sourceStore: 'shopify',
            dateImported: now,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
      }
    } catch (writeErr) {
      console.warn('[Shopify sync] Firestore write warning:', writeErr.message);
    }
    
    // Mirror to Realtime Database
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
      await db.ref(`users/${uid}/integrations/shopify/lastSynced`).set(nowMs);
    } catch (e) {
      console.warn('[Shopify sync] RTDB mirror warning:', e.message);
    }
    
    // Auto-sync to Brevo
    try {
      const brevo = await import('../../../../lib/brevo');
      let brevoSynced = 0;
      for (const email of emails) {
        try {
          await brevo.addOrUpdateContact({
            email: email.toLowerCase(),
            attributes: {
              SOURCE: 'shopify',
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
    
    res.status(200).json({ emails, count: emails.length, customersCount, ordersCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}



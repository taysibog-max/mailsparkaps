import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb as adminFirestore } from '../../../lib/firebaseAdmin';
import { getAdminDb } from '../../../lib/firebaseAdminDb';

function getBearer(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  if (Array.isArray(header)) return header[0] ? header[0].replace(/^Bearer\s+/i, '') : null;
  return header.startsWith('Bearer ') ? header.slice(7) : header;
}

function parseNextLink(link?: string): string | null {
  if (!link) return null;
  const match = link.match(/<([^>]+)>;\s*rel="next"/i);
  return match ? match[1] : null;
}

function toContactKey(value: string) {
  return Buffer.from(String(value).toLowerCase())
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function fetchAllEmails(base: string, accessToken: string) {
  const seen = new Set<string>();
  let customersCount = 0;
  let ordersCount = 0;

  const fetchPage = async (url: string) => {
    const response = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': accessToken },
      timeout: 20000,
      validateStatus: () => true,
    });
    if (response.status >= 400) {
      throw new Error(`Shopify API error ${response.status}`);
    }
    return response;
  };

  // Customers endpoint (with fields filter)
  let nextCustomers: string | null = `${base}/admin/api/2024-07/customers.json?limit=250&fields=email`;
  while (nextCustomers) {
    const res = await fetchPage(nextCustomers);
    const list = Array.isArray(res.data?.customers) ? res.data.customers : [];
    const emails = list.map((c: any) => c?.email).filter(Boolean);
    emails.forEach((email: string) => seen.add(String(email).toLowerCase()));
    customersCount += emails.length;
    nextCustomers = parseNextLink(res.headers?.link || res.headers?.Link);
  }

  // Orders endpoint fallback (captures contact_email/note_attributes)
  let nextOrders: string | null =
    `${base}/admin/api/2024-07/orders.json?status=any&limit=250&fields=email,contact_email,customer,note_attributes`;
  while (nextOrders) {
    const res = await fetchPage(nextOrders);
    const orders = Array.isArray(res.data?.orders) ? res.data.orders : [];
    const extracted: string[] = [];
    for (const order of orders) {
      const candidate =
        order?.email ||
        order?.contact_email ||
        order?.customer?.email;
      if (candidate) extracted.push(candidate);

      const attrs = Array.isArray(order?.note_attributes) ? order.note_attributes : [];
      for (const attr of attrs) {
        const key = String(attr?.name || '').toLowerCase();
        const val = String(attr?.value || '').trim();
        if (!val) continue;
        if (/(^|_|-|\s)(email|e-mail|mail)(_|-|\s|$)/i.test(key)) {
          extracted.push(val);
        }
      }
    }
    extracted
      .filter(Boolean)
      .forEach((email: string) => seen.add(String(email).toLowerCase()));
    ordersCount += extracted.length;
    nextOrders = parseNextLink(res.headers?.link || res.headers?.Link);
  }

  // Fallback customers fetch without fields (some stores ignore fields param)
  if (seen.size === 0) {
    let next = `${base}/admin/api/2024-07/customers.json?limit=250`;
    while (next) {
      const res = await fetchPage(next);
      const list = Array.isArray(res.data?.customers) ? res.data.customers : [];
      const emails = list.map((c: any) => c?.email).filter(Boolean);
      emails.forEach((email: string) => seen.add(String(email).toLowerCase()));
      next = parseNextLink(res.headers?.link || res.headers?.Link);
    }
  }

  return { emails: Array.from(seen), customersCount, ordersCount };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminDb();
    let shop: string | null = null;
    let accessToken: string | null = null;

    try {
      const snapshot = await db.ref(`users/${uid}/integrations/shopify`).get();
      if (snapshot.exists()) {
        const integ = snapshot.val() || {};
        shop = integ.shop;
        accessToken = integ.accessToken;
      }
    } catch {
      // ignore RTDB failures; fallback to Firestore below
    }

    if (!shop || !accessToken) {
      const snap = await adminFirestore
        .collection('users')
        .doc(uid)
        .collection('integrations')
        .doc('shopify')
        .get();
      if (snap.exists) {
        const data = snap.data() || {};
        shop = shop || data.shop;
        accessToken = accessToken || data.accessToken;
      }
    }

    if (!shop || !accessToken) {
      return res.status(400).json({ error: 'No connected store' });
    }

    const base = `https://${String(shop).replace(/^https?:\/\//, '')}`.replace(/\/$/, '');
    const { emails, customersCount, ordersCount } = await fetchAllEmails(base, accessToken);

    // Persist to Firestore
    try {
      const now = admin.firestore.FieldValue.serverTimestamp();
      const contactsCol = adminFirestore.collection('users').doc(uid).collection('contacts');
      for (const email of emails) {
        const id = email.toLowerCase();
        const ref = contactsCol.doc(id);
        try {
          await ref.create({
            email: id,
            source: 'shopify',
            sourceStore: 'shopify',
            importedAt: now,
            dateImported: now,
            createdAt: new Date().toISOString(),
          });
        } catch {
          // ignore duplicates
        }
      }
    } catch (err) {
      console.warn('[Shopify sync] Firestore write warning:', (err as Error).message);
    }

    // Mirror to Realtime Database
    try {
      const nowMs = Date.now();
      const updates: Record<string, any> = {};
      for (const email of emails) {
        const id = String(email).toLowerCase();
        updates[`users/${uid}/contacts/${toContactKey(id)}`] = {
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
      await db.ref(`users/${uid}/integrations/shopify/contactsCount`).set(emails.length);
    } catch (err) {
      console.warn('[Shopify sync] RTDB mirror warning:', (err as Error).message);
    }

    // Sync to Brevo
    try {
      const brevo = await import('../../../lib/brevo');
      let synced = 0;
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
          synced++;
        } catch (brevoErr: any) {
          console.warn(`[Brevo] Failed to sync ${email}:`, brevoErr?.message || brevoErr);
        }
      }
      console.log(`[Brevo] Successfully synced ${synced}/${emails.length} contacts`);
    } catch (err) {
      console.warn('[Brevo] Auto-sync warning:', (err as Error).message);
    }

    return res.status(200).json({ emails, count: emails.length, customersCount, ordersCount });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}


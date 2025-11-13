import axios from 'axios';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const userRef = adminDb.collection('users').doc(uid);
    const integRef = userRef.collection('integrations').doc('woocommerce');
    const integSnap = await integRef.get();
    const woo = integSnap.exists ? integSnap.data() : null;
    if (!woo) return res.status(400).json({ error: 'No connected store' });

    const now = Date.now();
    const lastSynced = woo?.lastSynced || 0;
    if (!req.query.force && now - lastSynced < 24*60*60*1000) {
      return res.status(200).json({ ok: true, skipped: true, lastSynced });
    }

    const base = woo.shopUrl.replace(/\/$/, '');
    const consumerKey = woo.consumerKey || woo.key;
    const consumerSecret = woo.consumerSecret || woo.secret;
    const endpoints = [
      `${base}/wp-json/wc/v3/orders`,
      `${base}/wp-json/wc/v2/orders`,
      `${base}/?rest_route=/wc/v3/orders`,
      `${base}/?rest_route=/wc/v2/orders`,
    ];
    let orders = [];
    let lastErr;
    for (const ep of endpoints) {
      try {
        const r1 = await axios.get(ep, { auth: { username: consumerKey, password: consumerSecret }, params: { per_page: 100, status: 'any' }, timeout: 15000 });
        orders = Array.isArray(r1.data) ? r1.data : [];
        if (orders.length) break;
      } catch (e) { lastErr = e; }
      try {
        const r2 = await axios.get(ep, { params: { per_page: 100, status: 'any', consumer_key: consumerKey, consumer_secret: consumerSecret }, timeout: 15000 });
        orders = Array.isArray(r2.data) ? r2.data : [];
        if (orders.length) break;
      } catch (e) { lastErr = e; }
    }
    if (!Array.isArray(orders)) orders = [];
    const emailSet = new Set();
    for (const o of orders) { const e = o?.billing?.email; if (e && /@/.test(e)) emailSet.add(e.toLowerCase()); }
    const emails = Array.from(emailSet);

    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      await Promise.allSettled(emails.map(e => axios.post('https://api.brevo.com/v3/contacts', { email: e }, { headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' } })));
    }

    const batch = adminDb.batch();
    const contactsCol = adminDb.collection('contacts');
    emails.forEach(email => {
      const doc = contactsCol.doc(`${uid}_woo_${email}`);
      batch.set(doc, { uid, source: 'woocommerce', storeUrl: woo.shopUrl, email, createdAt: adminDb.app.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
    batch.set(integRef, { ...woo, lastSynced: now, contactsCount: emails.length }, { merge: true });
    await batch.commit();

    return res.status(200).json({ ok: true, emails, lastSynced: now, count: emails.length });
  } catch (e) {
    const msg = e.response?.data?.message || e.message || 'Sync failed';
    return res.status(500).json({ error: msg });
  }
}



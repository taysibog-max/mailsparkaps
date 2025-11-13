import { getAdminDb } from '../../../../lib/firebaseAdminDb';
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { userId, apiUrl, key, secret } = req.body || {};
    if (!userId || !apiUrl || !key || !secret) return res.status(400).json({ error: 'Missing fields' });

    const db = getAdminDb();
    await db.ref(`stores/${userId}_woo`).set({ type: 'woo', apiUrl, key, secret, userId });

    // Optionally pull customers and push to Brevo contacts
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      const cust = await axios.get(apiUrl + '/wp-json/wc/v3/customers', {
        auth: { username: key, password: secret }, params: { per_page: 50 }
      });
      const emails = (cust.data || []).map(c => c.email).filter(Boolean);
      await Promise.all(emails.map(e => axios.post('https://api.brevo.com/v3/contacts', { email: e }, { headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' } })));
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}



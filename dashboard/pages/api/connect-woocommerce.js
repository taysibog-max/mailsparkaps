import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { shopUrl, key, secret } = req.body || {};
    if (!shopUrl || !key || !secret) return res.status(400).json({ error: 'Missing fields' });

    // Normalize base URL
    const base = shopUrl.replace(/\/$/, '');

    // Fetch orders (first 100) via WooCommerce REST API
    const ordersUrl = `${base}/wp-json/wc/v3/orders`;
    const r = await axios.get(ordersUrl, {
      auth: { username: key, password: secret },
      params: { per_page: 100, status: 'any' },
      timeout: 15000,
    });
    const orders = Array.isArray(r.data) ? r.data : [];

    // Extract unique emails from billing
    const emailSet = new Set();
    for (const o of orders) {
      const e = o?.billing?.email;
      if (e && /@/.test(e)) emailSet.add(e.toLowerCase());
    }
    const emails = Array.from(emailSet);

    // Push to Brevo contacts (best-effort)
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      await Promise.allSettled(emails.map(e => axios.post('https://api.brevo.com/v3/contacts', { email: e }, { headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' } })));
    }

    return res.status(200).json({ ok: true, count: emails.length, emails });
  } catch (err) {
    return res.status(500).json({ error: err.response?.data?.message || err.message || 'Failed to connect' });
  }
}



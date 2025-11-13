export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Mock connect: validate inputs and return fake status
  const { shopUrl, key, secret } = req.body || {};
  if (!shopUrl || !key || !secret) return res.status(400).json({ error: 'Missing fields' });
  await new Promise(r=>setTimeout(r, 400));
  return res.status(200).json({ ok: true, connected: true, lastSyncAt: Date.now() });
}



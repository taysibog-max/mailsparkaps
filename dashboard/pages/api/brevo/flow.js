export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const api = (await import('../../../lib/brevo')).default;
    const payload = req.body || {};
    const { data } = await api.post('/automation/flows', payload);
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}



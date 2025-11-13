import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';

const API = 'https://api.brevo.com/v3';

export default async function handler(req, res){
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')? authHeader.slice(7): null;
    if(!token) return res.status(401).json({ error: 'Missing token' });
    const { uid } = await adminAuth.verifyIdToken(token);

    const apiKey = process.env.BREVO_API_KEY;
    const headers = { 'api-key': apiKey, 'accept': 'application/json', 'content-type': 'application/json' };

    if(req.method === 'GET'){
      // Simplified list of campaigns
      const r = await fetch(API + '/emailCampaigns?limit=50', { headers });
      const data = await r.json();
      const items = (data?.campaigns || []).map(c => ({ id: c.id, name: c.name, subject: c.subject }));
      return res.status(200).json({ ok: true, items });
    }
    if(req.method === 'POST'){
      const { name, subject } = req.body || {};
      const body = { name, subject, type: 'classic', sender: { name: 'Automailer', email: process.env.BREVO_SENDER_EMAIL || 'no-reply@example.com' }, htmlContent: '<p>Hello world</p>', recipients: { listIds: [] } };
      const r = await fetch(API + '/emailCampaigns', { method:'POST', headers, body: JSON.stringify(body) });
      const data = await r.json();
      if(!r.ok) return res.status(r.status).json({ error: data?.message || 'Brevo error' });
      await adminDb.collection('userActions').add({ userId: uid, type: 'create_campaign', id: data?.id, ts: new Date() });
      return res.status(200).json({ ok: true, id: data?.id });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}



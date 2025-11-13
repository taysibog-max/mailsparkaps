import brevo from '../../../services/brevoService';
import axios from 'axios';

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name } = req.body || {};
    const api = (await import('../../../lib/brevo')).default;
    const { data } = await api.post('/contacts/lists', { name: name || 'Automailer List' });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}



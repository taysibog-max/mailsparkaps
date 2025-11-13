import { getCampaigns } from '../../services/brevoService';

export default async function handler(req, res) {
  try {
    const data = await getCampaigns();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}



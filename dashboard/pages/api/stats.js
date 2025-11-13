import { getStats } from '../../services/brevoService';

export default async function handler(req, res) {
  // quick cache for 10 seconds to avoid repeated upstream calls in dev
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=59');
  try {
    const data = await getStats();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}



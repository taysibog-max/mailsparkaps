import { getContactDetails } from '../../../services/brevoService';

export default async function handler(req, res) {
  const { email } = req.query;
  try {
    const data = await getContactDetails(email);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}



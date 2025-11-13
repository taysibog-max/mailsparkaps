import { adminAuth } from '../../../lib/firebaseAdmin';
import { getTemplates } from '../../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await adminAuth.verifyIdToken(token);

    // Get all templates from Brevo
    const templates = await getTemplates();

    res.status(200).json({
      success: true,
      templates: templates.templates || [],
      count: templates.count || 0,
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      error: 'Failed to get templates',
      details: error.message,
    });
  }
}



import { adminAuth } from '../../../lib/firebaseAdmin';
import brevo from '../../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify user authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Get all lists (segments) from Brevo
    const lists = await brevo.getLists();

    return res.status(200).json({ 
      success: true,
      segments: lists.lists || []
    });
  } catch (error) {
    console.error('Get segments error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch segments',
      details: error.message 
    });
  }
}



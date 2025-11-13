import { adminAuth } from '../../../lib/firebaseAdmin';
import brevo from '../../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { name, folderName } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Segment name is required' });
    }

    // Create new list (segment) in Brevo
    const result = await brevo.createList(name, folderName);

    return res.status(200).json({ 
      success: true,
      segment: result
    });
  } catch (error) {
    console.error('Create segment error:', error);
    return res.status(500).json({ 
      error: 'Failed to create segment',
      details: error.message 
    });
  }
}



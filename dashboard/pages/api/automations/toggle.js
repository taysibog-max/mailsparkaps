import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';

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

    const { automationId, status } = req.body;

    if (!automationId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Update automation status in Firestore
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('automations')
      .doc(automationId)
      .update({
        status,
        updatedAt: new Date().toISOString(),
      });

    return res.status(200).json({ 
      success: true,
      status
    });
  } catch (error) {
    console.error('Toggle automation error:', error);
    return res.status(500).json({ 
      error: 'Failed to toggle automation',
      details: error.message 
    });
  }
}



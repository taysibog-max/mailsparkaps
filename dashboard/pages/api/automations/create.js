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

    const { type, name, trigger, delay, status } = req.body;

    if (!type || !name || !trigger) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create automation in Firestore
    const automationData = {
      type,
      name,
      trigger,
      delay: delay || 0,
      status: status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      emailsSent: 0,
    };

    const docRef = await adminDb
      .collection('users')
      .doc(uid)
      .collection('automations')
      .add(automationData);

    return res.status(200).json({ 
      success: true,
      automation: { id: docRef.id, ...automationData }
    });
  } catch (error) {
    console.error('Create automation error:', error);
    return res.status(500).json({ 
      error: 'Failed to create automation',
      details: error.message 
    });
  }
}



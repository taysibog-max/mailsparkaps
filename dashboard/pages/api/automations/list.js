import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';

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

    // Get automations from Firestore
    const automationsRef = adminDb.collection('users').doc(uid).collection('automations');
    const snapshot = await automationsRef.get();

    const automations = [];
    snapshot.forEach(doc => {
      automations.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({ 
      success: true,
      automations
    });
  } catch (error) {
    console.error('Get automations error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch automations',
      details: error.message 
    });
  }
}



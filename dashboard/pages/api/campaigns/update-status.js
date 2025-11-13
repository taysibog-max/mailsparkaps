import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const { campaignId, status } = req.body;

    if (!campaignId || !status) {
      return res.status(400).json({ error: 'Campaign ID and status are required' });
    }

    console.log('[Campaign Update] Updating campaign status:', campaignId, '→', status);

    const campaignRef = adminDatabase.ref(`users/${uid}/campaigns/${campaignId}`);
    
    const snapshot = await campaignRef.once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    await campaignRef.update({
      status,
      updatedAt: Date.now(),
    });

    console.log('[Campaign Update] ✅ Status updated successfully');

    res.status(200).json({
      success: true,
      message: `Campaign ${status === 'active' ? 'activated' : 'paused'} successfully`,
    });

  } catch (error) {
    console.error('Error updating campaign status:', error);
    res.status(500).json({
      error: 'Failed to update campaign status',
      details: error.message,
    });
  }
}








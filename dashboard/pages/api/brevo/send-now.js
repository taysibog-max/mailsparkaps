import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';
import { sendCampaign } from '../../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID is required' });
    }

    // Send campaign immediately
    await sendCampaign(campaignId);

    // Update campaign status in Firestore
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('campaigns')
      .doc(campaignId.toString())
      .update({
        status: 'sent',
        sentAt: new Date().toISOString(),
      });

    console.log(`✅ Campaign sent: ${campaignId} for user ${uid}`);

    res.status(200).json({
      success: true,
      message: 'Campaign sent successfully',
    });
  } catch (error) {
    console.error('Send campaign error:', error);
    res.status(500).json({
      error: 'Failed to send campaign',
      details: error.message,
    });
  }
}

import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';
import { createCampaign } from '../../../lib/brevo';

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

    const {
      name,
      subject,
      senderName,
      senderEmail,
      replyTo,
      htmlContent,
      listIds = [],
      scheduledAt = null,
    } = req.body;

    if (!name || !subject || !senderEmail || !htmlContent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create campaign in Brevo
    const campaign = await createCampaign({
      name,
      subject,
      sender: { name: senderName, email: senderEmail },
      replyTo: replyTo || senderEmail,
      htmlContent,
      recipients: { listIds },
      scheduledAt,
    });

    // Save campaign metadata to Firestore
    await adminDb.collection('users').doc(uid).collection('campaigns').doc(campaign.id.toString()).set({
      brevoId: campaign.id,
      name,
      subject,
      senderName,
      senderEmail,
      createdAt: new Date().toISOString(),
      status: 'draft',
      type: 'manual',
    });

    console.log(`✅ Campaign created in Brevo: ${campaign.id} for user ${uid}`);

    res.status(200).json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({
      error: 'Failed to create campaign',
      details: error.message,
    });
  }
}

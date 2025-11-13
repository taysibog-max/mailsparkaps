import { adminDb, adminAuth } from '../../../lib/firebaseAdmin';

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
      type,
      subject,
      senderName,
      senderEmail,
      replyTo,
      templateId,
      delayValue,
      delayUnit,
      enabled,
      body // For backward compatibility
    } = req.body;

    if (!type || !subject) {
      return res.status(400).json({ error: 'Type and subject are required' });
    }

    // Convert delay to hours for storage
    let delayHours = 0;
    if (delayValue && delayUnit) {
      switch (delayUnit) {
        case 'minutes':
          delayHours = delayValue / 60;
          break;
        case 'hours':
          delayHours = delayValue;
          break;
        case 'days':
          delayHours = delayValue * 24;
          break;
        default:
          delayHours = delayValue;
      }
    }

    // Save campaign config to Firestore
    const campaignRef = adminDb.collection('users').doc(uid).collection('campaigns').doc(type);
    
    const campaignData = {
      type,
      subject,
      senderName: senderName || 'Your Store',
      senderEmail: senderEmail || 'noreply@yourstore.com',
      replyTo: replyTo || senderEmail || 'noreply@yourstore.com',
      templateId: templateId || '',
      delayValue: delayValue || 1,
      delayUnit: delayUnit || 'hours',
      delayHours,
      enabled: enabled || false,
      status: enabled ? 'active' : 'draft',
      updatedAt: new Date().toISOString(),
      sent: 0,
      opens: 0,
      clicks: 0,
    };

    // Add body if provided (for backward compatibility)
    if (body) {
      campaignData.body = body;
    }

    const existingDoc = await campaignRef.get();
    if (!existingDoc.exists) {
      campaignData.createdAt = new Date().toISOString();
    }

    await campaignRef.set(campaignData, { merge: true });

    console.log(`✅ Campaign saved: ${type} for user ${uid} (${enabled ? 'active' : 'draft'})`);

    res.status(200).json({
      success: true,
      ok: true, // Backward compatibility
      campaign: campaignData
    });
  } catch (error) {
    console.error('Save campaign error:', error);
    res.status(500).json({
      error: 'Failed to save campaign',
      details: error.message
    });
  }
}

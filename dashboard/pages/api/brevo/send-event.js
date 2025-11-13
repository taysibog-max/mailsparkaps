import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';
import { trackEvent } from '../../../lib/brevo';

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

    const { email, event, properties = {} } = req.body;

    if (!email || !event) {
      return res.status(400).json({ error: 'Email and event are required' });
    }

    // Track event in Brevo (this will trigger automation workflows)
    await trackEvent({
      email,
      event,
      properties: {
        ...properties,
        userId: uid,
        timestamp: new Date().toISOString(),
      },
    });

    // Save event to Firestore for tracking
    await adminDb.collection('users').doc(uid).collection('events').add({
      email,
      event,
      properties,
      createdAt: new Date().toISOString(),
    });

    console.log(`✅ Event tracked: ${event} for ${email} by user ${uid}`);

    res.status(200).json({
      success: true,
      message: 'Event tracked successfully',
    });
  } catch (error) {
    console.error('Track event error:', error);
    res.status(500).json({
      error: 'Failed to track event',
      details: error.message,
    });
  }
}



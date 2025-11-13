import { adminAuth } from '../../../lib/firebaseAdmin';
import { addOrUpdateContact } from '../../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify user authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const { email, attributes = {}, listIds = [] } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Add or update contact in Brevo
    const result = await addOrUpdateContact({
      email,
      attributes: {
        ...attributes,
        USER_ID: uid, // Track which user added this contact
      },
      listIds,
    });

    console.log(`✅ Contact added to Brevo: ${email} for user ${uid}`);

    res.status(200).json({
      success: true,
      contact: result,
    });
  } catch (error) {
    console.error('Add contact to Brevo error:', error);
    res.status(500).json({
      error: 'Failed to add contact to Brevo',
      details: error.message,
    });
  }
}

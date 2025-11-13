import { adminAuth, getAdminDb } from '../../../lib/firebaseAdmin';
import { adminDb } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get user ID from Authorization header
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    let uid;
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid token', details: error.message });
    }

    // Base64URL encode email for RTDB key
    const emailKey = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Delete from Firestore
    try {
      await adminDb.collection('users').doc(uid).collection('contacts').doc(email).delete();
      console.log(`✅ Deleted from Firestore: ${email}`);
    } catch (firestoreError) {
      console.error('Firestore delete error:', firestoreError);
    }

    // Delete from Realtime Database
    try {
      const rtdb = getAdminDb();
      await rtdb.ref(`users/${uid}/contacts/${emailKey}`).remove();
      console.log(`✅ Deleted from RTDB: ${email} (key: ${emailKey})`);
    } catch (rtdbError) {
      console.error('RTDB delete error:', rtdbError);
    }

    console.log(`✅ Contact deleted from both databases: ${email} for user ${uid}`);

    res.status(200).json({ 
      success: true, 
      message: `Contact ${email} deleted successfully from both databases` 
    });

  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ 
      error: 'Failed to delete contact',
      details: error.message 
    });
  }
}

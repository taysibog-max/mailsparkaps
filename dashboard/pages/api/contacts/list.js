/**
 * Contacts List API
 * GET /api/contacts/list
 * 
 * Returns all contacts for the authenticated user
 */

import { adminAuth } from '../../../lib/firebaseAdmin';
import { getAllContacts, getContactStats } from '../../../lib/contactsHelpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    console.log('[Contacts List] Fetching contacts for user:', uid);

    // Get Firebase Admin Database
    const { adminDatabase } = await import('../../../lib/firebaseAdmin');

    // Get all contacts
    const contacts = await getAllContacts(adminDatabase, uid);

    // Get statistics
    const stats = getContactStats(contacts);

    console.log(`[Contacts List] ✅ Found ${contacts.length} contacts`);

    return res.status(200).json({
      success: true,
      contacts,
      stats,
      total: contacts.length,
    });

  } catch (error) {
    console.error('[Contacts List] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch contacts',
      details: error.message,
    });
  }
}









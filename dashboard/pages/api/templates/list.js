/**
 * API endpoint za povlačenje svih template-a iz Firebase Realtime Database
 * Vraća template-e za trenutnog korisnika
 */

import { adminAuth } from '../../../lib/firebaseAdmin';
import admin from 'firebase-admin';

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

    console.log('[Templates List] Loading templates for user:', uid);

    // Initialize Firebase Realtime Database
    const { adminDatabase } = await import('../../../lib/firebaseAdmin');
    const userTemplatesRef = adminDatabase.ref(`users/${uid}/email_templates`);

    // Get all templates for this user
    const snapshot = await userTemplatesRef.once('value');
    const templatesData = snapshot.val();

    if (!templatesData) {
      console.log('[Templates List] No templates found for user');
      return res.status(200).json({
        success: true,
        templates: [],
      });
    }

    // Convert object to array
    const templates = Object.keys(templatesData).map(key => ({
      ...templatesData[key],
      id: key,
    }));

    console.log('[Templates List] ✅ Found', templates.length, 'templates');

    res.status(200).json({
      success: true,
      templates,
    });

  } catch (error) {
    console.error('[Templates List] ❌ Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}


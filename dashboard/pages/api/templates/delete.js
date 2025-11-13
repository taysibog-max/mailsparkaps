/**
 * API endpoint za brisanje template-a iz Firebase Realtime Database
 */

import { adminAuth } from '../../../lib/firebaseAdmin';
import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
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

    // Get template ID from query or body
    const templateId = req.query.id || req.body.templateId;
    
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    console.log('[Template Delete] Deleting template:', templateId, 'for user:', uid);

    // Initialize Firebase Realtime Database
    const { adminDatabase } = await import('../../../lib/firebaseAdmin');
    const templateRef = adminDatabase.ref(`users/${uid}/email_templates/${templateId}`);

    // Check if template exists
    const snapshot = await templateRef.once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Delete template
    await templateRef.remove();

    console.log('[Template Delete] ✅ Template deleted successfully');

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully',
    });

  } catch (error) {
    console.error('[Template Delete] ❌ Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}


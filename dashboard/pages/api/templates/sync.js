/**
 * API endpoint za sinhronizaciju Brevo template-a u Firebase Realtime Database
 * Povlači template-e sa Brevo API-ja i čuva ih pod email_templates/{userId}
 */

import { adminAuth } from '../../../lib/firebaseAdmin';
import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    console.log('[Template Sync] Syncing Brevo templates for user:', uid);

    // Get Brevo API key from user's data or env
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      return res.status(400).json({ error: 'Brevo API key not configured' });
    }

    // Fetch templates from Brevo API
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/templates', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api-key': brevoApiKey,
      },
    });

    if (!brevoResponse.ok) {
      const errorData = await brevoResponse.json();
      console.error('[Template Sync] Brevo API error:', errorData);
      return res.status(brevoResponse.status).json({
        error: 'Failed to fetch templates from Brevo',
        details: errorData,
      });
    }

    const brevoData = await brevoResponse.json();
    const templates = brevoData.templates || [];

    console.log('[Template Sync] Found', templates.length, 'templates from Brevo');

    // Initialize Firebase Realtime Database
    const { adminDatabase } = await import('../../../lib/firebaseAdmin');
    const userTemplatesRef = adminDatabase.ref(`users/${uid}/email_templates`);

    // Save each template to Firebase
    const savePromises = templates.map(async (template) => {
      const templateData = {
        id: `brevo_${template.id}`,
        brevoTemplateId: template.id,
        name: template.name,
        subject: template.subject || '',
        htmlContent: template.htmlContent || '',
        isActive: template.isActive || false,
        sender: {
          name: template.sender?.name || '',
          email: template.sender?.email || '',
        },
        source: 'brevo',
        createdAt: template.createdAt || Date.now(),
        updatedAt: Date.now(),
        syncedAt: Date.now(),
      };

      await userTemplatesRef.child(`brevo_${template.id}`).set(templateData);
      return templateData;
    });

    const savedTemplates = await Promise.all(savePromises);

    console.log('[Template Sync] ✅ Saved', savedTemplates.length, 'templates to Firebase');

    res.status(200).json({
      success: true,
      count: savedTemplates.length,
      templates: savedTemplates,
    });

  } catch (error) {
    console.error('[Template Sync] ❌ Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}


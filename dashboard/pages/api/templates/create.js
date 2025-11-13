/**
 * API endpoint za kreiranje novog template-a sa OpenAI generisanim sadržajem
 * Čuva template u Firebase Realtime Database
 */

import { adminAuth } from '../../../lib/firebaseAdmin';
import admin from 'firebase-admin';
import { generateEmailContent } from '../../../lib/openai';

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

    const {
      name,
      campaignType,
      customerData = {},
      senderName,
      senderEmail,
      customSubject,
      customBody,
      useAI = true,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    console.log('[Template Create] Creating template:', name, 'for user:', uid);

    // Generate email content with OpenAI or use custom content
    let subject, body;
    
    if (customSubject && customBody) {
      // Use custom content provided by user
      subject = customSubject;
      body = customBody;
      console.log('[Template Create] Using custom content provided by user');
    } else if (useAI && campaignType) {
      // Generate with AI
      try {
        const generated = await generateEmailContent(campaignType, customerData);
        subject = generated.subject;
        body = generated.body;
        console.log('[Template Create] Content generated with OpenAI');
      } catch (aiError) {
        console.error('[Template Create] OpenAI generation failed:', aiError);
        return res.status(500).json({
          error: 'Failed to generate email content with AI',
          details: aiError.message,
        });
      }
    } else {
      // Default fallback
      subject = `Email from ${senderName || 'Your Store'}`;
      body = 'Hello! Thank you for your interest.';
      console.log('[Template Create] Using default content');
    }

    // Create template data
    const templateId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const templateData = {
      id: templateId,
      name,
      subject,
      htmlContent: body.replace(/\n/g, '<br>'),
      isActive: true,
      sender: {
        name: senderName || 'Your Store',
        email: senderEmail || process.env.BREVO_SENDER_EMAIL || 'noreply@example.com',
      },
      source: 'custom',
      campaignType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      generatedWithAI: true,
    };

    // Save to Firebase Realtime Database
    const { adminDatabase } = await import('../../../lib/firebaseAdmin');
    const templateRef = adminDatabase.ref(`users/${uid}/email_templates/${templateId}`);
    await templateRef.set(templateData);

    console.log('[Template Create] ✅ Template created successfully');

    res.status(200).json({
      success: true,
      template: templateData,
    });

  } catch (error) {
    console.error('[Template Create] ❌ Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

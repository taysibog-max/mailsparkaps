import { adminAuth } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      await adminAuth.verifyIdToken(token);
    } catch (authError) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Validate request body
    const { name, subject, sender, htmlContent, recipients, type, status, metadata } = req.body;

    if (!name || !subject || !sender?.name || !sender?.email || !htmlContent) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, subject, sender (name, email), htmlContent' 
      });
    }

    // Validate Brevo API key
    if (!process.env.BREVO_API_KEY) {
      console.error('BREVO_API_KEY not configured');
      return res.status(500).json({ error: 'Brevo API key not configured' });
    }

    // Normalize our campaign "automation" type (for RTDB), Brevo stays 'classic'
    const normalizeType = (t) => String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s-]+/g, '_')
      .trim();
    const requestedCampaignType = metadata?.campaignType || type; // UI sends metadata.campaignType
    const normalizedAutomationType = normalizeType(requestedCampaignType || 'abandoned_cart');

    // Prepare payload for Brevo API
    const payload = {
      name,
      subject,
      sender: {
        name: sender.name,
        email: sender.email,
      },
      htmlContent,
      // Brevo expects 'classic' or 'template', keep it stable regardless of our automation type
      type: 'classic',
    };

    // Only add recipients if provided (not required for drafts)
    if (recipients) {
      payload.recipients = recipients;
    }

    // Add status if provided
    if (status) {
      payload.status = status;
    }

    console.log('Creating Brevo campaign:', { name, subject, sender: sender.email });

    // Call Brevo API
    const brevoResponse = await fetch('https://api.brevo.com/v3/emailCampaigns', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error('Brevo API error:', responseData);
      return res.status(brevoResponse.status).json({
        error: responseData.message || 'Failed to create campaign in Brevo',
        details: responseData,
      });
    }

    console.log('Brevo campaign created successfully:', responseData.id);

    // Save campaign to Firebase Realtime Database
    try {
      const { adminDatabase } = await import('../../lib/firebaseAdmin');
      const decodedToken = await adminAuth.verifyIdToken(token);
      const uid = decodedToken.uid;
      
      const campaignData = {
        id: responseData.id,
        name,
        subject,
        sender: {
          name: sender.name,
          email: sender.email,
        },
        // Store our automation type normalized so CRON/automation can match immediately
        type: normalizedAutomationType,
        status: status || 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        brevoId: responseData.id,
        metadata: {
          ...(metadata || {}),
          campaignType: normalizedAutomationType,
        },
        // Persist template so automation can use the exact dashboard content
        htmlContent: req.body.htmlContent || '',
        templateId: req.body.templateId || null,
      };

      // Store under campaigns or campaigns_drafts based on status
      const basePath = (campaignData.status === 'draft') ? 'campaigns_drafts' : 'campaigns';
      await adminDatabase.ref(`users/${uid}/${basePath}/${responseData.id}`).set(campaignData);

      // Purge old abandoned checkout events so a new campaign starts clean
      try {
        await adminDatabase.ref(`events/${uid}/cart_abandoned`).remove();
        console.log('[Campaign Create] Cleared abandoned cart events for user', uid);
      } catch (_) {}
      // Purge legacy per-user abandoned carts list used by dashboard view
      try {
        await adminDatabase.ref(`users/${uid}/abandoned_carts`).remove();
        console.log('[Campaign Create] Cleared users/${uid}/abandoned_carts');
      } catch (_) {}
      console.log('Campaign saved to Firebase for user:', uid);
    } catch (firebaseError) {
      console.error('Failed to save to Firebase:', firebaseError);
      // Don't fail the whole request if Firebase save fails
    }

    // Return success response
    return res.status(200).json({
      success: true,
      campaign: responseData,
      id: responseData.id,
      message: 'Campaign created successfully',
    });

  } catch (error) {
    console.error('Create campaign error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
    });
  }
}


/**
 * Automation Trigger
 * POST /api/automation/trigger
 * 
 * Triggered by webhooks or CRON jobs
 * Processes events and sends automated emails
 */

import { adminDatabase } from '../../../lib/firebaseAdmin';
import {
  generateEmailContent,
  wasEmailSent,
  markEmailAsSent,
  getActiveCampaign,
  sendAutomatedEmail,
} from '../../../lib/automationHelpers';
import { updateContactEmailStats } from '../../../lib/contactsHelpers';

// Map event types to campaign types
const EVENT_TO_CAMPAIGN_MAP = {
  cart_abandoned: 'abandoned_cart',
  order_created: 'post_purchase',
  customer_created: 'welcome_email',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, eventId, eventType, eventData } = req.body;
    let resolvedUserId = userId;

    if (!userId || !eventId || !eventType) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, eventId, eventType' 
      });
    }

    console.log('[Automation] Processing event:', eventType, 'for user:', resolvedUserId);

    // Get corresponding campaign type
    const campaignType = EVENT_TO_CAMPAIGN_MAP[eventType];
    if (!campaignType) {
      console.log('[Automation] No campaign mapping for event type:', eventType);
      return res.status(200).json({
        success: true,
        message: 'No automation configured for this event type',
      });
    }

    // Check if email was already sent (duplicate prevention)
    const alreadySent = await wasEmailSent(adminDatabase, resolvedUserId, eventId, campaignType);
    if (alreadySent) {
      console.log('[Automation] Email already sent for:', eventId, campaignType);
      return res.status(200).json({
        success: true,
        message: 'Email already sent (duplicate prevented)',
      });
    }

    // Get active campaign for this type
    let campaign = await getActiveCampaign(adminDatabase, resolvedUserId, campaignType);
    if (!campaign) {
      // Fallback auto-discovery: some webhooks may come with shop-domain as userId.
      // Try to find any user's active campaign matching this type.
      try {
        const usersSnap = await adminDatabase.ref('users').once('value');
        if (usersSnap.exists()) {
          const allUsers = usersSnap.val() || {};
          for (const [candidateUid, userNode] of Object.entries(allUsers)) {
            try {
              const campaignsNode = userNode?.campaigns || {};
              const foundId = Object.keys(campaignsNode).find(id => {
                const c = campaignsNode[id];
                return c?.status === 'active' && c?.metadata?.campaignType === campaignType;
              });
              if (foundId) {
                resolvedUserId = candidateUid; // redirect processing to this user
                campaign = { id: foundId, ...campaignsNode[foundId] };
                console.log('[Automation] Fallback matched active campaign for user:', resolvedUserId);
                break;
              }
            } catch (_) {}
          }
        }
      } catch (fallbackErr) {
        console.warn('[Automation] Fallback campaign discovery failed:', fallbackErr?.message || fallbackErr);
      }
      if (!campaign) {
        console.log('[Automation] No active campaign found for:', campaignType);
        return res.status(200).json({
          success: true,
          message: 'No active campaign configured',
        });
      }
    }

    // Validate customer email
    const customerEmail = eventData.customerEmail;
    if (!customerEmail) {
      console.error('[Automation] Missing customer email');
      return res.status(400).json({ error: 'Customer email is required' });
    }

    // Prefer dashboard template (subject/html) if present in campaign
    let subject = campaign?.subject || '';
    let htmlContent = campaign?.htmlContent || campaign?.html || campaign?.body || '';

    if (!htmlContent) {
      console.log('[Automation] Generating email content (no campaign html found)...');
      try {
        // Preferred: AI-generated content (if OPENAI_API_KEY is set)
        const ai = await generateEmailContent(campaignType, {
          customerName: eventData.customerName || 'Valued Customer',
          customerEmail,
          cartItems: eventData.items,
          orderNumber: eventData.orderNumber,
          productName: eventData.items?.[0]?.name,
          lastVisit: eventData.createdAt ? new Date(eventData.createdAt).toLocaleDateString() : null,
        });
        subject = ai.subject || subject || 'You left items in your cart';
        htmlContent = ai.htmlContent;
      } catch (aiErr) {
        // Safe fallback when OpenAI is not configured or any generation error occurs
        console.warn('[Automation] AI generation failed or not configured. Using fallback content:', aiErr?.message || aiErr);
        if (campaignType === 'abandoned_cart') {
          subject = subject || 'You left items in your cart';
          const itemsHtml = (eventData.items || [])
            .map((it) => `<li>${(it?.name || 'Item')} × ${it?.quantity || 1} — ${it?.price || ''}</li>`)
            .join('');
          htmlContent = `
            <div style="font-family: Arial, sans-serif; line-height:1.6; color:#111">
              <h2>Complete your purchase</h2>
              <p>Hi${eventData.customerName ? ' ' + eventData.customerName : ''}, you left these items in your cart:</p>
              <ul>${itemsHtml || '<li>Your selected products</li>'}</ul>
              <p><a href="#" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Return to checkout</a></p>
              <p style="color:#555">If you have any questions, just reply to this email.</p>
            </div>
          `;
        } else if (campaignType === 'post_purchase') {
          subject = subject || 'Thank you for your purchase!';
          htmlContent = `<p>Hi${eventData.customerName ? ' ' + eventData.customerName : ''}, thanks for your order${eventData.orderNumber ? ' #' + eventData.orderNumber : ''}.</p>`;
        } else if (campaignType === 'customer_created') {
          subject = subject || 'Welcome!';
          htmlContent = `<p>Welcome${eventData.customerName ? ' ' + eventData.customerName : ''}! We’re glad you’re here.</p>`;
        } else {
          subject = subject || 'Hello from our store';
          htmlContent = `<p>We have an update for you.</p>`;
        }
      }
    }

    // Send email via Brevo
    console.log('[Automation] Sending email to:', customerEmail);
    let emailResult = null;
    try {
      emailResult = await sendAutomatedEmail(
        customerEmail,
        subject,
        htmlContent,
        {
          name: campaign.sender?.name || 'Your Store',
          email: campaign.sender?.email || process.env.SENDER_EMAIL,
        }
      );
    } catch (sendErr) {
      console.error('[Automation] Send email failed:', sendErr?.message || sendErr);
      // Do not expose as 500 to webhook caller; respond 200 with diagnostic so the flow doesn't break
      return res.status(200).json({
        success: false,
        message: 'Email send failed',
        reason: sendErr?.message || 'Unknown error sending email',
      });
    }

    // Mark email as sent
    await markEmailAsSent(adminDatabase, resolvedUserId, eventId, campaignType, {
      to: customerEmail,
      subject,
    });

    // Update contact email statistics
    await updateContactEmailStats(adminDatabase, resolvedUserId, customerEmail, 'sent');

    // Update event status in Firebase
    const eventRef = adminDatabase.ref(`events/${resolvedUserId}/${eventType}/${eventId}`);
    await eventRef.update({
      processedAt: Date.now(),
      emailSent: true,
      emailSentAt: Date.now(),
    });

    // Update campaign stats
    const campaignRef = adminDatabase.ref(`users/${resolvedUserId}/campaigns/${campaign.id}`);
    const campaignSnapshot = await campaignRef.once('value');
    const currentStats = campaignSnapshot.val() || {};
    
    await campaignRef.update({
      emailsSent: (currentStats.emailsSent || 0) + 1,
      lastEmailSent: Date.now(),
      updatedAt: Date.now(),
    });

    console.log('[Automation] ✅ Email sent successfully');

    return res.status(200).json({
      success: true,
      message: 'Automated email sent successfully',
      emailResult,
      campaignId: campaign.id,
      campaignType,
    });

  } catch (error) {
    console.error('[Automation] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}


import { adminAuth, adminDb } from '../../lib/firebaseAdmin';
import { sendTransactionalEmail, trackEvent } from '../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Allow cron jobs or authenticated users
    const token = req.headers.authorization?.replace('Bearer ', '');
    const cronSecret = req.headers['x-cron-secret'];
    
    if (!token && cronSecret !== process.env.CRON_SECRET && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all events that haven't been processed
    const eventsSnapshot = await adminDb.collectionGroup('events')
      .where('processed', '!=', true)
      .orderBy('processed')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    for (const eventDoc of eventsSnapshot.docs) {
      try {
        const event = eventDoc.data();
        const userId = event.userId;

        if (!userId) {
          await eventDoc.ref.update({ 
            processed: true, 
            processedAt: new Date().toISOString(), 
            error: 'No userId' 
          });
          errors++;
          continue;
        }

        // Get active campaign for this event type
        const campaignRef = adminDb.collection('users').doc(userId).collection('campaigns').doc(event.type);
        const campaignDoc = await campaignRef.get();

        if (!campaignDoc.exists || !campaignDoc.data().enabled) {
          // No active campaign for this event type
          await eventDoc.ref.update({ 
            processed: true, 
            processedAt: new Date().toISOString(), 
            reason: 'No active campaign' 
          });
          skipped++;
          continue;
        }

        const campaign = campaignDoc.data();

        // Calculate delay
        const eventTime = new Date(event.createdAt).getTime();
        const now = Date.now();
        const delayMs = (campaign.delayHours || 0) * 60 * 60 * 1000;
        
        if (now - eventTime < delayMs) {
          // Not enough time has passed
          skipped++;
          continue;
        }

        // Prepare email content
        const emailData = {
          to: event.email,
          subject: campaign.subject || 'Email from your store',
          sender: {
            name: campaign.senderName || 'Your Store',
            email: campaign.senderEmail || 'noreply@yourstore.com',
          },
          replyTo: campaign.replyTo || campaign.senderEmail || 'noreply@yourstore.com',
        };

        // Use template if available, otherwise HTML content
        if (campaign.templateId) {
          emailData.templateId = campaign.templateId;
          emailData.params = event.properties || {};
        } else {
          emailData.htmlContent = campaign.body || `<h1>${campaign.subject}</h1>`;
        }

        // Send email via Brevo
        await sendTransactionalEmail(emailData);

        // Track event in Brevo for analytics
        try {
          await trackEvent({
            email: event.email,
            event: `campaign_sent_${event.type}`,
            properties: {
              campaignType: event.type,
              userId,
              ...event.properties,
            },
          });
        } catch (trackError) {
          console.warn('Failed to track event in Brevo:', trackError);
        }

        // Update campaign stats
        await campaignRef.update({
          sent: (campaign.sent || 0) + 1,
          lastSentAt: new Date().toISOString(),
        });

        // Mark event as processed
        await eventDoc.ref.update({
          processed: true,
          processedAt: new Date().toISOString(),
          sentVia: 'brevo',
        });

        processed++;
      } catch (error) {
        console.error('Error processing event:', error);
        errors++;
        try {
          await eventDoc.ref.update({
            processed: true,
            processedAt: new Date().toISOString(),
            error: error.message,
          });
        } catch (updateError) {
          console.error('Failed to update event with error:', updateError);
        }
      }
    }

    console.log(`✅ Processed ${processed} events, ${skipped} skipped, ${errors} errors (total: ${eventsSnapshot.size})`);

    res.status(200).json({
      success: true,
      processed,
      skipped,
      errors,
      total: eventsSnapshot.size,
    });
  } catch (error) {
    console.error('Process events error:', error);
    res.status(500).json({
      error: 'Failed to process events',
      details: error.message,
    });
  }
}

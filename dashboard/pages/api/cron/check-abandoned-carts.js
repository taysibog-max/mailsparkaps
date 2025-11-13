/**
 * CRON Job: Check Abandoned Carts
 * GET /api/cron/check-abandoned-carts
 * 
 * Runs every 15 minutes (triggered by Vercel CRON or manually)
 * Checks for carts older than 2 minutes and triggers abandoned cart emails
 * NOTE: Changed to 2 minutes for TESTING purposes
 */

import { adminDatabase } from '../../../lib/firebaseAdmin';

// Lowered threshold for fast testing (1 minute)
const CART_ABANDONED_THRESHOLD = 60 * 1000; // 1 minute

export default async function handler(req, res) {
  // Allow GET for manual trigger, but verify cron secret for security
  const cronSecret = req.headers['authorization']?.replace('Bearer ', '');
  const isManualTrigger = req.query.manual === 'true';

  if (!isManualTrigger && cronSecret !== process.env.CRON_SECRET) {
    console.error('[CRON] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[CRON] Starting abandoned cart check...');

  try {
    const eventsRef = adminDatabase.ref('events');
    const eventsSnapshot = await eventsRef.once('value');

    if (!eventsSnapshot.exists()) {
      console.log('[CRON] No events found');
      return res.status(200).json({
        success: true,
        message: 'No events to process',
        processed: 0,
      });
    }

    const allEvents = eventsSnapshot.val();
    const now = Date.now();
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each user's events
    for (const userId in allEvents) {
      const userEvents = allEvents[userId];
      
      // Check cart_abandoned events
      if (userEvents.cart_abandoned) {
        // 1) Prikupi validne događaje
        const valid = [];
        for (const eventId in userEvents.cart_abandoned) {
          const event = userEvents.cart_abandoned[eventId];

          // Skip if already processed, sent or recovered
          if (event?.processedAt || event?.emailSent || event?.recovered === true) {
            skippedCount++;
            continue;
          }
          // Only pixel with email and items
          if (event?.source !== 'pixel' || !event?.customerEmail) { skippedCount++; continue; }
          if (!Array.isArray(event?.items) || event.items.length === 0) { skippedCount++; continue; }
          // Old enough
          const cartAge = now - Number(event?.createdAt || 0);
          if (cartAge < CART_ABANDONED_THRESHOLD) { skippedCount++; continue; }

          valid.push({ eventId, ...event });
        }

        // 2) Dedupe: zadrži samo najnoviji po emailu
        const latestByEmail = new Map();
        for (const ev of valid) {
          const key = String(ev.customerEmail).toLowerCase().trim();
          const prev = latestByEmail.get(key);
          if (!prev || Number(ev.createdAt || 0) > Number(prev.createdAt || 0)) {
            latestByEmail.set(key, ev);
          }
        }

        // 3) Procesiraj samo izabrane (najnovije) događaje
        for (const [, ev] of latestByEmail) {
          try {
            console.log('[CRON] Triggering automation for:', ev.eventId);

            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/automation/trigger`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                eventId: ev.eventId,
                eventType: 'cart_abandoned',
                eventData: ev,
              }),
            });

            const result = await response.json().catch(() => ({}));
            if (response.ok && result?.success !== false) {
              processedCount++;
              console.log('[CRON] ✅ Processed:', ev.eventId, result?.message || '');
            } else {
              console.error('[CRON] Failed to process:', ev.eventId, result);
              errorCount++;
            }
          } catch (error) {
            console.error('[CRON] Error processing:', ev.eventId, error);
            errorCount++;
          }
        }
      }
    }

    console.log('[CRON] ✅ Abandoned cart check complete');
    console.log('[CRON] Processed:', processedCount, 'Skipped:', skippedCount, 'Errors:', errorCount);

    return res.status(200).json({
      success: true,
      message: 'Abandoned cart check complete',
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}


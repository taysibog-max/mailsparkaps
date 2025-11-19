/**
 * CRON Job: Check Abandoned Carts
 * GET /api/cron/check-abandoned-carts
 * 
 * Runs every 15 minutes (triggered by Vercel CRON or manually)
 * Checks for carts older than 2 minutes and triggers abandoned cart emails
 * NOTE: Changed to 2 minutes for TESTING purposes
 */

import { adminDatabase } from '../../../lib/firebaseAdmin';

// Grace window before sending (prevents race with successful completion)
// 1 minute threshold
const CART_ABANDONED_THRESHOLD = 60 * 1000; // 1 minute

export default async function handler(req, res) {
  // Allow GET for manual trigger, but verify cron secret for security
  const cronSecret = req.headers['authorization']?.replace('Bearer ', '');
  const isManualTrigger = req.query.manual === 'true';
  const isVercelCron = Boolean(req.headers['x-vercel-cron']); // Vercel Cron adds this header

  if (!isManualTrigger && !isVercelCron && cronSecret !== process.env.CRON_SECRET) {
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
          // Dozvoli obradu ako je eksplicitno označeno kao napušteno ILI je proteklo dovoljno vremena od zadnjeg kontakta
          const nowOrLast = Number(event?.abandonedAt || event?.lastAt || event?.createdAt || 0);
          const age = now - nowOrLast;
          const isMarkedAbandoned = event?.isAbandoned === true;
          if (!(isMarkedAbandoned || age >= CART_ABANDONED_THRESHOLD)) { skippedCount++; continue; }
          // Potreban je e‑mail; stavke su opcione (neke teme/pixeli ne šalju lineItems)
          if (!event?.customerEmail) { skippedCount++; continue; }
          // Items optional: if missing, we'll still proceed
          // Dovoljna starost već provjerena iznad

          valid.push({ eventId, ...event });
        }

        // 2) Dedupe: zadrži samo najnoviji po checkout tokenu (ako postoji), inače po emailu
        const latestByKey = new Map();
        for (const ev of valid) {
          const tokenKey = ev?.token ? `token:${String(ev.token).trim()}` : null;
          const emailKey = String(ev.customerEmail || '').toLowerCase().trim();
          const key = tokenKey || `email:${emailKey}`;
          const prev = latestByKey.get(key);
          if (!prev || Number(ev.createdAt || 0) > Number(prev.createdAt || 0)) {
            latestByKey.set(key, ev);
          }
        }

        // 3) Procesiraj samo izabrane (najnovije) događaje
        for (const [, ev] of latestByKey) {
          try {
            console.log('[CRON] Triggering automation for:', ev.eventId);

            const baseUrl =
              process.env.INTERNAL_API_BASE_URL ||
              process.env.NEXT_PUBLIC_APP_URL ||
              (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
            const headers = { 'Content-Type': 'application/json' };
            const bypass =
              process.env.VERCEL_PROTECTION_BYPASS ||
              process.env.PROTECTION_BYPASS_TOKEN ||
              process.env.VERCEL_BYPASS_TOKEN;
            if (bypass) {
              headers['x-vercel-protection-bypass'] = bypass;
            }
            // Authorize internal automation trigger (matches guard in /api/automation/trigger)
            if (process.env.CRON_SECRET) {
              headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`;
            }
            const response = await fetch(`${baseUrl}/api/automation/trigger?manual=1`, {
              method: 'POST',
              headers,
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


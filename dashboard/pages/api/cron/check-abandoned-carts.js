/**
 * CRON Job: Check Abandoned Carts (Multi-Member)
 * GET /api/cron/check-abandoned-carts
 *
 * - Validates Vercel Cron header (or CRON_SECRET/manual flag)
 * - Iterates all members with Shopify connected
 * - Processes each member independently
 * - Aggregates stats and never throws global errors
 */
import { getAllMembersWithShopifyEnabled } from '../../../lib/members';
import { processAbandonedCartsForMember } from '../../../lib/abandonedCartProcessor';

export default async function handler(req, res) {
  // Allow GET for manual trigger, but verify cron or secret for security
  const cronSecretHeader = (req.headers['authorization'] || '').replace('Bearer ', '');
  const isManual = String(req.query.manual || '').toLowerCase() === 'true' || String(req.query.manual || '') === '1';
  const isVercelCron = Boolean(req.headers['x-vercel-cron']); // Vercel Cron adds this header
  const allowSecret = process.env.CRON_SECRET && cronSecretHeader === process.env.CRON_SECRET;

  if (!(isManual || isVercelCron || allowSecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const src = isVercelCron ? 'vercel-cron' : (isManual ? 'manual' : (allowSecret ? 'secret' : 'unknown'));
    console.log('[CRON] Trigger source:', src);
  } catch (_) {}

  const summary = {
    success: true,
    processed: 0,
    skipped: 0,
    errors: 0,
    members: [],
    timestamp: new Date().toISOString(),
  };

  try {
    console.log('[CRON] Starting multi-member abandoned cart check…');
    const members = await getAllMembersWithShopifyEnabled();
    console.log('[CRON] Members detected:', members.length);

    for (const member of members) {
      const { userId, automationEnabled, abandonedCartGrace } = member || {};
      const memberLog = { userId, processed: 0, skipped: 0, errors: 0, enabled: !!automationEnabled, graceSec: abandonedCartGrace };
      try {
        if (!automationEnabled) {
          summary.skipped++;
          memberLog.skipped++;
          summary.members.push(memberLog);
          continue;
        }
        const stats = await processAbandonedCartsForMember(member);
        memberLog.processed = Number(stats?.processed || 0);
        memberLog.skipped = Number(stats?.skipped || 0);
        memberLog.errors = Number(stats?.errors || 0);
        summary.processed += memberLog.processed;
        summary.skipped += memberLog.skipped;
        summary.errors += memberLog.errors;
      } catch (err) {
        memberLog.errors++;
        summary.errors++;
      }
      summary.members.push(memberLog);
    }

    console.log('[CRON] Done. Totals:', { processed: summary.processed, skipped: summary.skipped, errors: summary.errors });
    return res.status(200).json(summary);
  } catch (e) {
    // Never fail globally; return partial summary with error note
    console.error('[CRON] Top-level error:', e);
    return res.status(200).json({
      ...summary,
      success: false,
      note: 'Completed with errors',
      error: e?.message || String(e),
    });
  }
}


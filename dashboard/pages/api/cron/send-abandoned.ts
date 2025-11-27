import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDatabase } from '../../../lib/firebaseAdmin';
import { sendAbandonedEmail } from '../../../lib/email/brevoSender';
import { hasEmailBeenSent, markEmailSent } from '../../../utils/emailAlreadySent';
import { sanitizeFirebaseKey } from '../../../utils/firebasePixel';
import { sanitizeEmail } from '../../../utils/pixelTypes';

type StatusSummary = {
  processed: number;
  skipped: number;
  errors: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET || process.env.CRON_TOKEN || '';
  const bearer = (req.headers.authorization || '').replace('Bearer ', '');
  const isCron = Boolean(req.headers['x-vercel-cron']);
  if (!isCron && (!cronSecret || bearer !== cronSecret)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const summary: StatusSummary = { processed: 0, skipped: 0, errors: 0 };
  try {
    const usersSnap = await adminDatabase.ref('users').once('value');
    if (!usersSnap.exists()) {
      return res.status(200).json({ ok: true, processed: 0, skipped: 0, errors: 0 });
    }

    const jobs: Array<{ uid: string; tokenKey: string; checkout: Record<string, any> }> = [];
    usersSnap.forEach((userSnap) => {
      const uid = userSnap.key || '';
      if (!uid) return;
      const abandoned = userSnap.child('abandoned');
      if (!abandoned.exists()) return;
      const val = abandoned.val() || {};
      for (const [tokenKey, payload] of Object.entries(val)) {
        jobs.push({
          uid,
          tokenKey,
          checkout: (payload as Record<string, any>) || {},
        });
      }
    });

    for (const job of jobs) {
      const safeTokenKey = sanitizeFirebaseKey(job.tokenKey);
      const email =
        sanitizeEmail(job.checkout?.customerEmail || job.checkout?.customer_email || job.checkout?.email) || null;

      if (!email || !safeTokenKey) {
        summary.skipped += 1;
        continue;
      }

      const alreadySent = await hasEmailBeenSent(job.uid, safeTokenKey);
      if (alreadySent) {
        summary.skipped += 1;
        continue;
      }

      const abandonedAt = Number(job.checkout?.abandoned_at || job.checkout?.abandonedAt || Date.now());
      try {
        await sendAbandonedEmail({
          uid: job.uid,
          tokenKey: safeTokenKey,
          email,
          shopDomain: job.checkout?.shopDomain || job.checkout?.shop_domain || null,
          abandonedAt,
          checkout: job.checkout,
        });
        await markEmailSent(job.uid, safeTokenKey, email);
        await logEmailAttempt(job.uid, safeTokenKey, 'sent', null, email);
        summary.processed += 1;
      } catch (err: any) {
        const message = err?.message || 'Unknown Brevo error';
        console.error('[cron/send-abandoned] Failed to send email:', message);
        summary.errors += 1;
        await logEmailAttempt(job.uid, safeTokenKey, 'failed', message, email);
      }
      await sleep(100);
    }

    return res.status(200).json({ ok: true, ...summary });
  } catch (error: any) {
    console.error('[cron/send-abandoned] Critical error:', error?.message || error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Failed to process cron job',
      ...summary,
    });
  }
}

async function logEmailAttempt(
  uid: string,
  tokenKey: string,
  status: 'sent' | 'failed',
  error: string | null,
  email: string,
): Promise<void> {
  try {
    await adminDatabase.ref(`events/${uid}/email_sends/${tokenKey}`).set({
      status,
      error: error || null,
      email,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('[cron/send-abandoned] Failed to log email attempt:', err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



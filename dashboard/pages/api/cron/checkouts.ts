import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDatabase } from '../../../lib/firebaseAdmin';
import { getAbandonedCheckoutEmailPayload, isCheckoutAbandoned } from '../../../utils/shopifyAbandoned';
import { sendAbandonedEmail, Stage } from '../../../utils/sendAbandonedEmail';

const MINUTES = 60 * 1000;
const FIRST_EMAIL_DELAY = 20 * MINUTES;
const SECOND_EMAIL_DELAY = 3 * 60 * MINUTES;
const THIRD_EMAIL_DELAY = 24 * 60 * MINUTES;

type EmailLog = {
  first_sent?: number;
  second_sent?: number;
  third_sent?: number;
};

function toTimestamp(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    const time = parsed.getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  return 0;
}

function determineStage(checkout: any, log: EmailLog): Stage | null {
  const abandonedAt =
    toTimestamp(checkout?.abandoned_at) ||
    toTimestamp(checkout?.updated_at) ||
    toTimestamp(checkout?.created_at) ||
    Date.now();
  const diff = Date.now() - abandonedAt;

  if (!log.first_sent && diff >= FIRST_EMAIL_DELAY) return 'first';
  if (!log.second_sent && diff >= SECOND_EMAIL_DELAY) return 'second';
  if (!log.third_sent && diff >= THIRD_EMAIL_DELAY) return 'third';
  return null;
}

async function recordEmailSent(uid: string, checkoutKey: string, stage: Stage) {
  const ref = adminDatabase.ref(`users/${uid}/emails_sent/${checkoutKey}`);
  const field =
    stage === 'first' ? 'first_sent' : stage === 'second' ? 'second_sent' : 'third_sent';
  await ref.update({ [field]: Date.now() });
}

async function processShop(shopKey: string, shopData: any): Promise<number> {
  const uid = shopData?.userId;
  if (!uid) return 0;

  const checkoutsSnapshot = await adminDatabase.ref(`shops/${shopKey}/checkouts`).get();
  if (!checkoutsSnapshot.exists()) return 0;

  const emailLogSnapshot = await adminDatabase.ref(`users/${uid}/emails_sent`).get();
  const emailLog: Record<string, EmailLog> = emailLogSnapshot.exists() ? emailLogSnapshot.val() : {};
  const checkouts = checkoutsSnapshot.val();

  let sent = 0;
  const shopDomain = shopData?.shop || shopData?.shopDomain || '';

  const checkoutEntries = Object.entries(checkouts) as [string, any][];
  for (const [checkoutKey, checkout] of checkoutEntries) {
    if (!checkout?.email) continue;
    const augmentedCheckout = { ...checkout, shopDomain };
    if (!isCheckoutAbandoned(augmentedCheckout)) continue;

    const log = emailLog[checkoutKey] || {};
    const stage = determineStage(augmentedCheckout, log);
    if (!stage) continue;

    const payload = getAbandonedCheckoutEmailPayload(augmentedCheckout, shopDomain);
    if (!payload.email) continue;

    try {
      await sendAbandonedEmail(payload.email, { ...payload, stage });
      await recordEmailSent(uid, checkoutKey, stage);
      await adminDatabase.ref(`shops/${shopKey}/checkouts/${checkoutKey}`).update({
        last_email_stage: stage,
        last_email_sent_at: Date.now(),
      });
      emailLog[checkoutKey] = { ...log, [`${stage}_sent`]: Date.now() };
      sent += 1;
    } catch (error) {
      console.error(`[Cron][${shopKey}] Failed to send ${stage} email`, error);
    }
  }

  return sent;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const shopsSnapshot = await adminDatabase.ref('shops').get();
    if (!shopsSnapshot.exists()) {
      return res.status(200).json({ processed: 0, emailsSent: 0 });
    }

    const shops = shopsSnapshot.val();
    let processed = 0;
    let emailsSent = 0;

    for (const [shopKey, shopData] of Object.entries<any>(shops)) {
      processed += 1;
      emailsSent += await processShop(shopKey, shopData);
    }

    return res.status(200).json({ processed, emailsSent });
  } catch (error) {
    console.error('[Cron] Failed to process checkouts', error);
    return res.status(500).json({ error: 'Failed to process checkouts' });
  }
}


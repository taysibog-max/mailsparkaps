import type { NextApiRequest, NextApiResponse } from 'next';
import { evaluateCheckouts } from '../../../utils/abandonedEvaluator';
import {
  getAllShopKeys,
  resolveShopOwnerUid,
  writeAbandonedRecord,
} from '../../../utils/firebasePixel';

interface CronSummary {
  shopKey: string;
  abandonedMarked: number;
  missingOwner: number;
  skipped: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET || process.env.CRON_TOKEN || '';
  const bearer = (req.headers.authorization || '').replace('Bearer ', '');
  const isCron = Boolean(req.headers['x-vercel-cron']);
  if (cronSecret && bearer !== cronSecret && !isCron) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const shopKeys = await getAllShopKeys();
    const summary: CronSummary[] = [];

    for (const shopKey of shopKeys) {
      const abandoned = await evaluateCheckouts(shopKey);
      if (!abandoned.length) {
        summary.push({ shopKey, abandonedMarked: 0, missingOwner: 0, skipped: 0 });
        continue;
      }

      const ownerUid = await resolveShopOwnerUid(shopKey);
      if (!ownerUid) {
        summary.push({ shopKey, abandonedMarked: 0, missingOwner: abandoned.length, skipped: 0 });
        continue;
      }

      let processed = 0;
      let skipped = 0;
      for (const checkout of abandoned) {
        try {
          await writeAbandonedRecord({
            uid: ownerUid,
            shopKey,
            tokenKey: checkout.tokenKey,
            eventId: checkout.eventId,
            abandonedAt: checkout.abandonedAt,
            checkout: checkout.record,
          });
          processed++;
        } catch (err) {
          console.warn('[cron/evaluate] Failed to write abandoned record:', err);
          skipped++;
        }
      }

      summary.push({
        shopKey,
        abandonedMarked: processed,
        missingOwner: 0,
        skipped,
      });
    }

    return res.status(200).json({
      ok: true,
      evaluated: shopKeys.length,
      summary,
    });
  } catch (error: any) {
    console.error('[cron/evaluate] error:', error?.message || error);
    return res.status(200).json({
      ok: false,
      error: error?.message || 'Failed to evaluate checkouts',
    });
  }
}



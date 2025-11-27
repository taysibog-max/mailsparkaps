import { adminDatabase } from '../lib/firebaseAdmin';
import {
  DEFAULT_ABANDON_GRACE_MINUTES,
  EvaluatedCheckout,
  PixelCheckoutRecord,
} from './pixelTypes';

const MINUTES = Number(process.env.ABANDON_CHECKOUT_GRACE_MINUTES || DEFAULT_ABANDON_GRACE_MINUTES);
const ABANDON_THRESHOLD_MS = Math.max(5, MINUTES) * 60 * 1000;

export async function evaluateCheckouts(shopKey: string): Promise<EvaluatedCheckout[]> {
  if (!shopKey) return [];
  const shopRef = adminDatabase.ref(`pixel-events/${shopKey}`);
  const snap = await shopRef.once('value').catch(() => null);
  if (!snap || !snap.exists()) return [];

  const nodes = snap.val() || {};
  const now = Date.now();
  const abandoned: EvaluatedCheckout[] = [];

  for (const [tokenKey, eventsNode] of Object.entries(nodes)) {
    if (!eventsNode || typeof eventsNode !== 'object') continue;
    if (tokenKey === '_meta') continue;

    for (const [eventId, recordNode] of Object.entries(eventsNode as Record<string, PixelCheckoutRecord>)) {
      if (!recordNode || typeof recordNode !== 'object') continue;
      if (!shouldConsiderRecord(recordNode)) continue;

      const lastPing = getLastRelevantTimestamp(recordNode);
      if (!lastPing) continue;
      if (now - lastPing < ABANDON_THRESHOLD_MS) continue;

      const token = String(recordNode.token || tokenKey);
      const email = recordNode.email ?? recordNode.customerEmail ?? null;
      const shopDomain = recordNode.shopDomain ?? null;

      const abandonedAt = now;
      const recordRef = adminDatabase.ref(`pixel-events/${shopKey}/${tokenKey}/${eventId}`);
      await recordRef
        .update({
          abandoned: true,
          status: 'abandoned',
          abandoned_at: abandonedAt,
          last_event_type: recordNode.last_event_type || 'checkout_soft_abandon',
        })
        .catch(() => {});

      abandoned.push({
        shopKey,
        tokenKey,
        eventId,
        token,
        email,
        shopDomain,
        abandonedAt,
        lastEventType: recordNode.last_event_type || null,
        record: { ...recordNode },
      });
    }
  }

  return abandoned;
}

function shouldConsiderRecord(record: PixelCheckoutRecord): boolean {
  if (!record) return false;
  if (record.abandoned === true) return false;
  if (record.status && String(record.status).toLowerCase() === 'abandoned') return false;
  if (record.completed_at) return false;
  if (record.order_id || record.orderId || record.order_number) return false;
  if (record.last_event_type === 'checkout_completed') return false;

  const abandonPing = record.timestamps?.abandon_ping || record.abandon_ping_at;
  if (!abandonPing || abandonPing <= 0) return false;

  return true;
}

function getLastRelevantTimestamp(record: PixelCheckoutRecord): number | null {
  const ping = Number(record.timestamps?.abandon_ping || record.abandon_ping_at || 0);
  if (Number.isFinite(ping) && ping > 0) return ping;
  const lastSeen = Number(record.timestamps?.last_seen || record.updated_at || 0);
  return Number.isFinite(lastSeen) && lastSeen > 0 ? lastSeen : null;
}



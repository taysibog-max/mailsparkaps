/**
 * Abandoned cart processing per member
 */
import { adminDatabase } from './firebaseAdmin';

function getBaseUrl() {
  return (
    process.env.INTERNAL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  );
}

/**
 * Processes abandoned carts for a single member.
 * Applies per-member grace window and triggers automation for that user's shop only.
 * Does not throw; returns { processed, skipped, errors }.
 * 
 * @param {object} member - { userId, shopDomain, shopToken, automationEnabled, abandonedCartGrace }
 */
export async function processAbandonedCartsForMember(member) {
  const userId = member?.userId;
  if (!userId) return { processed: 0, skipped: 0, errors: 0 };

  const graceMs = Math.max(0, Number(member?.abandonedCartGrace || 60)) * 1000;
  const baseUrl = getBaseUrl();
  const headers = { 'Content-Type': 'application/json' };
  const bypass =
    process.env.VERCEL_PROTECTION_BYPASS ||
    process.env.PROTECTION_BYPASS_TOKEN ||
    process.env.VERCEL_BYPASS_TOKEN;
  if (bypass) headers['x-vercel-protection-bypass'] = bypass;
  if (process.env.CRON_SECRET) headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`;

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Optional per-user lastPixelAt guard (if maintained by trackers)
    try {
      const candidates = [
        adminDatabase.ref(`users/${userId}/metrics/lastPixelAt`),
        adminDatabase.ref(`events/${userId}/_meta/lastPixelAt`),
      ];
      for (const r of candidates) {
        try {
          const s = await r.get();
          if (s && s.exists()) {
            const lastPixelAt = Number(s.val() || 0);
            if (Number.isFinite(lastPixelAt) && lastPixelAt > 0) {
              const diff = Date.now() - lastPixelAt;
              if (diff < graceMs) {
                // too fresh, skip this member entirely for now
                return { processed, skipped: skipped + 1, errors };
              }
              break;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    // Read ONLY this user's abandoned cart events captured by pixel
    const ref = adminDatabase.ref(`events/${userId}/cart_abandoned`);
    const snap = await ref.get().catch(() => null);
    if (!snap || !snap.exists()) {
      return { processed, skipped, errors };
    }

    const now = Date.now();
    const raw = snap.val() || {};

    // 1) filter valid
    const valid = [];
    for (const [eventId, ev] of Object.entries(raw)) {
      try {
        // skip processed or recovered
        if (ev?.processedAt || ev?.emailSent || ev?.recovered === true) {
          skipped++; continue;
        }
        // require email
        const email = String(ev?.customerEmail || '').trim().toLowerCase();
        if (!email) { skipped++; continue; }
        // grace condition
        const lastTs = Number(ev?.abandonedAt || ev?.lastAt || ev?.createdAt || 0);
        const age = now - lastTs;
        const explicitlyAbandoned = ev?.isAbandoned === true;
        if (!(explicitlyAbandoned || age >= graceMs)) { skipped++; continue; }
        valid.push({ eventId, ...ev });
      } catch {
        skipped++;
      }
    }

    // 2) dedupe by token/email, keep newest
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

    // 3) process selected
    for (const [, ev] of latestByKey) {
      try {
        if (!baseUrl) { errors++; continue; }
        const body = {
          userId,
          eventId: ev.eventId,
          eventType: 'cart_abandoned',
          eventData: ev,
        };
        const resp = await fetch(`${baseUrl}/api/automation/trigger?manual=1`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data?.success !== false) {
          processed++;
        } else {
          errors++;
        }
      } catch (_) {
        errors++;
      }
    }
  } catch (_) {
    // never throw to avoid blocking other users
  }

  return { processed, skipped, errors };
}



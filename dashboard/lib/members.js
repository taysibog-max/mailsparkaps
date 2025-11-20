/**
 * Members helper
 * Returns all users that have Shopify connected, with automation settings.
 */
import { adminDatabase } from './firebaseAdmin';

/**
 * Reads members that have Shopify enabled/connected.
 * Returns minimal info required by abandoned carts processor.
 * 
 * Output item fields:
 * - userId
 * - shopDomain
 * - shopToken
 * - automationEnabled
 * - abandonedCartGrace (in seconds)
 */
export async function getAllMembersWithShopifyEnabled() {
  const usersSnap = await adminDatabase.ref('users').get().catch(() => null);
  if (!usersSnap || !usersSnap.exists()) return [];
  const users = usersSnap.val() || {};
  const result = [];
  for (const [uid, userNode] of Object.entries(users)) {
    try {
      const shopify = userNode?.integrations?.shopify || null;
      if (!shopify) continue;
      const shopDomain = String(shopify?.shop || '').trim();
      const shopToken = String(shopify?.accessToken || '').trim();
      if (!shopDomain || !shopToken) continue;

      // Automation flags (defensive across possible locations/keys)
      const settings = userNode?.settings || {};
      const automation = settings?.automation || {};
      const legacyEnabled = settings?.automationEnabled;
      const automationEnabled =
        typeof automation?.enabled === 'boolean'
          ? automation.enabled
          : typeof legacyEnabled === 'boolean'
          ? legacyEnabled
          : true; // default enabled

      // Grace seconds
      const graceSources = [
        Number(automation?.abandonedCartGraceSec),
        Number(settings?.abandonedCartGraceSec),
        Number(settings?.antispam?.cooldownMs ? (settings?.antispam?.cooldownMs / 1000) : NaN),
      ].filter((v) => Number.isFinite(v) && v >= 0);
      const abandonedCartGrace = graceSources.length > 0 ? Math.floor(graceSources[0]) : 60; // default 60s

      result.push({
        userId: uid,
        shopDomain,
        shopToken,
        automationEnabled,
        abandonedCartGrace,
      });
    } catch (_) {
      // ignore malformed user
    }
  }
  return result;
}




import { adminDatabase } from '../lib/firebaseAdmin';
import type { PixelCheckoutRecord, PixelEventType } from './pixelTypes';

export function sanitizeFirebaseKey(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[.#$/\[\]]/g, '_')
    .toLowerCase();
}

export function getShopKeyFromDomain(domain?: string | null): string | null {
  if (!domain) return null;
  const normalized = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase().trim();
  if (!normalized) return null;
  return sanitizeFirebaseKey(normalized);
}

export function tokenToKey(token: string): string {
  return sanitizeFirebaseKey(token || 'unknown');
}

export async function getAllShopKeys(): Promise<string[]> {
  const snap = await adminDatabase.ref('pixel-events').once('value').catch(() => null);
  if (!snap || !snap.exists()) return [];
  const val = snap.val() || {};
  return Object.keys(val).filter((key) => key && key !== '_meta');
}

export async function resolveShopOwnerUid(shopKey: string): Promise<string | null> {
  if (!shopKey) return null;
  try {
    const snap = await adminDatabase.ref(`storeOwners/${shopKey}`).once('value');
    if (snap.exists()) return snap.val() || null;
  } catch (_) {
    // ignored
  }
  try {
    const shopSnap = await adminDatabase.ref(`shops/${shopKey}/userId`).once('value');
    if (shopSnap.exists()) return shopSnap.val() || null;
  } catch (_) {
    // ignored
  }
  return null;
}

interface WriteEventBase {
  shopKey: string;
  token: string;
  tokenKey?: string;
  eventId: string;
  timestamp: number;
  email?: string | null;
  shopDomain?: string | null;
  eventType: PixelEventType;
}

export async function writeProgressEvent(args: WriteEventBase): Promise<void> {
  const tokenKey = args.tokenKey || tokenToKey(args.token);
  const ref = adminDatabase.ref(`pixel-events/${args.shopKey}/${tokenKey}/${args.eventId}`);
  const snap = await ref.once('value').catch(() => null);
  const previous: PixelCheckoutRecord = (snap && snap.exists() ? snap.val() : {}) || {};

  const next: PixelCheckoutRecord = {
    ...previous,
    token: args.token,
    email: args.email ?? previous.email ?? null,
    shopDomain: args.shopDomain ?? previous.shopDomain ?? null,
    created_at: previous.created_at || args.timestamp,
    updated_at: args.timestamp,
    last_event_type: args.eventType,
    status: previous.status || 'active',
    timestamps: {
      ...(previous.timestamps || {}),
      first_seen: previous.timestamps?.first_seen || args.timestamp,
      last_seen: args.timestamp,
      abandon_ping: previous.timestamps?.abandon_ping || null,
    },
  };
  next.eventId = args.eventId;

  await ref.set(next);
  await adminDatabase
    .ref(`pixel-events/${args.shopKey}/_meta`)
    .update({
      lastEventAt: args.timestamp,
      lastEventType: args.eventType,
    })
    .catch(() => {});
}

export async function writeAbandonPing(args: WriteEventBase & { reason?: string | null }): Promise<void> {
  const tokenKey = args.tokenKey || tokenToKey(args.token);
  const ref = adminDatabase.ref(`pixel-events/${args.shopKey}/${tokenKey}/${args.eventId}`);
  const snap = await ref.once('value').catch(() => null);
  const previous: PixelCheckoutRecord = (snap && snap.exists() ? snap.val() : {}) || {};

  const next: PixelCheckoutRecord = {
    ...previous,
    token: args.token,
    email: args.email ?? previous.email ?? null,
    shopDomain: args.shopDomain ?? previous.shopDomain ?? null,
    updated_at: args.timestamp,
    last_event_type: args.eventType,
    abandon_reason: args.reason || previous.abandon_reason || args.eventType,
    abandon_ping_at: args.timestamp,
    timestamps: {
      ...(previous.timestamps || {}),
      first_seen: previous.timestamps?.first_seen || args.timestamp,
      last_seen: args.timestamp,
      abandon_ping: args.timestamp,
    },
  };

  await ref.set(next);
  await adminDatabase
    .ref(`pixel-events/${args.shopKey}/_meta`)
    .update({
      lastEventAt: args.timestamp,
      lastEventType: args.eventType,
    })
    .catch(() => {});
}

interface AbandonedRecordArgs {
  uid: string;
  shopKey: string;
  tokenKey: string;
  eventId: string;
  abandonedAt: number;
  checkout: PixelCheckoutRecord;
}

export async function writeAbandonedRecord(args: AbandonedRecordArgs): Promise<void> {
  const { uid, tokenKey, abandonedAt, eventId, checkout } = args;
  const safeToken = checkout.token || tokenKey;
  const email = checkout.email ?? checkout.customerEmail ?? null;
  const shopDomain = checkout.shopDomain ?? null;
  const lastSeen = checkout.timestamps?.last_seen || checkout.updated_at || abandonedAt;
  const firstSeen = checkout.timestamps?.first_seen || checkout.created_at || abandonedAt;

  const updates: Record<string, unknown> = {};
  updates[`users/${uid}/abandoned/${tokenKey}`] = {
    token: safeToken,
    customerEmail: email,
    shopDomain,
    abandoned_at: abandonedAt,
    status: 'abandoned',
    last_event_type: checkout.last_event_type || null,
    last_seen_at: lastSeen,
    first_seen_at: firstSeen,
    source: 'pixel',
  };

  updates[`events/${uid}/cart_abandoned/${tokenKey}`] = {
    eventId,
    token: safeToken,
    customerEmail: email,
    shopDomain,
    createdAt: firstSeen,
    lastAt: lastSeen,
    abandonedAt,
    isAbandoned: true,
    status: 'abandoned',
    source: 'pixel',
  };

  await adminDatabase.ref().update(updates);
}



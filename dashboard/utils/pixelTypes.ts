import type { DataSnapshot } from 'firebase-admin/database';

export type PixelEventType =
  | 'checkout_progress'
  | 'checkout_unload'
  | 'checkout_soft_abandon'
  | 'checkout_completed';

export interface PixelPayload {
  type: PixelEventType;
  token?: string | null;
  email?: string | null;
  timestamp?: number;
  shopDomain?: string | null;
  eventId?: string | null;
}

export interface PixelCheckoutRecord {
  email?: string | null;
  token: string;
  shopDomain?: string | null;
  created_at?: number;
  updated_at?: number;
  last_event_type?: PixelEventType | null;
  status?: string;
  abandoned?: boolean;
  abandoned_at?: number;
  abandon_reason?: string | null;
  timestamps?: {
    first_seen?: number | null;
    last_seen?: number | null;
    abandon_ping?: number | null;
  };
  abandon_ping_at?: number | null;
  completed_at?: number | null;
  order_id?: string | null;
  order_number?: string | null;
  [key: string]: any;
}

export interface EvaluatedCheckout {
  shopKey: string;
  tokenKey: string;
  eventId: string;
  token: string;
  email: string | null;
  shopDomain: string | null;
  abandonedAt: number;
  lastEventType: PixelEventType | null;
  record: PixelCheckoutRecord;
}

export const PIXEL_EVENT_TYPES: PixelEventType[] = [
  'checkout_progress',
  'checkout_unload',
  'checkout_soft_abandon',
  'checkout_completed',
];

export const DEFAULT_ABANDON_GRACE_MINUTES = 20;

export function sanitizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

export function sanitizeToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const stripped = value.trim();
  if (!stripped) return null;
  // Shopify tokens may include base64 characters; keep them but remove whitespace.
  const normalized = stripped.replace(/\s+/g, '');
  return normalized.slice(0, 256);
}

export function sanitizeShopDomain(value: unknown): string | null {
  if (!value) return null;
  let input = '';
  if (typeof value === 'string') {
    input = value.trim();
  } else if (typeof value === 'object' && value !== null) {
    input = String((value as Record<string, unknown>).shop || '');
  }
  if (!input) return null;
  try {
    const url = input.includes('://') ? new URL(input) : new URL(`https://${input}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch (_) {
    const cleaned = input.replace(/^www\./, '').toLowerCase();
    return cleaned ? cleaned : null;
  }
}

export function coerceTimestamp(value: unknown, fallback: number = Date.now()): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function isPixelEventType(value: unknown): value is PixelEventType {
  return typeof value === 'string' && PIXEL_EVENT_TYPES.includes(value as PixelEventType);
}

export function snapshotToRecord(snapshot: DataSnapshot | null): PixelCheckoutRecord | null {
  if (!snapshot || !snapshot.exists()) return null;
  const val = snapshot.val();
  if (!val || typeof val !== 'object') return null;
  return val as PixelCheckoutRecord;
}



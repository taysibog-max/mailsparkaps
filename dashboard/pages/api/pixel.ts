import type { NextApiRequest, NextApiResponse } from 'next';
import {
  PixelEventType,
  coerceTimestamp,
  isPixelEventType,
  sanitizeEmail,
  sanitizeShopDomain,
  sanitizeToken,
} from '../../utils/pixelTypes';
import {
  getShopKeyFromDomain,
  tokenToKey,
  writeAbandonPing,
  writeProgressEvent,
} from '../../utils/firebasePixel';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(200).json({ ok: true, ignored: true, reason: 'GET_NOT_SUPPORTED' });
  }

  try {
    const raw = await readRawBody(req);
    const payload = raw ? safeJsonParse(raw) : null;
    if (!payload) {
      return res.status(200).json({ ok: false, ignored: true, reason: 'invalid_payload' });
    }

    const eventType = normalizeEventType(payload?.type);
    if (!eventType) {
      return res.status(200).json({ ok: false, ignored: true, reason: 'unknown_event' });
    }

    const token = sanitizeToken(payload?.token);
    if (!token) {
      return res.status(200).json({ ok: false, ignored: true, reason: 'missing_token' });
    }
    const email = sanitizeEmail(payload?.email);
    const timestamp = coerceTimestamp(payload?.timestamp);
    const pixelDomain =
      sanitizeShopDomain(
        payload?.shopDomain || req.headers['x-shopify-shop-domain'] || req.headers['x-shop-domain'],
      ) || deriveDomainFromReferer(req);
    const shopDomain = pixelDomain || null;
    const shopKey = getShopKeyFromDomain(shopDomain);
    if (!shopKey) {
      return res.status(200).json({ ok: false, ignored: true, reason: 'missing_shop' });
    }

    const eventId = sanitizeEventId(payload?.eventId, token);
    const tokenKey = tokenToKey(token);
    const baseWrite = {
      shopKey,
      token,
      tokenKey,
      eventId,
      timestamp,
      email,
      shopDomain,
      eventType,
    };

    if (eventType === 'checkout_progress' || eventType === 'checkout_completed') {
      await writeProgressEvent(baseWrite);
    } else {
      await writeAbandonPing({ ...baseWrite, reason: eventType });
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[pixel] handler error:', error?.message || error);
    return res.status(200).json({ ok: false, error: 'internal_error' });
  }
}

function readRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => reject(err));
  });
}

function safeJsonParse(raw: string): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function normalizeEventType(value: unknown): PixelEventType | null {
  if (isPixelEventType(value)) return value;
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (isPixelEventType(normalized)) return normalized;
  return null;
}

function sanitizeEventId(eventId: unknown, token: string): string {
  const fallback = tokenToKey(token) || 'state';
  if (typeof eventId !== 'string' || !eventId.trim()) return fallback;
  return tokenToKey(eventId);
}

function deriveDomainFromReferer(req: NextApiRequest): string | null {
  const referer = req.headers.referer || req.headers.origin;
  if (!referer || typeof referer !== 'string') return null;
  try {
    const url = new URL(referer);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (/\bshopify\b/.test(host) || host.endsWith('myshopify.com') || host.includes('shopifypreview')) {
      return host;
    }
    return null;
  } catch (_) {
    return null;
  }
}


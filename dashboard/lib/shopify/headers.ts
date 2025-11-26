import type { NextApiRequest } from 'next';

export function normalizeHeaderValue(header: string | string[] | undefined): string | null {
  if (!header) return null;
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') return null;
  return value.trim();
}

export function getShopDomainFromHeaders(req: NextApiRequest): string | null {
  const raw = normalizeHeaderValue(req.headers['x-shopify-shop-domain']);
  if (!raw) return null;
  return raw.toLowerCase();
}

export function getTopicFromHeaders(req: NextApiRequest): string | null {
  const raw = normalizeHeaderValue(req.headers['x-shopify-topic']);
  if (!raw) return null;
  return raw.toLowerCase();
}


import crypto from 'crypto';

export function verifyWebhookHmac(rawBody: Buffer, hmacHeader: string | null, secret: string): boolean {
  if (!rawBody || !hmacHeader || !secret) return false;
  let provided: Buffer;
  try {
    provided = Buffer.from(hmacHeader, 'base64');
  } catch {
    return false;
  }

  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const expected = Buffer.from(digest, 'base64');
  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}


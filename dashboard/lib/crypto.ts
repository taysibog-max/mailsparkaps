import crypto from 'crypto';

const ALG = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || '';
  if (!key) {
    throw new Error('SHOPIFY_TOKEN_ENCRYPTION_KEY is not set');
  }
  // Support hex or base64; fallback to utf8 padded
  try {
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
      return Buffer.from(key, 'hex');
    }
    const b64 = Buffer.from(key, 'base64');
    if (b64.length === 32) return b64;
  } catch (_e) {
    // ignore
  }
  const utf = Buffer.from(key, 'utf8');
  if (utf.length < 32) {
    const padded = Buffer.alloc(32);
    utf.copy(padded);
    return padded;
  }
  return utf.subarray(0, 32);
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all base64)
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted token format');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

export function signState(data: string): string {
  const secret =
    process.env.SHOPIFY_STATE_SECRET ||
    process.env.SHOPIFY_OAUTH_STATE_SECRET ||
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY ||
    '';
  if (!secret) throw new Error('Missing state signing secret');
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}





import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKeyBuffer(): Buffer {
  const secret =
    process.env.SHOPIFY_ENCRYPTION_KEY ||
    process.env.SERVER_ENCRYPTION_KEY ||
    process.env.NEXT_PUBLIC_SHOPIFY_ENCRYPTION_KEY ||
    '';

  if (!secret) {
    throw new Error('SHOPIFY_ENCRYPTION_KEY environment variable is not configured');
  }

  if (/^[0-9a-f]{64}$/i.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  try {
    const decoded = Buffer.from(secret, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch (_) {
    // ignore base64 decode errors; fallback to hash
  }

  const buf = Buffer.from(secret);
  if (buf.length === 32) {
    return buf;
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function getKey(): Buffer {
  return getKeyBuffer();
}

export function encryptToken(token: string): string {
  if (typeof token !== 'string' || !token) {
    throw new Error('Cannot encrypt empty token');
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptToken(payload: string): string {
  if (!payload) {
    throw new Error('Cannot decrypt empty payload');
  }
  const data = Buffer.from(payload, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encryptedText = data.subarray(IV_LENGTH + 16);
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString('utf8');
}



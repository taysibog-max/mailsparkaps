import { adminDatabase } from '../lib/firebaseAdmin';
import { sanitizeFirebaseKey } from './firebasePixel';
import { sanitizeEmail } from './pixelTypes';

export async function hasEmailBeenSent(uid: string, tokenKey: string): Promise<boolean> {
  if (!uid || !tokenKey) return false;
  const safeToken = sanitizeFirebaseKey(tokenKey);
  try {
    const snap = await adminDatabase.ref(`email-log/${uid}/${safeToken}`).once('value');
    return snap.exists();
  } catch {
    return false;
  }
}

export async function markEmailSent(uid: string, tokenKey: string, email: string): Promise<void> {
  if (!uid || !tokenKey || !email) return;
  const safeToken = sanitizeFirebaseKey(tokenKey);
  const safeEmail = sanitizeEmail(email) || email;
  try {
    await adminDatabase.ref(`email-log/${uid}/${safeToken}`).set({
      sentAt: Date.now(),
      email: safeEmail,
    });
  } catch (err) {
    console.warn('[email-log] Failed to mark email sent:', err);
  }
}



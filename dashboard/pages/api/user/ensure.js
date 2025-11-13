import { adminAuth } from '../../../lib/firebaseAdmin';
import { getAdminDb } from '../../../lib/firebaseAdminDb';

function splitName(displayName) {
  if (!displayName) return { firstName: '', lastName: '' };
  const parts = String(displayName).trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Get latest auth user to ensure freshest profile
    const user = await adminAuth.getUser(uid);
    const displayName = user.displayName || decoded.name || '';
    const email = user.email || decoded.email || '';
    const photoURL = user.photoURL || decoded.picture || '';
    const providerIds = (user.providerData || []).map(p => p.providerId);
    const { firstName, lastName } = splitName(displayName);

    const db = getAdminDb();
    const profileRef = db.ref(`users/${uid}/profile`);
    const now = Date.now();

    // Create if missing; always update lastLoginAt + basic fields
    await profileRef.transaction((existing) => {
      const base = existing || { createdAt: now, uid };
      return {
        ...base,
        email,
        displayName,
        firstName,
        lastName,
        photoURL,
        providers: providerIds,
        lastLoginAt: now,
      };
    });

    const snapshot = await profileRef.once('value');
    return res.status(200).json({ profile: snapshot.val() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}



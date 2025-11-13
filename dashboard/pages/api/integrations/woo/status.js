import { adminAuth } from '../../../../lib/firebaseAdmin';
import { getAdminDb } from '../../../../lib/firebaseAdminDb';

export default async function handler(req, res) {
  try {
    const auth = req.headers.authorization?.split('Bearer ')[1];
    if (!auth) return res.status(200).json({ store: null });
    const decoded = await adminAuth.verifyIdToken(auth).catch(() => null);
    if (!decoded) return res.status(200).json({ store: null });
    const uid = decoded.uid;
    
    const db = getAdminDb();
    const snapshot = await db.ref(`users/${uid}/integrations/woocommerce`).once('value');
    const store = snapshot.exists() ? snapshot.val() : null;
    
    return res.status(200).json({ store });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}



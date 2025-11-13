import { adminAuth } from '../../../../lib/firebaseAdmin';
import { getAdminDb } from '../../../../lib/firebaseAdminDb';

export default async function handler(req, res){
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(200).json({ store: null });
    const decoded = await adminAuth.verifyIdToken(token).catch(()=>null);
    if (!decoded) return res.status(200).json({ store: null });
    const uid = decoded.uid;
    
    const db = getAdminDb();
    const snapshot = await db.ref(`users/${uid}/integrations/shopify`).once('value');
    let store = snapshot.exists() ? snapshot.val() : null;
    // If token missing, try mirror path
    if (store && !store.accessToken) {
      try {
        const mirror = await db.ref(`stores/${uid}_shopify`).once('value');
        if (mirror.exists()) {
          const mv = mirror.val() || {};
          if (mv.accessToken) store.accessToken = mv.accessToken;
        }
      } catch(_) {}
    }
    
    res.status(200).json({ store });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}



import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';

// One-time migration endpoint to move existing global data under users/<uid>/...
// Usage: GET /api/admin/migrate-user-data?uid=<uid>
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const uidParam = String(req.query.uid || '').trim();
    if (!uidParam) return res.status(400).json({ error: 'Missing uid' });

    // Auth: allow only self-migration (caller must be same uid)
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    let callerUid = null;
    try { const d = await adminAuth.verifyIdToken(token); callerUid = d.uid; } catch (_) {}
    if (callerUid !== uidParam) return res.status(403).json({ error: 'Forbidden' });

    // Collect store keys owned by user (support both storeOwners and stores mappings)
    const [ownersSnap, storesSnap] = await Promise.all([
      adminDatabase.ref('storeOwners').get(),
      adminDatabase.ref('stores').get(),
    ]);
    const ownerMap = ownersSnap.exists() ? ownersSnap.val() : {};
    const storesMap = storesSnap.exists() ? storesSnap.val() : {};
    const storeKeys = new Set(
      Object.entries(ownerMap).filter(([, v]) => v === uidParam).map(([k]) => k)
    );
    // Add from stores mapping if present
    Object.entries(storesMap).forEach(([k, v]) => {
      try { if ((v?.owner_uid || v?.uid) === uidParam) storeKeys.add(k); } catch (_) {}
    });

    const result = { carts: 0, emails: 0, limits: 0, locks: 0, messages: 0, stats: {} };

    // 1) Move abandoned carts that belong to this user
    const cartsSnap = await adminDatabase.ref('abandoned_carts').get();
    const userCartsRef = adminDatabase.ref(`users/${uidParam}/abandoned_carts`);
    const emailSet = new Set();
    if (cartsSnap.exists()) {
      const all = cartsSnap.val() || {};
      for (const [cartId, cart] of Object.entries(all)) {
        const storeKey = (cart.store_name ? String(cart.store_name).replace(/\./g, '_') : null);
        const owned = cart.owner_uid === uidParam || (storeKey && storeKeys.has(storeKey));
        if (!owned) continue;
        try {
          await userCartsRef.child(cartId).set({ ...cart, owner_uid: uidParam });
          result.carts += 1;
          if (cart.user_email) emailSet.add(String(cart.user_email).toLowerCase());
        } catch (_) {}
      }
    }

    // 2) Copy daily_sends/email_limits/locks for emails seen in carts
    const copyEmailTree = async (globalPath, userPath, counterKey) => {
      const snap = await adminDatabase.ref(globalPath).get();
      if (!snap.exists()) return;
      const all = snap.val() || {};
      for (const [emailKey, node] of Object.entries(all)) {
        // emailKey is base64(email), copy only those that appear in user's carts
        try {
          const emailPlain = Buffer.from(emailKey, 'base64').toString('utf8').toLowerCase();
          if (!emailSet.has(emailPlain)) continue;
        } catch (_) { continue; }
        try { await adminDatabase.ref(`${userPath}/${emailKey}`).set(node); result[counterKey] += 1; } catch (_) {}
      }
    };

    result.emails = emailSet.size;
    await copyEmailTree('daily_sends', `users/${uidParam}/daily_sends`, 'limits');
    await copyEmailTree('email_limits', `users/${uidParam}/email_limits`, 'limits');
    await copyEmailTree('locks', `users/${uidParam}/locks`, 'locks');
    // stores mapping
    try {
      const storesSnap = await adminDatabase.ref('stores').get();
      if (storesSnap.exists()) {
        const stores = storesSnap.val() || {};
        const owned = {};
        Object.entries(stores).forEach(([k, v]) => {
          try { if ((v?.uid || v?.owner_uid) === uidParam) owned[k] = v; } catch (_) {}
        });
        if (Object.keys(owned).length) {
          await adminDatabase.ref(`users/${uidParam}/stores`).set(owned);
        }
      }
    } catch(_) {}

    // Move global stats baseline under user if present
    try {
      const gSnap = await adminDatabase.ref('stats/global').get();
      const g = gSnap.exists() ? gSnap.val() : {};
      await adminDatabase.ref(`users/${uidParam}/stats`).update({
        sent: g.sent || 0,
        opens: g.opens || 0,
        clicks: g.clicks || 0,
        recovered: g.recovered || 0,
      });
    } catch (_) {}

    // 3) Messages related to user's carts
    const msgsSnap = await adminDatabase.ref('messages').get();
    if (msgsSnap.exists()) {
      const all = msgsSnap.val() || {};
      for (const [msgId, msg] of Object.entries(all)) {
        if (msg.owner_uid === uidParam) {
          try { await adminDatabase.ref(`users/${uidParam}/messages/${msgId}`).set(msg); result.messages += 1; } catch (_) {}
        }
      }
    }

    // 4) Compute user stats from carts/messages
    let sent = 0, opens = 0, clicks = 0, recovered = 0;
    try {
      const uCartsSnap = await userCartsRef.get();
      if (uCartsSnap.exists()) {
        const uCarts = uCartsSnap.val() || {};
        for (const c of Object.values(uCarts)) {
          if (c.email_sent) sent += 1;
          if (c.engagement?.opened) opens += 1;
          if (c.engagement?.clicked) clicks += 1;
          if (c.status === 'recovered') recovered += 1;
        }
      }
    } catch (_) {}
    await adminDatabase.ref(`users/${uidParam}/stats`).set({ sent, opens, clicks, recovered });
    result.stats = { sent, opens, clicks, recovered };

    res.status(200).json({ success: true, result });
  } catch (e) {
    res.status(500).json({ error: 'Migration failed', details: e.message });
  }
}



import { adminDatabase } from '../../../lib/firebaseAdmin';
import * as admin from 'firebase-admin';

export const config = {
  api: {
    bodyParser: false,
  },
};

function isShopifyLike(value) {
  try {
    if (!value) return false;
    const s = String(value).toLowerCase();
    return s.includes('myshopify.com') || s.includes('myshopify') || s.includes('_myshopify_com');
  } catch {
    return false;
  }
}

async function purgeRealtimeDb() {
  const db = adminDatabase;
  const result = {
    storeOwners: 0,
    integrations: 0,
    storesMirrors: 0,
    contacts: 0,
    abandonedCarts: 0,
    events: 0,
  };

  // 1) storeOwners/* keys containing myshopify
  try {
    const soSnap = await db.ref('storeOwners').get();
    if (soSnap.exists()) {
      const updates = {};
      Object.keys(soSnap.val() || {}).forEach((k) => {
        if (isShopifyLike(k)) {
          updates[`storeOwners/${k}`] = null;
          result.storeOwners++;
        }
      });
      if (Object.keys(updates).length) await db.ref().update(updates);
    }
  } catch (_) {}

  // 2) Iterate users/*
  try {
    const usersSnap = await db.ref('users').get();
    if (usersSnap.exists()) {
      const allUsers = usersSnap.val() || {};
      const userIds = Object.keys(allUsers);
      for (const uid of userIds) {
        // Clean stray Shopify fields directly under users/{uid}/integrations (legacy shape)
        try {
          const integRootSnap = await db.ref(`users/${uid}/integrations`).get();
          if (integRootSnap.exists()) {
            const integRoot = integRootSnap.val() || {};
            const updates = {};
            // If root has platform 'shopify', drop known fields that belonged to shopify payload
            if (String(integRoot.platform || '').toLowerCase() === 'shopify') {
              ['platform','shop','mode','connectedAt','contactsCount','lastSynced','lastSyncAt','accessToken']
                .forEach((k) => { updates[`users/${uid}/integrations/${k}`] = null; });
            }
            // Also drop any child key that looks like shopify* (defensive)
            Object.keys(integRoot).forEach((k) => {
              if (/^shopify/i.test(k)) {
                updates[`users/${uid}/integrations/${k}`] = null;
              }
            });
            if (Object.keys(updates).length) {
              await db.ref().update(updates);
              result.integrations++;
            }
          }
        } catch (_) {}

        // Remove integration
        try {
          const integSnap = await db.ref(`users/${uid}/integrations/shopify`).get();
          if (integSnap.exists()) {
            await db.ref(`users/${uid}/integrations/shopify`).remove();
            result.integrations++;
          }
        } catch (_) {}

        // Remove contacts from RTDB where source/sourceStore is shopify
        try {
          const contactsSnap = await db.ref(`users/${uid}/contacts`).get();
          if (contactsSnap.exists()) {
            const contacts = contactsSnap.val() || {};
            const updates = {};
            Object.entries(contacts).forEach(([key, val]) => {
              const v = val || {};
              const src = String(v.source || '').toLowerCase();
              const srcStore = String(v.sourceStore || '').toLowerCase();
              if (src === 'shopify' || srcStore === 'shopify') {
                updates[`users/${uid}/contacts/${key}`] = null;
                result.contacts++;
              }
            });
            if (Object.keys(updates).length) await db.ref().update(updates);
          }
        } catch (_) {}

        // Remove abandoned carts for Shopify
        try {
          const cartsSnap = await db.ref(`users/${uid}/abandoned_carts`).get();
          if (cartsSnap.exists()) {
            const carts = cartsSnap.val() || {};
            const updates = {};
            Object.entries(carts).forEach(([cid, val]) => {
              const v = val || {};
              const platform = String(v.platform || '').toLowerCase();
              const storeName = String(v.store_name || '').toLowerCase();
              if (platform === 'shopify' || isShopifyLike(storeName)) {
                updates[`users/${uid}/abandoned_carts/${cid}`] = null;
                result.abandonedCarts++;
              }
            });
            if (Object.keys(updates).length) await db.ref().update(updates);
          }
        } catch (_) {}

        // Remove events/* where platform/source == shopify
        try {
          const eventsSnap = await db.ref(`events/${uid}`).get();
          if (eventsSnap.exists()) {
            const updates = {};
            const evRoot = eventsSnap.val() || {};
            Object.entries(evRoot).forEach(([type, events]) => {
              const group = events || {};
              Object.entries(group).forEach(([eid, ev]) => {
                const v = ev || {};
                const platform = String(v.platform || '').toLowerCase();
                const source = String(v.source || '').toLowerCase();
                const shop = String(v.shopDomain || '').toLowerCase();
                if (platform === 'shopify' || source === 'shopify' || isShopifyLike(shop)) {
                  updates[`events/${uid}/${type}/${eid}`] = null;
                  result.events++;
                }
              });
            });
            if (Object.keys(updates).length) await db.ref().update(updates);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  // 3) Remove mirrors: stores/*_shopify
  try {
    const storesSnap = await db.ref('stores').get();
    if (storesSnap.exists()) {
      const updates = {};
      Object.keys(storesSnap.val() || {}).forEach((k) => {
        if (/_shopify$/i.test(k) || isShopifyLike(k)) {
          updates[`stores/${k}`] = null;
          result.storesMirrors++;
        }
      });
      if (Object.keys(updates).length) await db.ref().update(updates);
    }
  } catch (_) {}

  return result;
}

async function purgeFirestore() {
  const fs = admin.firestore();
  const result = {
    shopifyConnections: 0,
    fsStoresDocs: 0,
    fsStoresSubDocs: 0,
    fsUserContacts: 0,
  };

  // 1) Drop shopifyConnections collection
  try {
    const snap = await fs.collection('shopifyConnections').get();
    if (!snap.empty) {
      const batchSize = 400;
      let batch = fs.batch();
      let count = 0;
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
        count++;
        if (count % batchSize === 0) {
          batch.commit();
          batch = fs.batch();
        }
      });
      await batch.commit();
      result.shopifyConnections = snap.size;
    }
  } catch (_) {}

  // 2) Remove stores/* docs whose ID includes "myshopify"
  try {
    const docRefs = await fs.collection('stores').listDocuments();
    for (const ref of docRefs) {
      if (isShopifyLike(ref.id)) {
        // delete subcollections first
        const subcols = await ref.listCollections();
        for (const col of subcols) {
          const docs = await col.listDocuments();
          result.fsStoresSubDocs += docs.length;
          const batchSize = 400;
          for (let i = 0; i < docs.length; i += batchSize) {
            const slice = docs.slice(i, i + batchSize);
            const b = fs.batch();
            slice.forEach((dr) => b.delete(dr));
            await b.commit();
          }
        }
        await ref.delete();
        result.fsStoresDocs++;
      }
    }
  } catch (_) {}

  // 3) Remove users/*/contacts where source/sourceStore == shopify
  try {
    const userRefs = await fs.collection('users').listDocuments();
    for (const uref of userRefs) {
      // query by source == 'shopify'
      const contactsCol = uref.collection('contacts');
      const bySource = await contactsCol.where('source', '==', 'shopify').get().catch(()=>null);
      const byStore = await contactsCol.where('sourceStore','==','shopify').get().catch(()=>null);
      const toDelete = new Map();
      if (bySource && !bySource.empty) bySource.docs.forEach(d=> toDelete.set(d.id, d.ref));
      if (byStore && !byStore.empty) byStore.docs.forEach(d=> toDelete.set(d.id, d.ref));
      if (toDelete.size > 0) {
        const docs = Array.from(toDelete.values());
        result.fsUserContacts += docs.length;
        const batchSize = 400;
        for (let i = 0; i < docs.length; i += batchSize) {
          const slice = docs.slice(i, i + batchSize);
          const b = fs.batch();
          slice.forEach((dr) => b.delete(dr));
          await b.commit();
        }
      }
    }
  } catch (_) {}

  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const secret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [rtdb, fs] = await Promise.all([purgeRealtimeDb(), purgeFirestore()]);

    return res.status(200).json({ ok: true, rtdb, firestore: fs });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}



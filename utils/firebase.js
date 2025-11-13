'use strict';

const admin = require('firebase-admin');

let firebaseApp = null;
let db = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
  if (firebaseApp) {
    return { app: firebaseApp, db };
  }

  try {
    // Check if required env vars are set
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      console.warn('[Firebase] Missing Firebase credentials. Cart tracking disabled.');
      return { app: null, db: null };
    }

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey,
        clientEmail,
      }),
      databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
    });

    db = admin.database();

    console.log('[Firebase] ✓ Firebase Admin initialized successfully');
    return { app: firebaseApp, db };
  } catch (error) {
    console.error('[Firebase] Initialization error:', error.message);
    return { app: null, db: null };
  }
}

/**
 * Get Firebase database reference
 */
function getDatabase() {
  if (!db) {
    const { db: database } = initializeFirebase();
    return database;
  }
  return db;
}

/**
 * Save cart to Firebase
 * @param {string} cartId - Unique cart identifier
 * @param {object} cartData - Cart data { user_email, items, timestamp }
 */
async function saveCart(cartId, cartData) {
  const database = getDatabase();
  if (!database) {
    throw new Error('Firebase not initialized');
  }

  const cartRef = database.ref(`carts/${cartId}`);
  const data = {
    user_email: cartData.user_email,
    items: cartData.items || [],
    status: 'pending',
    createdAt: cartData.timestamp || Date.now(),
    updatedAt: Date.now(),
  };

  await cartRef.set(data);
  console.log(`[Firebase] Cart saved: ${cartId}`);
  return data;
}

/**
 * Get all pending carts older than specified minutes
 * @param {number} minutes - Age threshold in minutes
 */
async function getPendingCarts(minutes = 30) {
  const database = getDatabase();
  if (!database) {
    return [];
  }

  const cutoffTime = Date.now() - (minutes * 60 * 1000);
  const cartsRef = database.ref('carts');
  
  const snapshot = await cartsRef
    .orderByChild('status')
    .equalTo('pending')
    .once('value');

  const carts = [];
  snapshot.forEach((childSnapshot) => {
    const cart = childSnapshot.val();
    if (cart.createdAt < cutoffTime) {
      carts.push({
        id: childSnapshot.key,
        ...cart,
      });
    }
  });

  return carts;
}

/**
 * Update cart status
 * @param {string} cartId - Cart ID
 * @param {string} status - New status (e.g., 'abandoned', 'email_sent', 'completed')
 */
async function updateCartStatus(cartId, status) {
  const database = getDatabase();
  if (!database) {
    throw new Error('Firebase not initialized');
  }

  const cartRef = database.ref(`carts/${cartId}`);
  await cartRef.update({
    status,
    updatedAt: Date.now(),
  });

  console.log(`[Firebase] Cart ${cartId} status updated to: ${status}`);
}

/**
 * Get cart by ID
 * @param {string} cartId - Cart ID
 */
async function getCart(cartId) {
  const database = getDatabase();
  if (!database) {
    return null;
  }

  const snapshot = await database.ref(`carts/${cartId}`).once('value');
  return snapshot.val();
}

module.exports = {
  initializeFirebase,
  getDatabase,
  saveCart,
  getPendingCarts,
  updateCartStatus,
  getCart,
};



import * as admin from 'firebase-admin';

let app;
if (!admin.apps.length) {
  try {
    const hasEnvCreds = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
    if (hasEnvCreds) {
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
      });
    } else {
      app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID || 'automailer-8d125'}-default-rtdb.firebaseio.com`
      });
    }
  } catch (e) {
    try { app = admin.app(); } catch (_) { /* ignore */ }
  }
}

export const adminAuth = admin.auth();
// Use Realtime Database instead of Firestore
export const adminDb = admin.database();


import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let app;
if (!admin.apps.length) {
  try {
    const hasEnvCreds = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    
    if (hasEnvCreds) {
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
      });
    } else {
      // Try local service account file at dashboard/secrets/service-account.json
      const saPath = path.join(process.cwd(), 'secrets', 'service-account.json');
      if (fs.existsSync(saPath)) {
        const json = JSON.parse(fs.readFileSync(saPath, 'utf8'));
        app = admin.initializeApp({
          credential: admin.credential.cert(json),
          projectId: json.project_id || projectId,
          databaseURL: `https://${json.project_id || projectId}-default-rtdb.firebaseio.com`,
        });
      } else {
        // Fallback to ADC (GOOGLE_APPLICATION_CREDENTIALS or local gcloud auth)
        app = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: projectId,
          databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
        });
      }
    }
    console.log('[Firebase Admin] ✅ Initialized with Realtime Database:', `https://${projectId}-default-rtdb.firebaseio.com`);
  } catch (e) {
    console.error('[Firebase Admin] ❌ Initialization error:', e.message);
    try { app = admin.app(); } catch (_) { /* ignore */ }
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminDatabase = admin.database();



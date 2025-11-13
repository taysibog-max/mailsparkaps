import * as admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';

const PROJECT_ID = 'automailer-8d125';
const DATABASE_URL = `https://${PROJECT_ID}-default-rtdb.firebaseio.com`;
const APP_NAME = 'automailer-admin';

export function getAdminDb() {
  try {
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKeyRaw) {
      throw new Error('FIREBASE_PRIVATE_KEY is not set');
    }
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    // Get existing named app or initialize a new one with proper databaseURL
    let app;
    try {
      app = admin.app(APP_NAME);
    } catch (_e) {
      console.log('🔥 Initializing Firebase Admin app:', APP_NAME);
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: PROJECT_ID,
          clientEmail: 'firebase-adminsdk-fbsvc@automailer-8d125.iam.gserviceaccount.com',
          privateKey,
        }),
        databaseURL: DATABASE_URL,
      }, APP_NAME);
      console.log('✓ Firebase Admin initialized with URL:', DATABASE_URL);
    }

    // Always use the named app's database instance with explicit URL
    return getDatabase(app, DATABASE_URL);

  } catch (error) {
    console.error('❌ Firebase Admin DB error:', error);
    throw error;
  }
}


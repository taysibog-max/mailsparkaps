import * as admin from 'firebase-admin';

let app: admin.app.App | null = null;

function initApp(): admin.app.App {
  if (app) return app;
  if (admin.apps.length) {
    app = admin.app();
    return app;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    // Try ADC
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    return app;
  }
  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return app;
}

export function getFirestore(): admin.firestore.Firestore {
  return initApp().firestore();
}

export function getAuth(): admin.auth.Auth {
  return initApp().auth();
}





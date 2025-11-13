/**
 * Firebase dijagnostika za debugging konekcija
 */

import { getFirebaseApp } from './firebaseClient';
import { checkFirebaseEnv } from './checkEnv';

export async function runFirebaseDiagnostics() {
  const results = {
    environment: 'checking',
    firebaseConfig: 'checking',
    auth: 'checking',
    firestore: 'checking',
    currentUser: 'checking',
    timestamp: new Date().toISOString()
  };

  try {
    // 0. Provjeri environment varijable
    const envCheck = checkFirebaseEnv();
    results.environment = envCheck.allPresent ? 'configured' : `missing: ${envCheck.missing.join(', ')}`;
    
    if (!envCheck.allPresent) {
      results.error = `Missing environment variables: ${envCheck.missing.join(', ')}`;
      return results;
    }

    // 1. Provjeri Firebase konfiguraciju
    const { auth, firestore } = getFirebaseApp();
    results.firebaseConfig = 'loaded';

    // 2. Provjeri auth
    if (auth) {
      results.auth = 'connected';
      results.currentUser = auth.currentUser ? auth.currentUser.uid : 'null';
    } else {
      results.auth = 'failed';
    }

    // 3. Provjeri Firestore sa poboljšanim timeout-om
    if (firestore) {
      try {
        // Povećaj timeout na 10 sekundi za sporije konekcije
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firestore timeout (10s)')), 10000)
        );
        
        // Pokušaj da učitaš neki dokument da testiraš konekciju
        const testPromise = firestore.collection('_test').limit(1).get();
        
        await Promise.race([testPromise, timeoutPromise]);
        results.firestore = 'connected';
      } catch (e) {
        results.firestore = `error: ${e.message}`;
        // Dodaj dodatne informacije o grešci
        if (e.message.includes('timeout')) {
          results.suggestion = 'Firestore timeout - proverite internet konekciju ili Firebase project status';
        } else if (e.message.includes('permission')) {
          results.suggestion = 'Permission denied - proverite Firestore security rules';
        } else if (e.message.includes('project')) {
          results.suggestion = 'Project not found - proverite NEXT_PUBLIC_FIREBASE_PROJECT_ID';
        }
      }
    } else {
      results.firestore = 'failed';
      results.suggestion = 'Firestore not initialized - proverite Firebase konfiguraciju';
    }

  } catch (e) {
    results.error = e.message;
    results.suggestion = 'General Firebase error - proverite .env.local konfiguraciju';
  }

  return results;
}

export function logFirebaseDiagnostics() {
  runFirebaseDiagnostics().then(results => {
    console.log('🔍 Firebase Diagnostics:', results);
  });
}

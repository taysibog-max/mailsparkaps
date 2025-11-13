/**
 * Brza dijagnostika za debugging - pokreće se u browser konzoli
 */

import { checkFirebaseEnv, logFirebaseEnv } from './checkEnv';
import { runFirebaseDiagnostics } from './firebaseDiagnostics';
import { getFirebaseApp } from './firebaseClient';

// Dodaj u window objekat za lakše pozivanje iz konzole
if (typeof window !== 'undefined') {
  window.diagnostics = {
    checkEnv: logFirebaseEnv,
    checkFirebase: runFirebaseDiagnostics,
    checkAuth: () => {
      const { auth } = getFirebaseApp();
      console.log('🔐 Auth Status:', {
        currentUser: auth.currentUser ? auth.currentUser.uid : 'null',
        isLoggedIn: !!auth.currentUser,
        authState: 'checking...'
      });
      
      // Listen for auth state changes
      const unsubscribe = auth.onAuthStateChanged((user) => {
        console.log('🔄 Auth State Changed:', user ? user.uid : 'null');
        unsubscribe();
      });
    },
    clearCache: () => {
      localStorage.clear();
      console.log('🧹 Cache cleared, reloading...');
      window.location.reload();
    },
    fullDiagnostics: async () => {
      console.log('🔍 Running Full Diagnostics...');
      console.log('========================');
      
      // 1. Environment
      logFirebaseEnv();
      
      // 2. Firebase
      const firebase = await runFirebaseDiagnostics();
      console.log('Firebase:', firebase);
      
      // 3. Auth
      const { auth } = getFirebaseApp();
      console.log('Auth:', {
        currentUser: auth.currentUser ? auth.currentUser.uid : 'null',
        isLoggedIn: !!auth.currentUser
      });
      
      // 4. Cache
      const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('am_'));
      console.log('Cache:', cacheKeys);
      
      console.log('========================');
      console.log('✅ Diagnostics Complete');
    }
  };
  
  console.log('🛠️  Diagnostics loaded! Use:');
  console.log('  - window.diagnostics.fullDiagnostics() - Full check');
  console.log('  - window.diagnostics.checkEnv() - Environment variables');
  console.log('  - window.diagnostics.checkFirebase() - Firebase status');
  console.log('  - window.diagnostics.checkAuth() - Auth status');
  console.log('  - window.diagnostics.clearCache() - Clear cache & reload');
}

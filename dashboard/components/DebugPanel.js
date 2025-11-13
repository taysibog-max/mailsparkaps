import { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { getFirebaseApp } from '../lib/firebaseClient';
import { loadFromCache, getCacheKey } from '../lib/cacheUtils';
import { runFirebaseDiagnostics } from '../lib/firebaseDiagnostics';
import { checkFirebaseEnv } from '../lib/checkEnv';

/**
 * Debug panel za dijagnostiku problema sa store konekcijom
 * Prikazuje se samo u development mode-u
 */

export default function DebugPanel() {
  const { store, isConnected, loading } = useStore();
  const [authUser, setAuthUser] = useState(null);
  const [cacheData, setCacheData] = useState(null);
  const [firebaseStatus, setFirebaseStatus] = useState('checking');
  const [diagnostics, setDiagnostics] = useState(null);
  const [envCheck, setEnvCheck] = useState(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { auth } = getFirebaseApp();
        setAuthUser(auth.currentUser);
        
        if (auth.currentUser) {
          const cacheKey = getCacheKey(auth.currentUser.uid, 'store_connection');
          const cached = loadFromCache(cacheKey);
          setCacheData(cached);
        }
        
        setFirebaseStatus('connected');
        
        // Provjeri environment varijable
        const env = checkFirebaseEnv();
        setEnvCheck(env);
        console.log('🔧 Environment Check:', env);
        
        // Ako nema environment varijabli, prikaži upozorenje
        if (!env.allPresent) {
          console.error('❌ CRITICAL: Missing Firebase environment variables!');
          console.log('📝 Please create .env.local file with Firebase config');
          console.log('📖 See: FIREBASE_SETUP_INSTRUCTIONS.md');
        }
        
        // Pokreni dijagnostiku
        runFirebaseDiagnostics().then(results => {
          setDiagnostics(results);
          console.log('🔍 Firebase Diagnostics:', results);
        });
      } catch (e) {
        console.error('Firebase check failed:', e);
        setFirebaseStatus('error: ' + e.message);
      }
    };
    
    checkStatus();
  }, []);

  // Prikaži samo u development mode-u
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs font-mono max-w-md z-50">
      <div className="font-bold mb-2 text-yellow-400">🐛 Debug Panel</div>
      
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Loading:</span> 
          <span className={loading ? 'text-yellow-400' : 'text-green-400'}>{loading ? 'true' : 'false'}</span>
        </div>
        
        <div>
          <span className="text-gray-400">Connected:</span> 
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>{isConnected ? 'true' : 'false'}</span>
        </div>
        
        <div>
          <span className="text-gray-400">Store:</span> 
          <span className="text-blue-400">{store ? JSON.stringify(store) : 'null'}</span>
        </div>
        
        <div>
          <span className="text-gray-400">Auth User:</span> 
          <span className="text-blue-400">{authUser ? authUser.uid : 'null'}</span>
        </div>
        
        <div>
          <span className="text-gray-400">Firebase:</span> 
          <span className={firebaseStatus.includes('error') ? 'text-red-400' : 'text-green-400'}>
            {firebaseStatus}
          </span>
        </div>
        
        <div>
          <span className="text-gray-400">Cache:</span> 
          <span className="text-blue-400">{cacheData ? 'exists' : 'none'}</span>
        </div>
        
        {envCheck && (
          <>
            <div className="pt-2 border-t border-gray-600">
              <div className="text-gray-400 mb-1">Environment:</div>
              <div className="text-xs space-y-1">
                <div>All Present: <span className={envCheck.allPresent ? 'text-green-400' : 'text-red-400'}>{envCheck.allPresent ? 'yes' : 'no'}</span></div>
                <div>Project ID: <span className="text-blue-400">{envCheck.config.projectId}</span></div>
                {envCheck.missing.length > 0 && (
                  <div className="text-red-400">Missing: {envCheck.missing.join(', ')}</div>
                )}
              </div>
            </div>
          </>
        )}
        
        {diagnostics && (
          <>
            <div className="pt-2 border-t border-gray-600">
              <div className="text-gray-400 mb-1">Firebase Status:</div>
              <div className="text-xs space-y-1">
                <div>Config: <span className={diagnostics.firebaseConfig === 'loaded' ? 'text-green-400' : 'text-red-400'}>{diagnostics.firebaseConfig}</span></div>
                <div>Auth: <span className={diagnostics.auth === 'connected' ? 'text-green-400' : 'text-red-400'}>{diagnostics.auth}</span></div>
                <div>Firestore: <span className={diagnostics.firestore === 'connected' ? 'text-green-400' : 'text-red-400'}>{diagnostics.firestore}</span></div>
                {diagnostics.error && <div className="text-red-400">Error: {diagnostics.error}</div>}
              </div>
            </div>
          </>
        )}
      </div>
      
      <div className="mt-2 pt-2 border-t border-gray-600">
        <button 
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
        >
          Clear Cache & Reload
        </button>
      </div>
    </div>
  );
}

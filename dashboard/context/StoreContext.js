import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { getFirebaseApp } from '../lib/firebaseClient';
import { apiGet } from '../lib/apiClient';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { checkStoreConnection, saveConnection } from '../firebase/integrations';
import { onAuthStateChanged } from 'firebase/auth';
import { loadFromCache, saveToCache, getCacheKey, clearCache } from '../lib/cacheUtils';
import { 
  getConnectionCache, 
  setConnectionCache, 
  clearConnectionCache, 
  isConnectionCached, 
  getCachedStore,
  shouldRefreshCache 
} from '../lib/connectionCache';

const StoreCtx = createContext({
  store: null,
  isConnected: false,
  loading: true,
  connectionError: null,
  connectStore: async (_store) => {},
  disconnectStore: async () => {},
  refreshConnection: async () => {},
});

export function StoreProvider({ children }) {
  const { auth, firestore } = getFirebaseApp();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  // Strictno realni podaci: bez dev/mock prečica
  useEffect(() => {
    // nema auto-mockiranja; stanje se puni iz Firestore/API-a
  }, []);

  // Load on login
  useEffect(() => {
    console.log('🔄 StoreContext useEffect triggered');
    
    // Nema vremenskog mock fallback-a; čekamo stvarne podatke

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { 
        // Bez korisnika nema stanja prodavnice – držimo realno stanje
        console.log('🔄 No user, checking if WooCommerce is already connected...');
        try {
          const wooStatus = await apiGet(`/api/integrations/woo/status?ts=${Date.now()}`).catch(() => null);
          if (wooStatus?.store) {
            console.log('✅ WooCommerce already connected, setting store without user:', wooStatus.store);
            const storeData = { platform: 'woocommerce', ...wooStatus.store };
            setStore(storeData);
            setLoading(false);
            setConnectionCache(storeData);
            return;
          }
        } catch (e) {
          console.log('WooCommerce status check failed:', e.message);
        }
        
        setStore(null); 
        setLoading(false); 
        return; 
      }

      // 1) PRVO: Proveri localStorage cache (instant load)
      const cachedConnection = getConnectionCache();
      if (cachedConnection && !shouldRefreshCache()) {
        console.log('✅ Using cached connection:', cachedConnection);
        setStore(cachedConnection.store || cachedConnection);
        setLoading(false);
        
        // U pozadini asinhrono osvježi (ne blokiraj UI)
        setTimeout(() => refreshConnectionInBackground(u), 100);
        return;
      }

      // 1.5) Ako je WooCommerce već konektovan, odmah postavi store (realno stanje)
      console.log('🔄 No cache found, checking if WooCommerce is already connected...');
      try {
        // Proveri da li je WooCommerce već konektovan (iz server logova)
        const wooStatus = await apiGet(`/api/integrations/woo/status?ts=${Date.now()}`).catch(() => null);
        if (wooStatus?.store) {
          console.log('✅ WooCommerce already connected, setting store immediately:', wooStatus.store);
          const storeData = { platform: 'woocommerce', ...wooStatus.store };
          setStore(storeData);
          setLoading(false);
          setConnectionCache(storeData);
          
          // U pozadini osvježi ostale podatke
          setTimeout(() => refreshConnectionInBackground(u), 100);
          return;
        }
      } catch (e) {
        console.log('WooCommerce status check failed, continuing with normal flow:', e.message);
      }
      
      // 2) Ako nema cache-a ili je stariji od 24h, učitaj sa servera
      setLoading(true);
      setConnectionError(null);
      
      try {
        await loadConnectionFromServer(u);
      } catch (e) {
        console.error('Store connection check failed:', e);
        setStore(null);
        setConnectionError(e.message);
      } finally {
        setLoading(false);
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [auth, firestore]);

  // Background refresh funkcija
  const refreshConnectionInBackground = async (user) => {
    try {
      await loadConnectionFromServer(user, true); // silent = true
    } catch (e) {
      console.error('Background refresh failed:', e);
    }
  };

  // Učitaj konekciju sa servera
  const loadConnectionFromServer = async (user, silent = false) => {
    if (!silent) {
      console.log('🔄 Loading connection from server...');
    }

    // Dodaj timeout od 3 sekunde za brže fallback
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 3000)
    );
    
    const connectionPromise = Promise.race([
      checkStoreConnection(),
      timeoutPromise
    ]).catch(() => ({ platform: null, connected: false, data: null }));
    
    // Sve API pozive izvršavamo paralelno
    const [_, connectionResult, wooStatus, shopifyStatus] = await Promise.all([
      apiGet('/api/user/ensure').catch(() => null),
      connectionPromise,
      apiGet(`/api/integrations/woo/status?ts=${Date.now()}`).catch(() => null),
      apiGet(`/api/shopify/status?ts=${Date.now()}`).catch(() => null),
    ]);
    
    let storeData = null;
    
    // Prioritet: checkStoreConnection > API statusi
    if (connectionResult.connected) {
      storeData = { platform: connectionResult.platform, ...(connectionResult.data||{}) };
    } else {
      // Fallback na API statuse
      if (wooStatus?.store) {
        storeData = { platform: 'woocommerce', ...wooStatus.store };
      } else if (shopifyStatus?.store) {
        storeData = { platform: 'shopify', ...shopifyStatus.store };
      }
      
      // Sačuvaj u Firestore ako je pronađen
      if (storeData) {
        try { await saveConnection(storeData.platform, storeData); } catch(_) {}
      }
    }
    
    if (storeData) {
      setStore(storeData);
      setConnectionCache(storeData); // Sačuvaj u localStorage
      
      // Sačuvaj i u stari keš za kompatibilnost
      const cacheKey = getCacheKey(user.uid, 'store_connection');
      saveToCache(cacheKey, storeData);
      
      if (!silent) {
        console.log('✅ Connection loaded and cached:', storeData);
      }
    } else {
      // nema mock fallback-a – realno stanje: bez konekcije
      setStore(null);
    }
  };

  const connectStore = useCallback(async (storeData) => {
    const u = auth.currentUser;
    if (!u) return;
    const ref = doc(firestore, 'stores', u.uid);
    const data = { ...storeData, connectedAt: Date.now() };
    await setDoc(ref, data, { merge: true });
    try { await saveConnection(storeData.platform, data); } catch(_) {}
    setStore(data);
    
    // Sačuvaj u novi cache
    setConnectionCache(data);
    
    // Sačuvaj i u stari keš za kompatibilnost
    const cacheKey = getCacheKey(u.uid, 'store_connection');
    saveToCache(cacheKey, data);
  }, [auth, firestore]);

  const disconnectStore = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    const ref = doc(firestore, 'stores', u.uid);
    await deleteDoc(ref);
    setStore(null);
    
    // Obriši novi cache
    clearConnectionCache();
    
    // Obriši i stari keš
    const cacheKey = getCacheKey(u.uid, 'store_connection');
    clearCache(cacheKey);
  }, [auth, firestore]);

  const refreshConnection = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    
    setLoading(true);
    setConnectionError(null);
    
    try {
      await loadConnectionFromServer(u);
    } catch (e) {
      setConnectionError(e.message);
      console.error('Manual refresh failed:', e);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  const value = useMemo(() => ({
    store,
    isConnected: !!store,
    loading,
    connectionError,
    connectStore,
    disconnectStore,
    refreshConnection,
  }), [store, loading, connectionError, connectStore, disconnectStore, refreshConnection]);

  return (
    <StoreCtx.Provider value={value}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  return useContext(StoreCtx);
}



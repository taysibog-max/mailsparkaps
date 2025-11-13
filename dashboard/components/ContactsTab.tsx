import { useEffect, useMemo, useState } from 'react';
import { importContactsToFirestore, fetchAllContacts, ImportedContact } from '../firebase/contacts';
import { useStore } from '../context/StoreContext';
import { apiGet, apiPost } from '../lib/apiClient';
import { saveContactsToIndexedDB, loadContactsFromIndexedDB, getContactsCount } from '../lib/indexedDbAdapter';
import { loadFromCache, saveToCache, getCacheKey } from '../lib/cacheUtils';
import { useProgressBar } from './ProgressBar';
import { SkeletonTable, LoadingSpinner } from './LoadingSkeleton';
import { getFirebaseApp } from '../lib/firebaseClient';
import { 
  isContactsCacheValid,
  saveContactsToLocalStorage,
  loadContactsFromLocalStorage
} from '../lib/contactsCache';
import { optimizedApiPost, withTimeout } from '../lib/apiTimeout';

export default function ContactsTab(){
  const { isConnected, loading: storeLoading, store } = useStore() as any;
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [platform, setPlatform] = useState<'woocommerce'|'shopify'|null>(null);
  const [loadingSource, setLoadingSource] = useState<string>('');
  const [showAddContact, setShowAddContact] = useState<boolean>(false);
  const [newContactEmail, setNewContactEmail] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  // Uklonjeni dodatni sync meniji – ostaje jedno dugme "Import Contacts"
  const [showSyncOptions, setShowSyncOptions] = useState<boolean>(false);
  const progressBar = useProgressBar();

  // Helper: učitaj kontakte, fallback na server API (Admin SDK) ako je klijent offline
  const loadContactsSafe = async (): Promise<ImportedContact[]> => {
    // Server-first (Admin SDK), zatim klijentski Firestore kao fallback
    try {
      let resp;
      try {
        resp = await apiGet('/api/contacts');
      } catch (e: any) {
        // Ako je korisnik tek ulogovan i token nije spreman – pokušaj ponovno za 600ms
        if (e?.message && /unauthorized/i.test(e.message)) {
          await new Promise(r=>setTimeout(r, 600));
          resp = await apiGet('/api/contacts');
        } else {
          throw e;
        }
      }
      if (resp?.contacts) return resp.contacts as ImportedContact[];
    } catch (_) { /* fallback to client */ }
    try {
      return await fetchAllContacts();
    } catch (e: any) {
      // zadnja opcija – nema podataka (offline + bez servera)
      return [];
    }
  };

  // Zatvori dropdown kada se klikne van njega
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSyncOptions) {
        const target = event.target as Element;
        if (!target.closest('.sync-dropdown-container')) {
          setShowSyncOptions(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSyncOptions]);

  useEffect(()=>{ (async()=>{
    try { 
      setLoading(true); 
      setError(''); 
      progressBar.start();
      
      const { auth } = getFirebaseApp();
      const user = auth.currentUser;
      
      if (!user) {
        setLoading(false);
        progressBar.complete();
        return;
      }
      
      // 1. Prvo probaj učitati iz localStorage cache-a (najbrže)
      const platform = store?.platform || 'woocommerce';
      if (isContactsCacheValid(platform)) {
        console.log('✅ Loading contacts from localStorage cache...');
        const cachedContacts = loadContactsFromLocalStorage(platform);
        if (cachedContacts && cachedContacts.length > 0) {
          setContacts(cachedContacts);
          setLoadingSource('Učitano iz keša');
          progressBar.update(100);
          progressBar.complete();
          setLoading(false);
          
          // U pozadini asinhrono osvježi iz Firestore-a
          setTimeout(async () => {
            try {
              const freshList = await loadContactsSafe();
              if (freshList.length !== cachedContacts.length) {
                setContacts(freshList);
                saveContactsToLocalStorage(freshList, platform);
                await saveContactsToIndexedDB(user.uid, freshList);
              }
            } catch(e) {
              console.error('Background refresh failed:', e);
            }
          }, 500);
          return;
        }
      }
      
      // 2. Probaj IndexedDB kao fallback
      progressBar.update(20);
      setLoadingSource('Učitavam iz lokalne baze...');
      const cachedContacts = await loadContactsFromIndexedDB(user.uid);
      
      if (cachedContacts && cachedContacts.length > 0) {
        setContacts(cachedContacts);
        setLoadingSource('Učitano iz IndexedDB');
        progressBar.update(100);
        progressBar.complete();
        setLoading(false);
        
        // Sačuvaj u localStorage cache
        saveContactsToLocalStorage(cachedContacts, platform);
        
        // U pozadini asinhrono osvježi iz Firestore-a
        setTimeout(async () => {
          try {
            const freshList = await loadContactsSafe();
            if (freshList.length !== cachedContacts.length) {
              setContacts(freshList);
              saveContactsToLocalStorage(freshList, platform);
              await saveContactsToIndexedDB(user.uid, freshList);
            }
          } catch(e) {
            console.error('Background refresh failed (auth issue):', e.message);
            // Ako je auth problem, kontakti su već učitani iz cache-a
          }
        }, 500);
        return;
      }
      
      // 3. Ako nema u cache-u, učitaj iz Firestore-a
      progressBar.update(60);
      setLoadingSource('Učitavam sa servera...');
      try {
        const list = await loadContactsSafe();
        setContacts(list);
        console.log(`✅ Loaded ${list.length} contacts from Firestore`);
      } catch (authError) {
        console.warn('Auth error in main load, loading from cache:', authError.message);
        // Učitaj iz cache-a ako nema autentifikacije
        try {
          const cachedContacts = await loadContactsFromIndexedDB(user?.uid || 'anonymous');
          if (cachedContacts && cachedContacts.length > 0) {
            setContacts(cachedContacts);
            console.log(`✅ Loaded ${cachedContacts.length} contacts from cache`);
          } else {
            setContacts([]);
          }
        } catch (cacheError) {
          console.warn('Cache load also failed:', cacheError.message);
          setContacts([]);
        }
      }
      
      // 4. Sačuvaj u oba cache-a za sledeći put
      progressBar.update(90);
      if (contacts.length > 0) {
        saveContactsToLocalStorage(contacts, platform);
        await saveContactsToIndexedDB(user.uid, contacts);
      }
      
      progressBar.update(100);
      progressBar.complete();
      setLoadingSource('');
    }
    catch(e:any){ 
      // Suppress noisy Firestore offline errors for better UX; we already fall back to cache
      const msg = String(e?.message||'');
      const isOfflineNoise = /client\s+is\s+offline/i.test(msg) || /Failed to get document/i.test(msg);
      if (!isOfflineNoise) {
        setError(msg || 'Failed to load contacts');
      } else {
        setError('');
      }
      progressBar.reset();
    }
    finally{ setLoading(false); }
  })(); },[]);

  async function syncContacts(syncType: 'all' | 'new' = 'all'){
    // Allow sync if either the store context is connected OR we have detected a platform
    // (platform is derived from API status checks even if context didn't hydrate yet)
    if (!isConnected && !platform) { 
      setError('Please connect your store first in Integrations.'); 
      return; 
    }
    try {
      setSyncing(true); 
      setError('');
      setSyncProgress(0);
      setLoadingSource('Pokretanje sinhronizacije...');
      
      console.log(`🔄 Starting ${syncType} sync...`);
      
      // Platform-aware sync
      let emails: string[] = [];
      if (platform === 'shopify') {
        setSyncProgress(20);
        setLoadingSource('Dohvaćam kontakte iz Shopify...');
        const shpStatus = await apiGet('/api/integrations/shopify/status');
        if (!shpStatus?.store) {
          throw new Error('Shopify nije konektovan. Molimo konektujte Shopify u Integrations tab-u.');
        }
        const shpResp = await apiPost('/api/integrations/shopify/sync-contacts', {});
        emails = (shpResp?.emails || []).map((e: string) => e.toLowerCase());
        console.log('Shopify sync completed:', { count: emails.length });
      } else {
        // default WooCommerce
        setSyncProgress(25);
        setLoadingSource('Dohvaćam kontakte iz WooCommerce...');
        const wooStatus = await apiGet('/api/integrations/woo/status');
        if (!wooStatus?.store) {
          throw new Error('WooCommerce nije konektovan. Molimo konektujte WooCommerce u Integrations tab-u.');
        }
        const wooResponse = await apiPost('/api/integrations/woo/connect-and-sync', {
          storeUrl: wooStatus.store.shopUrl || wooStatus.store.url,
          consumer_key: wooStatus.store.consumerKey || wooStatus.store.key,
          consumer_secret: wooStatus.store.consumerSecret || wooStatus.store.secret,
          backupApi: process.env.NEXT_PUBLIC_BACKUP_API
        });
        emails = (wooResponse?.emails || []).map((e: string) => e.toLowerCase());
        console.log('WooCommerce sync completed:', { count: emails.length });
      }

      // Napredak: 25→55 tokom preuzimanja i transformacije
      setSyncProgress(55);
      setLoadingSource('Pripremam kontakte za čuvanje...');
      
      // Convert emails to contact objects
      const realContacts = (emails || []).map(email => ({
        email: email.toLowerCase(),
        firstName: '',
        lastName: '',
        source: platform || 'woocommerce',
        sourceStore: platform || 'woocommerce',
        createdAt: new Date().toISOString()
      }));
      
      // Import contacts to Firestore (chunked da UI ne "stane")
      const chunkSize = 200;
      let createdTotal = 0;
      let skippedTotal = 0;
      const total = realContacts.length || 1;
      setLoadingSource('Čuvam kontakte u bazu...');
      for (let i = 0; i < realContacts.length; i += chunkSize) {
        const part = realContacts.slice(i, i + chunkSize);
        const res = await importContactsToFirestore(part);
        createdTotal += res.created;
        skippedTotal += res.skipped;
        // mapiraj 55→85 tokom čuvanja
        const progress = 55 + Math.min(30, Math.round(((i + part.length) / total) * 30));
        setSyncProgress(progress);
      }
      const importResult = { created: createdTotal, skipped: skippedTotal, total: createdTotal + skippedTotal };
      console.log('📦 Import result:', importResult);
      
      setSyncProgress(90);
      setLoadingSource('Učitavam kontakte iz baze...');
      
      // Reload contacts from API (now reads RTDB first)
      const updatedContacts = await loadContactsSafe();
      setContacts(updatedContacts);
      
      // Save to cache
      const cachedPlatform = store?.platform || 'woocommerce';
      saveContactsToLocalStorage(updatedContacts, cachedPlatform);
      
      // Also save to IndexedDB
      const { auth } = getFirebaseApp();
      const user = auth.currentUser;
      if (user) {
        await saveContactsToIndexedDB(user.uid, updatedContacts);
      }
      
      setSyncProgress(100);
      setLoadingSource('Sinhronizacija završena!');
      
      // Show success message with real data
      const message = `Sinhronizacija završena – dodano ${importResult.created} novih kontakata, preskočeno ${importResult.skipped} duplikata.`;
      setError(message);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setError('');
        setSyncProgress(0);
        setLoadingSource('');
      }, 5000);
      
    } catch (e:any){ 
      console.error('Sync error:', e);
      setError(e?.message || 'Došlo je do greške tokom sinhronizacije — pokušaj ponovo'); 
      setSyncProgress(0);
      setLoadingSource('');
    }
    finally { 
      console.log('Sync finished, setting syncing to false');
      setSyncing(false); 
    }
  }

  // Funkcija za brisanje kontakta
  async function deleteContact(email: string) {
    if (!confirm(`Are you sure you want to delete ${email}?`)) {
      return;
    }

    try {
      setError('');
      progressBar.start();
      
      const { auth } = getFirebaseApp();
      const user = auth.currentUser;
      
      if (!user) {
        setError('You must be logged in to delete contacts');
        progressBar.reset();
        return;
      }

      progressBar.update(30);
      
      // Obriši iz baze (Firestore + Realtime Database)
      try {
        await apiPost('/api/contacts/delete', { email });
      } catch (err: any) {
        // Ako je token invalid, refreshuj i pokušaj ponovo
        if (err?.message?.includes('token') || err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
          console.log('Token invalid, refreshing and retrying...');
          await new Promise(r => setTimeout(r, 500));
          await apiPost('/api/contacts/delete', { email });
        } else {
          throw err;
        }
      }
      
      progressBar.update(70);
      
      // Ukloni iz lokalnog stanja
      setContacts(prev => prev.filter(c => c.email !== email));
      
      // Ažuriraj cache
      const platform = store?.platform || 'woocommerce';
      const updatedContacts = contacts.filter(c => c.email !== email);
      saveContactsToLocalStorage(updatedContacts, platform);
      
      if (user) {
        await saveContactsToIndexedDB(user.uid, updatedContacts);
      }
      
      progressBar.update(100);
      progressBar.complete();
      
      setError(`✅ Contact ${email} successfully deleted from database`);
      setTimeout(() => setError(''), 4000);
      
    } catch (e: any) {
      console.error('Delete contact error:', e);
      setError(e?.message || 'Failed to delete contact');
      progressBar.reset();
    }
  }

  // Funkcija za manuelno dodavanje kontakta
  async function addManualContact() {
    if (!newContactEmail.trim()) {
      setError('Molimo unesite email adresu');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContactEmail)) {
      setError('Molimo unesite ispravnu email adresu');
      return;
    }

    try {
      setSyncing(true);
      setError('');
      progressBar.start();
      progressBar.update(50);
      setSyncProgress(50);
      setLoadingSource('Dodajem kontakt...');

      const newContact: ImportedContact = {
        email: newContactEmail.trim(),
        source: 'woocommerce', // Koristi woocommerce kao source za manuelno dodane kontakte
        createdAt: new Date().toISOString()
      };

      await importContactsToFirestore([newContact]);
      
      progressBar.update(80);
      setSyncProgress(80);
      setLoadingSource('Učitavam kontakte iz baze...');
      
      const list = await loadContactsSafe();
      setContacts(list);
      
      // Sačuvaj u cache
      const platform = store?.platform || 'woocommerce';
      saveContactsToLocalStorage(list, platform);
      
      progressBar.update(100);
      setSyncProgress(100);
      setLoadingSource('');
      progressBar.complete();
      
      setNewContactEmail('');
      setShowAddContact(false);
      setError('✅ Kontakt je uspešno dodat!');
      setTimeout(() => setError(''), 3000);
      
    } catch (e: any) {
      setError(e?.message || 'Greška pri dodavanju kontakta');
      progressBar.reset();
      setSyncProgress(0);
      setLoadingSource('');
    } finally {
      setSyncing(false);
    }
  }

  // Determine connection platform once auth/kontekst je spreman (sa retry-jem jer token ponekad kasni)
  useEffect(()=>{ (async()=>{
    try {
      if (store?.platform) { setPlatform(store.platform); return; }
      const attempt = async () => {
        const ts = Date.now();
        const [woo, shp] = await Promise.all([
          apiGet(`/api/integrations/woo/status?ts=${ts}`).catch(()=>({})),
          apiGet(`/api/integrations/shopify/status?ts=${ts}`).catch(()=>({}))
        ]);
        if (woo?.store) { setPlatform('woocommerce'); return true; }
        if (shp?.store) { setPlatform('shopify'); return true; }
        return false;
      };
      let ok = await attempt();
      if (!ok) {
        // retry after 800ms up to 3 puta dok se user token ne inicijalizuje
        for (let i=0;i<3 && !ok;i++) {
          await new Promise(r=>setTimeout(r, 800));
          ok = await attempt();
        }
      }
      if (!ok) setPlatform(null);
    } catch { setPlatform(null); }
  })(); }, [store]);

  // Derived filtered and paginated contacts (must be declared before any early returns)
  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c => (c.email||'').toLowerCase().includes(q));
  }, [contacts, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContacts.slice(start, start + pageSize);
  }, [filteredContacts, currentPage, pageSize]);

  useEffect(() => { setPage(1); }, [searchQuery]);

  if (storeLoading && !store && platform === null) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-neutral-300">
          <LoadingSpinner size="sm" />
          Checking your store connection…
        </div>
        <SkeletonTable rows={5} />
        
        {/* Fallback dugme ako se dugo čeka */}
        <div className="text-center pt-4">
          <button 
            onClick={() => {
              console.log('Force stopping loading...');
              window.location.reload();
            }}
            className="text-xs text-neutral-400 hover:text-white underline"
          >
            Taking too long? Click here to reload
          </button>
        </div>
      </div>
    );
  }
  
  // Upozorenje samo ako zaista nema konekcije (ne i ako platforma još nije određena)
  if (!isConnected && !platform) return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-500/10 text-amber-300 p-4">
      Please connect your store first.
    </div>
  );

  const canSync = Boolean(isConnected || platform);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Contacts</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-neutral-400">Total:</span>
            <span className="font-semibold text-fuchsia-400 text-lg">{contacts.length}</span>
            {filteredContacts.length !== contacts.length && (
              <>
                <span className="text-neutral-600">•</span>
                <span className="text-neutral-400">Filtered:</span>
                <span className="font-semibold text-emerald-400">{filteredContacts.length}</span>
              </>
            )}
            {loadingSource && (
              <>
                <span className="text-neutral-600">•</span>
                <span className="text-xs text-neutral-500">{loadingSource}</span>
              </>
            )}
          </div>
        </div>
        <button 
          onClick={() => syncContacts('new')}
          disabled={syncing || !canSync}
          className="rounded-xl px-6 py-3 text-white bg-gradient-to-r from-pink-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40 hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
        >
          {syncing && <LoadingSpinner size="sm" />}
          {syncing ? 'Syncing…' : '↻ Sync Contacts'}
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={searchQuery}
          onChange={(e)=>setSearchQuery(e.target.value)}
          placeholder="Search by email address..."
          className="w-full pl-12 pr-4 py-3.5 bg-zinc-900/60 border border-zinc-700/60 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition"
        />
      </div>

      {/* Progress bar za sinhronizaciju */}
      {syncing && (
        <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-white font-medium">{loadingSource || 'Syncing...'}</span>
            <span className="text-fuchsia-400 font-bold">{Math.round(syncProgress)}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 h-full rounded-full transition-[width] duration-300 shadow-lg shadow-fuchsia-500/50"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
          <div className="text-xs text-neutral-400 mt-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving contacts to database...
          </div>
        </div>
      )}

      {/* Manuelno dodavanje kontakta */}
      {showAddContact && (
        <div className="mb-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-neutral-300 font-medium">Add New Contact</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              placeholder="Enter email address"
              className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:border-pink-500"
              disabled={syncing}
            />
            <button
              onClick={addManualContact}
              disabled={syncing || !newContactEmail.trim()}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:scale-[1.02] active:scale-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {syncing && <LoadingSpinner size="sm" />}
              Add
            </button>
            <button
              onClick={() => {
                setShowAddContact(false);
                setNewContactEmail('');
                setError('');
              }}
              className="px-3 py-2 bg-zinc-600 text-white rounded-lg hover:bg-zinc-500 transition"
              disabled={syncing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className={`text-sm mb-2 p-2 rounded-lg ${
          error.includes('✅') ? 'text-green-300 bg-green-500/10' :
          error.includes('već') ? 'text-blue-300 bg-blue-500/10' : 
          'text-rose-400 bg-rose-500/10'
        }`}>
          {error}
        </div>
      )}
      {loading ? (
        <div className="space-y-2">
          <SkeletonTable rows={contacts.length || 5} />
        </div>
      ) : (
        <div className="grid gap-3">
          {paginatedContacts.map(c=> (
            <div key={c.email} className="group relative rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/40 to-zinc-900/20 hover:border-fuchsia-500/30 hover:shadow-lg hover:shadow-fuchsia-500/5 transition-all duration-200 overflow-hidden">
              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative px-5 py-4 flex items-center justify-between gap-4">
                {/* Email Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-fuchsia-500/20">
                      {c.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{c.email}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {c.createdAt ? 
                          `Imported: ${new Date(c.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}` : 
                          'Import date unknown'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <span className="text-xs px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-neutral-300 font-medium">
                    {(c as any).sourceStore || c.source}
                  </span>
                  <button
                    onClick={() => deleteContact(c.email)}
                    className="opacity-0 group-hover:opacity-100 transition-all text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-2 rounded-lg"
                    title="Delete contact"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!contacts.length && (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-6 py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-neutral-400 font-medium mb-1">No contacts yet</div>
              <div className="text-sm text-neutral-600">Sync your first contacts from your store</div>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredContacts.length > 0 && (
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-800/60 flex-wrap">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-400">Show</span>
            <select
              value={pageSize}
              onChange={(e)=>{ setPageSize(parseInt(e.target.value||'25')); setPage(1); }}
              className="bg-zinc-900/60 border border-zinc-700/60 rounded-lg px-3 py-2 text-white focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-neutral-400">per page</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-400">
              Page <span className="text-white font-semibold">{currentPage}</span> of <span className="text-white font-semibold">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={()=>setPage(p=>Math.max(1, p-1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60 text-white hover:border-fuchsia-500/50 hover:bg-zinc-800 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-zinc-700/60 disabled:hover:bg-zinc-900/60 font-medium"
              >← Prev</button>
              <button
                onClick={()=>setPage(p=>Math.min(totalPages, p+1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60 text-white hover:border-fuchsia-500/50 hover:bg-zinc-800 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-zinc-700/60 disabled:hover:bg-zinc-900/60 font-medium"
              >Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



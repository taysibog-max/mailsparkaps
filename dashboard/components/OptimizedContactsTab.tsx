import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { apiPost } from '../lib/apiClient';
import { saveContactsToIndexedDB, loadContactsFromIndexedDB } from '../lib/indexedDbAdapter';
import { saveContactsToLocalStorage, loadContactsFromLocalStorage } from '../lib/contactsCache';
import { LoadingSpinner } from './LoadingSkeleton';

interface Contact {
  email: string;
  firstName?: string;
  lastName?: string;
  source: string;
  createdAt?: string;
  importedAt?: string;
}

interface SyncResult {
  added: number;
  skipped: number;
  total: number;
  existing: number;
  new: number;
}

export default function OptimizedContactsTab() {
  const { isConnected, loading: storeLoading, store } = useStore() as any;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [platform, setPlatform] = useState<'woocommerce'|'shopify'|null>(null);
  
  // Progress tracking
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncStats, setSyncStats] = useState<SyncResult | null>(null);

  // Load contacts on component mount
  useEffect(() => {
    loadContacts();
  }, []);

  // Determine platform
  useEffect(() => {
    if (store?.platform) {
      setPlatform(store.platform);
    }
  }, [store]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Try to load from IndexedDB cache first (instant)
      const cachedContacts = await loadContactsFromIndexedDB('dev-user-123');
      if (cachedContacts && cachedContacts.length > 0) {
        setContacts(cachedContacts);
        console.log(`✅ Loaded ${cachedContacts.length} contacts from cache`);
        
        // Background refresh from server
        setTimeout(() => refreshContactsFromServer(), 100);
        return;
      }

      // 2. If no cache, load from server
      await refreshContactsFromServer();
      
    } catch (e: any) {
      console.error('Load contacts error:', e);
      setError('Greška pri učitavanju kontakata');
    } finally {
      setLoading(false);
    }
  };

  const refreshContactsFromServer = async () => {
    try {
      // Mock API call - replace with actual endpoint
      const mockContacts: Contact[] = [
        {
          email: 'alminru@gmail.com',
          firstName: 'Almin',
          lastName: 'Ru',
          source: 'woocommerce',
          createdAt: new Date().toISOString(),
          importedAt: new Date().toISOString()
        }
      ];
      
      setContacts(mockContacts);
      
      // Save to cache
      saveContactsToLocalStorage(mockContacts, platform || 'woocommerce');
      await saveContactsToIndexedDB('dev-user-123', mockContacts);
      
    } catch (e: any) {
      console.error('Refresh contacts error:', e);
    }
  };

  const syncContacts = async (syncType: 'all' | 'new' = 'all') => {
    try {
      setSyncing(true);
      setError('');
      setSuccess('');
      setSyncProgress(0);
      setSyncStatus('Pokretanje sinhronizacije...');
      setSyncStats(null);

      console.log(`🔄 Starting ${syncType} sync...`);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);

      // Call the new sync API
      const result = await apiPost('/api/syncContacts', {
        platform: platform || 'woocommerce',
        batchSize: 50
      }) as SyncResult;

      clearInterval(progressInterval);
      setSyncProgress(100);
      setSyncStatus('Sinhronizacija završena!');

      // Update sync stats
      setSyncStats(result);

      // Show success message
      const message = `✅ Sinhronizacija završena – dodano ${result.added} novih kontakata, preskočeno ${result.skipped} duplikata.`;
      setSuccess(message);

      // Refresh contacts list
      await loadContacts();

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess('');
        setSyncStats(null);
        setSyncProgress(0);
        setSyncStatus('');
      }, 5000);

      console.log('🎉 Sync completed:', result);

    } catch (e: any) {
      console.error('Sync error:', e);
      setError('Došlo je do greške tokom sinhronizacije — pokušaj ponovo');
      setSyncProgress(0);
      setSyncStatus('');
    } finally {
      setSyncing(false);
    }
  };

  const deleteContact = async (email: string) => {
    try {
      setError('');
      
      // Remove from local state
      setContacts(prev => prev.filter(c => c.email !== email));
      
      // Update cache
      const updatedContacts = contacts.filter(c => c.email !== email);
      saveContactsToLocalStorage(updatedContacts, platform || 'woocommerce');
      await saveContactsToIndexedDB('dev-user-123', updatedContacts);
      
      setSuccess(`✅ Kontakt ${email} je uspešno obrisan`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (e: any) {
      console.error('Delete contact error:', e);
      setError(e?.message || 'Greška pri brisanju kontakta');
    }
  };

  const addManualContact = async (email: string) => {
    try {
      setError('');
      
      const newContact: Contact = {
        email: email.toLowerCase(),
        source: 'manual',
        createdAt: new Date().toISOString()
      };
      
      // Add to local state
      setContacts(prev => [...prev, newContact]);
      
      // Update cache
      const updatedContacts = [...contacts, newContact];
      saveContactsToLocalStorage(updatedContacts, platform || 'woocommerce');
      await saveContactsToIndexedDB('dev-user-123', updatedContacts);
      
      setSuccess('✅ Kontakt je uspešno dodat!');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (e: any) {
      console.error('Add contact error:', e);
      setError(e?.message || 'Greška pri dodavanju kontakta');
    }
  };

  if (!isConnected && !platform) {
    return (
      <div className="rounded-xl border border-amber-700/40 bg-amber-500/10 text-amber-300 p-4">
        Please connect your store first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-neutral-300 flex items-center gap-2">
          You have <span className="font-semibold text-fuchsia-300">{contacts.length}</span> contacts
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => syncContacts('new')}
            disabled={syncing} 
            className="rounded-lg px-4 py-2 text-white bg-gradient-to-r from-pink-500 to-fuchsia-600 shadow hover:scale-[1.02] active:scale-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {syncing && <LoadingSpinner size="sm" />}
            {syncing ? 'Sinhronizujem...' : 'Sync Contacts'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <AnimatePresence>
        {syncing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-zinc-800/50 rounded-lg p-4"
          >
            <div className="flex items-center justify-between text-sm text-neutral-300 mb-2">
              <span>{syncStatus}</span>
              <span>{Math.round(syncProgress)}%</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-3">
              <motion.div 
                className="bg-gradient-to-r from-pink-500 to-fuchsia-600 h-3 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${syncProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync Stats */}
      <AnimatePresence>
        {syncStats && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-700/50"
          >
            <div className="text-sm text-neutral-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-green-400 font-semibold">Dodano:</span> {syncStats.added}
                </div>
                <div>
                  <span className="text-yellow-400 font-semibold">Preskočeno:</span> {syncStats.skipped}
                </div>
                <div>
                  <span className="text-blue-400 font-semibold">Ukupno:</span> {syncStats.total}
                </div>
                <div>
                  <span className="text-purple-400 font-semibold">Postojeći:</span> {syncStats.existing}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg border border-green-700/40 bg-green-500/10 text-green-300 p-3"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg border border-red-700/40 bg-red-500/10 text-red-300 p-3"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contacts List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 divide-y divide-white/5">
          {contacts.map(contact => (
            <div key={contact.email} className="px-4 py-3 text-neutral-200 flex items-center justify-between hover:bg-white/5 transition group">
              <div className="flex-1">
                <div className="font-medium">{contact.email}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {contact.createdAt ? 
                    `Dodano: ${new Date(contact.createdAt).toLocaleDateString('sr-RS', {
                      year: 'numeric',
                      month: '2-digit', 
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}` : 
                    'Datum nije poznat'
                  }
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-md bg-zinc-800/50 text-neutral-400">
                  {contact.source}
                </span>
                <button
                  onClick={() => deleteContact(contact.email)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 p-1"
                  title="Obriši kontakt"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {contacts.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="text-neutral-500">No contacts yet.</div>
              <div className="text-xs text-neutral-600 mt-1">Sync your first contacts from your store</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

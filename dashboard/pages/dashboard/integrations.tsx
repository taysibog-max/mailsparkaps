// @ts-nocheck
import AppShell from '../../components/AppShell';
import RequireAuth from '../../components/RequireAuth';
import { useState, useEffect } from 'react';
import { apiPost, apiGet } from '../../lib/apiClient';
import { useStore } from '../../context/StoreContext';
import { HelpCircle } from 'lucide-react';
import { getFirebaseApp } from '../../lib/firebaseClient';
import { ref, get } from 'firebase/database';
import { loadFromCache, saveToCache, getCacheKey, clearCache } from '../../lib/cacheUtils';
import { LoadingSpinner } from '../../components/LoadingSkeleton';
import { useProgressBar } from '../../components/ProgressBar';
import { motion } from 'framer-motion';
import Modal from '../../components/Modal';
import { saveContactsToIndexedDB } from '../../lib/indexedDbAdapter';
import { saveContactsToLocalStorage } from '../../lib/contactsCache';
export default function IntegrationsPage(){
  return (
    <RequireAuth>
      <AppShell>
        <div className="grid gap-6 md:grid-cols-1">
          <WooCard />
          <PixelPlaceholderCard />
        </div>
      </AppShell>
    </RequireAuth>
  );
}

function PingDot({ color='green' }){
  const c = color === 'red' ? 'bg-rose-500' : 'bg-emerald-400';
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full rounded-full ${c} opacity-75 animate-ping`}></span>
      <span className={`relative inline-flex rounded-full h-2 w-2 ${c}`}></span>
    </span>
  );
}

function StatusPill({ connected, lastSyncAt }){
  const base = 'text-xs px-2 py-1 rounded-md border inline-flex items-center gap-2';
  if (!connected) return (
    <span className={`${base} border-rose-700/40 bg-rose-500/10 text-rose-300`}>
      <PingDot color="red" /> Not Connected
    </span>
  );
  const t = lastSyncAt ? new Date(lastSyncAt).toLocaleString() : '';
  return (
    <span className={`${base} border-emerald-700/40 bg-emerald-500/10 text-emerald-300`}>
      <PingDot color="green" /> Connected {t && `• ${t}`}
    </span>
  );
}

function WooIcon(){
  return <img src="/icons/woo.svg" alt="WooCommerce" className="h-8 w-8 object-contain" />;
}

function WooCard(){
  const { connectStore, disconnectStore } = useStore();
  const [form, setForm] = useState({ shopUrl:'', key:'', secret:'' });
  const [status, setStatus] = useState({ connected:false, lastSyncAt:null, contactsCount: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pixelCopied, setPixelCopied] = useState(false);
  const [userUid, setUserUid] = useState('');
  const [pixelToken, setPixelToken] = useState('');
  const [setupMsg, setSetupMsg] = useState('');
  const [emails, setEmails] = useState([]);
  const [showGuide, setShowGuide] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const progressBar = useProgressBar();
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  // load existing connection (on mount) - sa optimizovanim kešom
  useEffect(()=>{ let unsub;
    (async()=>{
      const { db, auth } = getFirebaseApp();
      const ensure = async (u)=>{
        if (!u) return;
        try { setUserUid(u.uid || ''); } catch(_) {}
        setInitialLoading(true);
        // Preuzmi pixel token (JWT) za ovog korisnika
        try {
          const idt = await auth.currentUser?.getIdToken?.(true);
          if (idt) {
            const r = await fetch('/api/auth/pixel-token', { headers: { Authorization: `Bearer ${idt}` } });
            const d = await r.json().catch(()=> ({}));
            if (d?.token) setPixelToken(d.token);
          }
        } catch (_) {}
        
        // STEP 1: Provjeri optimizovani keš (24h TTL)
        const cacheKey = getCacheKey(u.uid, 'woo');
        const cachedData = loadFromCache(cacheKey);
        
        if (cachedData) {
          setStatus({ connected:true, lastSyncAt: cachedData.lastSynced||null, contactsCount: cachedData.contactsCount||0 });
          setForm({ shopUrl:cachedData.shopUrl||'', key:cachedData.key||'', secret:cachedData.secret||'' });
          setInitialLoading(false);
          
          // U pozadini osvježi sa servera (ne blokiraj UI)
          setTimeout(async () => {
            try {
              const s = await apiGet('/api/integrations/woo/status');
              if (s?.store) {
                const freshData = {
                  shopUrl: s.store.shopUrl||'',
                  key: s.store.consumerKey||s.store.key||'',
                  secret: s.store.consumerSecret||s.store.secret||'',
                  lastSynced: s.store.lastSynced||s.store.connectedAt||null,
                  contactsCount: s.store.contactsCount||0
                };
                setStatus({ connected:true, lastSyncAt: freshData.lastSynced, contactsCount: freshData.contactsCount });
                setForm({ shopUrl:freshData.shopUrl, key:freshData.key, secret:freshData.secret });
                saveToCache(cacheKey, freshData);
              }
            } catch(e) {
              console.error('Background WooCommerce refresh failed:', e);
            }
          }, 100);
          return;
        }
        
        // STEP 2: Učitaj paralelno sa više izvora
        const [apiStatus, dbSnapshot] = await Promise.all([
          apiGet('/api/integrations/woo/status').catch(() => null),
          get(ref(db, `users/${u.uid}/integrations/woocommerce`)).catch(() => null)
        ]);
        
        let storeData = null;
        
        // Prioritet: API > Realtime DB
        if (apiStatus?.store) {
          storeData = {
            shopUrl: apiStatus.store.shopUrl||'',
            key: apiStatus.store.consumerKey||apiStatus.store.key||'',
            secret: apiStatus.store.consumerSecret||apiStatus.store.secret||'',
            lastSynced: apiStatus.store.lastSynced||apiStatus.store.connectedAt||null,
            contactsCount: apiStatus.store.contactsCount||0
          };
        } else if (dbSnapshot?.exists()) {
          const v = dbSnapshot.val();
          storeData = {
            shopUrl: v.shopUrl||'',
            key: v.consumerKey||v.key||'',
            secret: v.consumerSecret||v.secret||'',
            lastSynced: v.lastSynced||v.connectedAt||null,
            contactsCount: v.contactsCount||0
          };
        }
        
        if (storeData) {
          setStatus({ connected:true, lastSyncAt: storeData.lastSynced, contactsCount: storeData.contactsCount });
          setForm({ shopUrl:storeData.shopUrl, key:storeData.key, secret:storeData.secret });
          saveToCache(cacheKey, storeData);
        }
        
        setInitialLoading(false);
      };
      
      try {
        if (auth.currentUser) { await ensure(auth.currentUser); }
        else { unsub = auth.onAuthStateChanged(ensure); }
      } catch(_) {
        setInitialLoading(false);
      }
    })();
    return ()=>{ if (typeof unsub === 'function') unsub(); };
  }, []);
  async function onSubmit(e){
    e.preventDefault(); 
    setBusy(true); 
    setErr(''); 
    setEmails([]);
    progressBar.start();
    
    try{
      progressBar.update(20);
      const norm = (s)=> s.trim().match(/^https?:\/\//i) ? s.trim() : 'https://' + s.trim();
      const payload = { storeUrl: norm(form.shopUrl), consumer_key: form.key, consumer_secret: form.secret, backupApi: process.env.NEXT_PUBLIC_BACKUP_API };
      
      progressBar.update(50);
      const r = await apiPost('/api/integrations/woo/connect-and-sync', payload);
      
      progressBar.update(80);
      setStatus({ connected: true, lastSynced: Date.now(), contactsCount: r.total||0 });
      setEmails(r.emails || []);
      
      try { await connectStore({ platform: 'woocommerce', shopUrl: norm(form.shopUrl) }); } catch(_) {}
      
      // Sačuvaj u optimizovani keš (24h TTL)
      try { 
        const { auth } = getFirebaseApp(); 
        const u = auth.currentUser; 
        if (u) {
          const cacheKey = getCacheKey(u.uid, 'woo');
          const cache = { 
            shopUrl: norm(form.shopUrl), 
            key: form.key, 
            secret: form.secret, 
            lastSynced: Date.now(), 
            contactsCount: r.total||0 
          }; 
          saveToCache(cacheKey, cache);
        }
      } catch(_) {}
      
      progressBar.update(100);
      progressBar.complete();
    }catch(e){ 
      setErr(e.message||'Failed to connect'); 
      progressBar.reset();
    }
    finally{ setBusy(false); }
  }

  async function disconnect(){
    setConfirmOpen(false); // Zatvori popup
    setBusy(true);
    progressBar.start();
    setErr('');
    
    try {
      // Aesthetic delay + progress
      progressBar.update(20);
      await new Promise(r => setTimeout(r, 300));
      
      progressBar.update(40);
      await apiPost('/api/integrations/woo/disconnect', {});
      
      progressBar.update(70);
      await new Promise(r => setTimeout(r, 400));
      
      // Očisti lokalni keš
      try {
        const { auth } = getFirebaseApp();
        const u = auth.currentUser;
        if (u) {
          const cacheKey = getCacheKey(u.uid, 'woo');
          clearCache(cacheKey);
        }
      } catch(_) {}
      
      progressBar.update(90);
      try { await disconnectStore(); } catch(_) {}
      
      // Optimistic UI reset
      setStatus({ connected:false, lastSyncAt:null, contactsCount:0 });
      setEmails([]);
      setForm({ shopUrl:'', key:'', secret:'' });
      
      progressBar.update(100);
      progressBar.complete();
    } catch(e){
      setErr(e.message||'Failed');
      progressBar.reset();
    } finally {
      setBusy(false);
    }
  }

  async function syncNow(){
    setBusy(true); 
    setErr(''); 
    setEmails([]);
    progressBar.start();
    
    try{ 
      progressBar.update(30);
      const r = await apiPost('/api/integrations/woo/connect-and-sync', { storeUrl: form.shopUrl, consumer_key: form.key, consumer_secret: form.secret, backupApi: process.env.NEXT_PUBLIC_BACKUP_API }); 
      
      progressBar.update(70);
      setStatus({ connected: true, lastSynced: Date.now(), contactsCount: r.total||0 }); 
      setEmails(r.emails||[]); 
      
      // Ažuriraj keš
      try { 
        const { auth } = getFirebaseApp(); 
        const u = auth.currentUser; 
        if (u) {
          const cacheKey = getCacheKey(u.uid, 'woo');
          const cache = { 
            shopUrl: form.shopUrl, 
            key: form.key, 
            secret: form.secret, 
            lastSynced: Date.now(), 
            contactsCount: r.total||0 
          }; 
          saveToCache(cacheKey, cache);
        }
      } catch(_) {}
      
      progressBar.update(100);
      progressBar.complete();
    } catch(e){ 
      setErr(e.message||'Sync failed'); 
      progressBar.reset();
    } finally { 
      setBusy(false); 
    }
  }
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-zinc-950/60 shadow-[0_10px_30px_rgba(0,0,0,0.25)] p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <WooIcon />
          <div className="text-lg font-semibold">WooCommerce</div>
          {initialLoading && <LoadingSpinner size="sm" />}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={()=>setShowGuide(s=>!s)} className="p-1.5 rounded-md border border-white/10 hover:bg-white/5" title="How to connect">
            <HelpCircle className="h-4 w-4 text-neutral-300" />
          </button>
          {!initialLoading && <StatusPill {...status} />}
        </div>
      </div>
      {showGuide && (
        <div className="mb-4 text-sm text-neutral-300 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="font-semibold mb-1">How to connect WooCommerce</div>
          <ol className="list-decimal list-inside space-y-1 text-neutral-300">
            <li>Open your WordPress Admin → WooCommerce → Settings → Advanced → REST API.</li>
            <li>Create API key (Read permission is enough for importing orders).</li>
            <li>Copy your Site URL, Consumer Key and Consumer Secret here, then Connect.</li>
          </ol>
        </div>
      )}
      <form onSubmit={onSubmit} className="grid gap-3">
        <input className="h-10 rounded-lg bg-zinc-900/70 border border-zinc-700/60 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/30 text-white placeholder:text-zinc-400 px-3 transition" placeholder="Shop URL (https://store.com)" value={form.shopUrl} onChange={e=>setForm({...form, shopUrl:e.target.value})} />
        <input className="h-10 rounded-lg bg-zinc-900/70 border border-zinc-700/60 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/30 text-white placeholder:text-zinc-400 px-3 transition" placeholder="Consumer Key" value={form.key} onChange={e=>setForm({...form, key:e.target.value})} />
        <input className="h-10 rounded-lg bg-zinc-900/70 border border-zinc-700/60 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/30 text-white placeholder:text-zinc-400 px-3 transition" placeholder="Consumer Secret" value={form.secret} onChange={e=>setForm({...form, secret:e.target.value})} />
        {!status.connected && (
          <button className="w-max rounded-lg px-4 py-2 text-white bg-gradient-to-r from-pink-500 to-fuchsia-600 shadow hover:scale-[1.02] active:scale-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" disabled={busy}>
            {busy && <LoadingSpinner size="sm" />}
            {busy?'Connecting…':'Connect Store'}
          </button>
        )}
        {status.connected && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={syncNow} disabled={busy} className="w-max text-xs rounded-md px-2 py-1 border border-white/10 hover:bg-white/5 transition disabled:opacity-50 flex items-center gap-1">
              {busy && <LoadingSpinner size="sm" />}
              Sync Contacts
            </button>
            <button type="button" onClick={()=>setConfirmOpen(true)} disabled={busy} className="w-max text-xs rounded-md px-2 py-1 border border-rose-700/40 text-rose-300 hover:bg-rose-500/10 transition disabled:opacity-50">Disconnect</button>
            <a href="/api/plugins/woo" className="w-max text-xs rounded-md px-2 py-1 border border-emerald-700/40 text-emerald-300 hover:bg-emerald-500/10 transition disabled:opacity-50" title="Download Woo Abandoned Cart Plugin">Download Plugin</a>
          </div>
        )}
        <div className="text-xs text-neutral-400">Last synced: {status.lastSynced || status.lastSyncAt ? new Date(status.lastSynced||status.lastSyncAt).toLocaleString() : '—'} • Imported: {status.contactsCount||emails.length||0}</div>
        {err && (
          <div className="text-xs text-rose-400">
            {err} {form.shopUrl && (<>
              · Try opening <a target="_blank" rel="noreferrer" className="underline" href={`${form.shopUrl.replace(/\/$/,'')}/wp-json`}>/wp-json</a>
            </>)}
          </div>
        )}
      </form>
      {!!emails.length && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4"
        >
          <div className="text-sm font-semibold mb-2">Imported Emails ({emails.length})</div>
          <div className="max-h-48 overflow-auto rounded-lg border border-white/10">
            {emails.map(e => (
              <div key={e} className="px-3 py-2 border-b border-white/5 text-sm text-neutral-200 hover:bg-white/5 transition">{e}</div>
            ))}
          </div>
        </motion.div>
      )}
      <Modal open={confirmOpen} onClose={()=>setConfirmOpen(false)} title="Disconnect WooCommerce?">
        <div className="text-sm text-neutral-300 space-y-3">
          <p>Are you sure you want to disconnect your WooCommerce store?</p>
          <p className="text-rose-300">This will permanently delete the store connection and all imported contacts from your account.</p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={()=>setConfirmOpen(false)} className="px-3 py-1 rounded bg-zinc-800 border border-white/10">Cancel</button>
            <button onClick={disconnect} className="px-3 py-1 rounded bg-gradient-to-r from-rose-500 to-pink-600 text-white">Yes, disconnect</button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

function PixelPlaceholderCard(){
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-zinc-950/60 shadow-[0_10px_30px_rgba(0,0,0,0.25)] p-6"
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="text-lg font-semibold text-white">Coming soon: MailSpark Pixel</div>
          <p className="text-sm text-neutral-400">
            First-party tracking installs here next. Stay tuned!
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-amber-300">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping opacity-75" />
          <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
          Beta prep
        </div>
      </div>
      <div className="space-y-3 text-sm text-neutral-300">
        <p>
          We&apos;re bringing the MailSpark Pixel to capture browse events, on-site funnels, and
          server-to-server conversions.
        </p>
        <p className="text-neutral-400">
          Developers will drop a tiny script into <code>public/pixel.js</code>, then activate this
          API route once specs are finalized.
        </p>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
          Integration docs and install wizard will land in this card when the pixel ships.
        </div>
      </div>
    </motion.div>
  );
}


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
        <div className="grid gap-6 md:grid-cols-2">
          <WooCard />
          <ShopifyCard />
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

function ShopifyIcon(){
  return <img src="/icons/shopify.svg" alt="Shopify" className="h-7 w-7 object-contain" />;
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

function ShopifyCard(){
  const { connectStore } = useStore();
  const [shop, setShop] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [status, setStatus] = useState({ connected:false, lastSyncAt:null });
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const progressBar = useProgressBar();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showToken, setShowToken] = useState(true);
  const [err, setErr] = useState('');
  const [pixelCopied, setPixelCopied] = useState(false);
  const [userUid, setUserUid] = useState('');
  const [pixelToken, setPixelToken] = useState('');
  const [setupMsg, setSetupMsg] = useState('');
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectingMode, setSelectingMode] = useState(false);
  
  useEffect(()=>{ let unsub;
    (async()=>{
      const { db, auth } = getFirebaseApp();
      const ensure = async (u)=>{
        if (!u) return;
        try { setUserUid(u.uid || ''); } catch(_) {}
        setInitialLoading(true);
        // Allow forcing the mode chooser via URL param ?forceMode=1
        try {
          if (typeof window !== 'undefined') {
            const usp = new URLSearchParams(window.location.search || '');
            if (usp.get('forceMode') === '1') {
              setShowModeModal(true);
            }
          }
        } catch(_) {}
        // Fetch pixel token (signed) for this user
        try {
          const idt = await auth.currentUser?.getIdToken?.(true);
          if (idt) {
            const r = await fetch('/api/auth/pixel-token', { headers: { Authorization: `Bearer ${idt}` } });
            const d = await r.json().catch(()=> ({}));
            if (d?.token) setPixelToken(d.token);
          }
        } catch(_) {}
        
        // STEP 1: Provjeri optimizovani keš (24h TTL)
        const cacheKey = getCacheKey(u.uid, 'shopify');
        const cachedData = loadFromCache(cacheKey);
        
        if (cachedData) {
          setStatus({ connected: true, lastSyncAt: cachedData.lastSynced||null });
          setShop(cachedData.shop||'');
          if (cachedData.accessToken) setAccessToken(cachedData.accessToken);
          setInitialLoading(false);
          
          // U pozadini osvježi
          setTimeout(async () => {
            try {
              const s = await apiGet('/api/integrations/shopify/status');
              if (s?.store) {
                const freshData = {
                  shop: s.store.shop || '',
                  lastSynced: s.store.lastSynced || s.store.lastSyncAt || s.store.connectedAt || null
                };
                setStatus({ connected:true, lastSyncAt: freshData.lastSynced });
                setShop(freshData.shop);
                saveToCache(cacheKey, freshData);
              }
            } catch(e) {
              console.error('Background Shopify refresh failed:', e);
            }
          }, 100);

          // Ako je integracija povezana, a modal za izbor moda nije postavljen, prikaži ga i u cache grani
          try {
            const modeSnap = await get(ref(db, `users/${u.uid}/integrations/shopify/mode`)).catch(()=>null);
            const mv = modeSnap && modeSnap.exists() ? String(modeSnap.val()||'').toUpperCase() : '';
            if (!modeSnap || !modeSnap.exists() || (mv !== 'FAST' && mv !== 'SILENT')) {
              setShowModeModal(true);
            }
          } catch(_) {}
          return;
        }
        
        // STEP 2: Učitaj paralelno
        const [apiStatus, dbSnapshot, mirrorSnapshot] = await Promise.all([
          apiGet('/api/integrations/shopify/status').catch(() => null),
          get(ref(db, `users/${u.uid}/integrations/shopify`)).catch(() => null),
          get(ref(db, `stores/${u.uid}_shopify`)).catch(() => null)
        ]);
        
        let storeData = null;
        
        if (apiStatus?.store) {
          storeData = {
            shop: apiStatus.store.shop || '',
            lastSynced: apiStatus.store.lastSynced || apiStatus.store.lastSyncAt || apiStatus.store.connectedAt || null,
            accessToken: apiStatus.store.accessToken || ''
          };
        } else if (dbSnapshot?.exists()) {
          const v = dbSnapshot.val();
          storeData = {
            shop: v.shop || '',
            lastSynced: v.lastSynced || v.connectedAt || null,
            accessToken: v.accessToken || ''
          };
        } else if (mirrorSnapshot?.exists()) {
          const mv = mirrorSnapshot.val();
          storeData = {
            shop: mv.shop || '',
            lastSynced: mv.updatedAt || null,
            accessToken: mv.accessToken || ''
          };
        }
        
        if (storeData) {
          setStatus({ connected:true, lastSyncAt: storeData.lastSynced });
          setShop(storeData.shop);
          if (storeData.accessToken) setAccessToken(storeData.accessToken);
          saveToCache(cacheKey, storeData);
          // Prompt for mode if not already set
          try {
            const modeSnap = await get(ref(db, `users/${u.uid}/integrations/shopify/mode`)).catch(()=>null);
            const mv = modeSnap && modeSnap.exists() ? String(modeSnap.val()||'').toUpperCase() : '';
            if (!modeSnap || !modeSnap.exists() || (mv !== 'FAST' && mv !== 'SILENT')) {
              setShowModeModal(true);
            }
          } catch(_) {}
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
  
  const isValidShop = (s)=>/^[a-z0-9-]+\.myshopify\.com$/i.test(String(s).trim());
  const canConnect = isValidShop(shop) && accessToken.trim().length > 20; // basic length guard

  function buildPixelCode(currentToken){
    const token = currentToken || 'YOUR_PIXEL_TOKEN';
    // Bake absolute API URL into the pixel code (must not rely on Shopify domain)
    const base = (typeof window !== 'undefined' ? window.location.origin : '');
    const endpoint = `${base}/api/pixel`;
    return `// MailSpark Pixel
const TRACK_URL='${endpoint}';
const JWT='${token}';
const LAST={token:null,email:null};
function post(type,payload){try{fetch(TRACK_URL,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','Authorization':'Bearer '+JWT},body:JSON.stringify({type,...payload})});}catch(e){}}
analytics.subscribe('checkout_contact_information_submitted',(event)=>{const ch=event?.data?.checkout||{};const em=ch?.email||ch?.contactEmail||null;const t=ch?.token||ch?.id||null;LAST.token=t||LAST.token;LAST.email=em||LAST.email;post('contact_info',{checkoutToken:t,email:em,currency:ch?.currencyCode,lineItems:(ch?.lineItems||[]).map(i=>({id:i?.product?.id,variantId:i?.variant?.id,title:i?.title,quantity:i?.quantity,price:i?.price?.amount}))});});
// Fallback: ponekad email dobijemo tek na shipping koraku
analytics.subscribe('checkout_shipping_info_submitted',(event)=>{const ch=event?.data?.checkout||{};const em=ch?.email||ch?.contactEmail||null;const t=ch?.token||ch?.id||null;if(em){LAST.token=t||LAST.token;LAST.email=em||LAST.email;post('contact_info',{checkoutToken:t,email:em});}});
analytics.subscribe('checkout_completed',(event)=>{const ch=event?.data?.checkout||{};post('completed',{checkoutToken:ch?.token||ch?.id||null,orderId:event?.data?.order?.id||null});});
// Označi kao napušteno SAMO kada korisnik stvarno napušta stranicu (unload/pagehide).
const sendAbandoned=()=>{try{if(!(LAST.email||LAST.token))return;const payload=JSON.stringify({type:'abandoned',checkoutToken:LAST.token||null,email:LAST.email||null});if(navigator.sendBeacon){try{const blob=new Blob([payload],{type:'application/json'});navigator.sendBeacon(TRACK_URL,blob);}catch(_){}}else{post('abandoned',{checkoutToken:LAST.token||null,email:LAST.email||null});}}catch(_){}}; 
// Pravo napuštanje/close + navigacija (Safari/SPA)
window.addEventListener('beforeunload',sendAbandoned);
// Ako korisnik ode u drugi tab i ostane skriven ≥10s, tretiraj kao napušteno
let __HIDDEN_TIMER=null;
document.addEventListener('visibilitychange',()=>{try{if(document.hidden){__HIDDEN_TIMER=setTimeout(()=>{if(document.hidden)sendAbandoned();},10000);}else if(__HIDDEN_TIMER){clearTimeout(__HIDDEN_TIMER);__HIDDEN_TIMER=null;}}catch(_){}})
window.addEventListener('pagehide',sendAbandoned);`;
  }

  async function selectMode(mode){
    try {
      setSelectingMode(true);
      const { auth } = getFirebaseApp();
      const idt = await auth.currentUser?.getIdToken?.(true);
      if (!idt) throw new Error('Not authenticated');
      const r = await fetch('/api/integrations/shopify/set-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idt}` },
        body: JSON.stringify({ mode })
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.error || 'Failed to save mode');
      setShowModeModal(false);
    } catch (e) {
      setErr(e?.message || 'Failed to set mode');
    } finally {
      setSelectingMode(false);
    }
  }

  function copyPixel(){
    const code = buildPixelCode(pixelToken);
    navigator.clipboard.writeText(code).then(()=>{ setPixelCopied(true); setTimeout(()=>setPixelCopied(false), 1500); }).catch(()=>{});
  }

  function openShopifyNotifications(){
    try {
      const domain = String(shop || '').trim();
      if (!domain) return;
      const url = `https://${domain}/admin/settings/notifications`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch(_) {}
  }

  async function runManualTest(){
    try {
      setSetupMsg('Sending test...');
      const r = await fetch('/api/cron/check-abandoned-carts?manual=true');
      const d = await r.json().catch(()=> ({}));
      if (r.ok) setSetupMsg('Test triggered. Check inbox shortly.');
      else setSetupMsg(`Test failed: ${d?.error||d?.message||'Unknown'}`);
      setTimeout(()=> setSetupMsg(''), 4000);
    } catch(e){
      setSetupMsg('Test failed.');
      setTimeout(()=> setSetupMsg(''), 3000);
    }
  }

  async function connect(){
    setBusy(true);
    progressBar.start();
    
    try{
      setErr('');
      progressBar.update(50);
      if (!canConnect) throw new Error('Provide valid shop domain and Admin API access token');
      const r = await apiPost('/api/integrations/shopify/connect', { shop, accessToken });
      const ls = r?.store?.lastSynced || r?.store?.lastSyncAt || Date.now();
      
      progressBar.update(80);
      setStatus({ connected:true, lastSyncAt: ls });
      try { await connectStore({ platform:'shopify', shop, lastSynced: ls }); } catch(_) {}
      
      // Sačuvaj u optimizovani keš
      try { 
        const { auth } = getFirebaseApp(); 
        const u = auth.currentUser; 
        if (u) {
          const cacheKey = getCacheKey(u.uid, 'shopify');
          saveToCache(cacheKey, { shop, lastSynced: ls, accessToken });
        }
      } catch(_) {}
      
      progressBar.update(100);
      progressBar.complete();
      // Open mode chooser after successful connect
      setShowModeModal(true);
    } catch(e){
      setErr(e?.message||'Failed to connect');
      progressBar.reset();
    }
    finally{ setBusy(false); }
  }
  
  async function syncNow(){
    setBusy(true);
    progressBar.start();
    try{
      progressBar.update(30);
      const r = await apiPost('/api/integrations/shopify/sync-contacts', {});
      const ls = Date.now();
      setStatus(s => ({ ...s, lastSyncAt: ls }));
      try { await connectStore({ platform:'shopify', shop, lastSynced: ls }); } catch(_) {}
      // Sačuvaj kontakte lokalno i osvježi Contacts tab cache
      try {
        const emails = Array.isArray(r?.emails) ? r.emails : [];
        const contacts = emails.map(e => ({ email: String(e).toLowerCase(), sourceStore: 'shopify' }));
        if (contacts.length) {
          saveContactsToLocalStorage(contacts, 'shopify');
          const { auth } = getFirebaseApp();
          const u = auth.currentUser;
          if (u) await saveContactsToIndexedDB(u.uid, contacts);
        }
      } catch(_) {}
      progressBar.update(100);
      progressBar.complete();
    } catch(_){
      setErr('Sync failed. Provjerite token i dozvole (read_orders).');
      progressBar.reset();
    } finally {
      setBusy(false);
    }
  }
  
  async function disconnect(){
    setConfirmOpen(false); // Zatvori popup
    setBusy(true);
    progressBar.start();
    
    try{ 
      // Aesthetic delay + progress
      progressBar.update(20);
      await new Promise(r => setTimeout(r, 300));
      
      progressBar.update(40);
      await apiPost('/api/integrations/shopify/disconnect', {}); 
      
      progressBar.update(70);
      await new Promise(r => setTimeout(r, 400));
      
      // Obriši keš
      try { 
        const { auth } = getFirebaseApp(); 
        const u = auth.currentUser; 
        if (u) {
          const cacheKey = getCacheKey(u.uid, 'shopify');
          clearCache(cacheKey);
        }
      } catch(_) {}
      
      progressBar.update(90);
      setStatus({ connected:false, lastSyncAt:null }); 
      
      progressBar.update(100);
      progressBar.complete();
    } catch(e){
      progressBar.reset();
    }
    finally{ setBusy(false); }
  }
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-white/10 bg-zinc-950/60 shadow-[0_10px_30px_rgba(0,0,0,0.25)] p-6"
    >
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0f1117] shadow-2xl">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Choose automation mode</h3>
              <button onClick={()=>setShowModeModal(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={()=>selectMode('FAST')}
                className="text-left rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 p-5 transition shadow-lg"
                disabled={selectingMode}
              >
                <div className="text-emerald-400 font-semibold mb-1">FAST (recommended)</div>
                <div className="text-sm text-neutral-300">
                  Real‑time emails. Installs a lightweight ScriptTag to capture email on the cart/drawer and triggers
                  abandoned cart emails instantly. No theme edits required.
                </div>
              </button>
              <button
                onClick={()=>selectMode('SILENT')}
                className="text-left rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 p-5 transition shadow-lg"
                disabled={selectingMode}
              >
                <div className="text-blue-400 font-semibold mb-1">SILENT</div>
                <div className="text-sm text-neutral-300">
                  No storefront UI changes. Emails send when Shopify provides the email via webhook (usually after “Continue to shipping”),
                  with CRON as fallback.
                </div>
              </button>
            </div>
            <div className="p-5 border-t border-white/10 text-xs text-neutral-400">
              You can change the mode later in settings.
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ShopifyIcon />
          <div className="text-lg font-semibold">Shopify</div>
          {initialLoading && <LoadingSpinner size="sm" />}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={()=>setShowGuide(s=>!s)} className="p-1.5 rounded-md border border-white/10 hover:bg-white/5" title="How to connect">
            <HelpCircle className="h-4 w-4 text-neutral-300" />
          </button>
          {!initialLoading && <StatusPill connected={status.connected} />}
          {/* Always allow opening the mode chooser manually */}
          {status.connected && (
            <button
              type="button"
              onClick={()=>setShowModeModal(true)}
              className="ml-2 px-3 py-1.5 rounded-md text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow hover:opacity-95"
              title="Choose FAST or SILENT mode"
            >
              Choose Mode
            </button>
          )}
        </div>
      </div>
      {showGuide && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 text-sm text-neutral-300 rounded-lg border border-white/10 bg-white/5 p-3"
        >
          <div className="font-semibold mb-1">How to connect Shopify</div>
          <ol className="list-decimal list-inside space-y-1 text-neutral-300">
            <li>Create a Custom App in Shopify Admin → Apps → Develop apps.</li>
            <li>Install the app to your store and copy the Admin API access token.</li>
            <li>Enter your shop domain (your-shop.myshopify.com) and click Connect.</li>
          </ol>
        </motion.div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1 col-span-1">
          <label className="text-xs text-neutral-300">Shop domain</label>
          <input className="h-11 rounded-lg bg-zinc-900/70 border border-zinc-700/60 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 text-white placeholder:text-zinc-400 px-3 transition" placeholder="your-shop.myshopify.com" value={shop} onChange={e=>setShop(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 col-span-1">
          <label className="text-xs text-neutral-300">Admin API access token</label>
          <div className="relative">
            <input type={showToken?'text':'password'} className="h-11 w-full rounded-lg bg-zinc-900/70 border border-zinc-700/60 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 text-white placeholder:text-zinc-400 px-3 pr-24 transition" placeholder="shpat_..." value={accessToken} onChange={e=>setAccessToken(e.target.value)} />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button type="button" onClick={()=>setShowToken(s=>!s)} className="text-xs text-neutral-300 hover:text-white">
                {showToken ? 'Hide' : 'Show'}
              </button>
              <button type="button" onClick={()=>{ navigator.clipboard.readText().then(t=>setAccessToken(t||'')).catch(()=>{}); }} className="text-xs text-neutral-300 hover:text-white">
                Paste
              </button>
            </div>
          </div>
        </div>
        {!status.connected && (
          <button onClick={connect} className="col-span-1 md:col-span-2 w-full h-11 rounded-lg text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow hover:opacity-95 active:opacity-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled={busy || !canConnect}>
            {busy && <LoadingSpinner size="sm" />}
            {busy ? 'Connecting…' : (canConnect ? 'Connect Shopify' : 'Enter required fields')}
          </button>
        )}
        {status.connected && (
          <div className="col-span-1 md:col-span-2 flex items-center gap-2">
            <button onClick={syncNow} className="rounded-lg px-3 h-10 text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow hover:opacity-95 active:opacity-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" disabled={busy}>
              {busy && <LoadingSpinner size="sm" />}
              Sync Contacts
            </button>
            <button onClick={()=>setConfirmOpen(true)} className="text-xs rounded-md px-2 h-10 border border-rose-700/40 text-rose-300 hover:bg-rose-500/10 transition disabled:opacity-50" disabled={busy}>
              Disconnect
            </button>
            <a href="/dashboard/contacts" className="text-xs rounded-md px-2 h-10 border border-white/10 text-neutral-200 hover:bg-white/5 transition">View Contacts</a>
          </div>
        )}
        <div className="text-xs text-neutral-400">Last synced: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : '—'}</div>
        {!!err && <div className="text-xs text-rose-400 col-span-1 md:col-span-2">{err}</div>}
      </div>
      {status.connected && (
        <div className="mt-6 rounded-xl border border-white/10 bg-zinc-900/50 p-4">
          <div className="text-white font-semibold mb-2">Install Cart Tracker (Custom Pixel)</div>
          <ol className="list-decimal list-inside text-sm text-neutral-300 space-y-1 mb-3">
            <li>Open Shopify Admin → Settings → Customer events.</li>
            <li>Click “Add custom pixel” and paste the code below.</li>
            <li>Save. We will track abandoned checkouts automatically.</li>
          </ol>
          <div className="relative">
            <textarea readOnly value={buildPixelCode(pixelToken) } className="w-full h-40 rounded-lg bg-black/60 border border-white/10 text-xs text-neutral-200 p-3 font-mono"></textarea>
            <button onClick={copyPixel} className="absolute right-2 top-2 text-xs rounded-md border border-white/10 px-2 py-1 hover:bg-white/5">{pixelCopied ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="mt-2 text-xs text-neutral-400">
            Token is tied to your account ({userUid ? userUid : '—'}). You can rotate it klikom na Refresh u browseru ili re‑povezivanjem.
          </div>
        </div>
      )}
      {status.connected && (
        <div className="mt-6 rounded-xl border border-white/10 bg-zinc-900/50 p-4">
          <div className="text-white font-semibold mb-2">One‑time setup</div>
          <ol className="list-decimal list-inside text-sm text-neutral-300 space-y-2 mb-3">
            <li>Disable Shopify default “Abandoned checkout” email (avoid double‑sending).</li>
            <li>Run a quick test send to verify everything.</li>
          </ol>
          <div className="flex flex-wrap gap-3">
            <button onClick={openShopifyNotifications} className="rounded-lg px-3 h-10 text-sm text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 border border-white/10">
              Open Shopify Notifications
            </button>
            <button onClick={runManualTest} className="rounded-lg px-3 h-10 text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 border border-white/10">
              Send Test Now
            </button>
          </div>
          {!!setupMsg && <div className="mt-2 text-xs text-neutral-300">{setupMsg}</div>}
          <div className="mt-3 text-xs text-neutral-400">
            Note: Shopify ne dopušta gašenje default emailova preko API‑ja, zato koristimo direktni link.
          </div>
        </div>
      )}
      <Modal open={confirmOpen} onClose={()=>setConfirmOpen(false)} title="Disconnect Shopify?">
        <div className="text-sm text-neutral-300 space-y-3">
          <p>Are you sure you want to disconnect your Shopify store?</p>
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



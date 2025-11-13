import AppShell from '../../../components/AppShell';
import { apiGet, apiPost } from '../../../lib/apiClient';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function CampaignTypePage(){
  const router = useRouter();
  const { type } = router.query;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState([]);
  const [config, setConfig] = useState({ subject: '', body: '', delayHours: 2, status: 'active' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(()=>{ if (!type) return; (async()=>{
    try {
      setLoading(true);
      setError('');
      const data = await apiGet(`/api/campaigns/type?type=${type}`);
      setEvents(data.events||[]);
      if (data.config) setConfig(data.config);
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  })(); }, [type]);

  async function save(){
    try {
      setSaving(true); setError(''); setSuccess('');
      await apiPost('/api/campaigns/save', { type, ...config });
      setSuccess('Saved');
      setTimeout(()=> setSuccess(''), 2000);
    } catch(e){ setError(e.message); }
    finally { setSaving(false); }
  }

  const el = typeof document !== 'undefined' ? document.getElementById('create-section') : null;
  if (el) el.scrollIntoView({ behavior: 'smooth' });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="text-neutral-100 text-lg font-semibold">{type}</div>

        {loading ? (
          <div className="text-neutral-400">Loading…</div>
        ) : (
          <>
            <div className="rounded-lg border border-white/10 p-4">
              <div className="text-neutral-300 mb-2">Detected events: {events.length}</div>
              <div className="max-h-48 overflow-auto text-xs text-neutral-400">
                {events.slice(0,25).map((e,i)=> (
                  <div key={i}>{e.email} • {new Date(e.createdAt).toLocaleString()}</div>
                ))}
                {events.length===0 && <div>No events yet.</div>}
              </div>
            </div>

            <div id="create-section" className="rounded-lg border border-white/10 p-4 space-y-2">
              <div className="text-neutral-200 font-medium">Configuration</div>
              <input className="w-full px-3 py-2 bg-zinc-800 rounded border border-zinc-700 text-neutral-100" placeholder="Subject" value={config.subject} onChange={e=>setConfig(v=>({...v, subject:e.target.value}))} />
              <textarea className="w-full px-3 py-2 bg-zinc-800 rounded border border-zinc-700 text-neutral-100" placeholder="Body (HTML)" rows={6} value={config.body} onChange={e=>setConfig(v=>({...v, body:e.target.value}))} />
              <div className="flex items-center gap-3">
                <input type="number" min={0} className="w-24 px-3 py-2 bg-zinc-800 rounded border border-zinc-700 text-neutral-100" value={config.delayHours} onChange={e=>setConfig(v=>({...v, delayHours: parseInt(e.target.value||'0',10)}))} />
                <select className="px-3 py-2 bg-zinc-800 rounded border border-zinc-700 text-neutral-100" value={config.status} onChange={e=>setConfig(v=>({...v, status:e.target.value}))}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                </select>
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-fuchsia-600 text-white rounded disabled:opacity-50">{saving? 'Saving…':'Save'}</button>
              </div>
              {error && <div className="text-red-300 text-sm">{error}</div>}
              {success && <div className="text-green-300 text-sm">{success}</div>}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}




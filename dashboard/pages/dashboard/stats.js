import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { apiGet } from '../../lib/apiClient';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Area, AreaChart } from 'recharts';

export default function Stats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [daily, setDaily] = useState([]);
  const [openRate, setOpenRate] = useState([]);
  const [clickRate, setClickRate] = useState([]);

  useEffect(()=>{ (async()=>{
    try{
      setLoading(true); setError('');
      const d = await apiGet('/api/stats');
      const list = (d?.reports || []).slice(-14);
      setDaily(list.map(x=>({ day: x.date||x.day, sent: x.requests||x.sent||0 })));
      setOpenRate(list.map(x=>({ day: x.date||x.day, rate: Number(x.opens)||0 })));
      setClickRate(list.map(x=>({ day: x.date||x.day, rate: Number(x.clicks)||0 })));
    } catch(e){ setError(e.message||'Failed'); }
    finally{ setLoading(false); }
  })(); },[]);

  return (
    <AppShell>
      <section className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="mb-2 flex items-center justify-between"><div className="font-semibold">Sent per day</div>{loading && <div className="text-sm text-neutral-400">Loading…</div>}{error && <div className="text-sm text-rose-400">{error}</div>}</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ left: 4, right: 4 }}>
                <XAxis dataKey="day" stroke="#9ca3af"/>
                <YAxis stroke="#9ca3af"/>
                <Tooltip/>
                <Area type="monotone" dataKey="sent" stroke="#22c55e" fill="#22c55e22" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="mb-2 font-semibold">Open rate</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={openRate} margin={{ left: 4, right: 4 }}>
                <XAxis dataKey="day" stroke="#9ca3af"/>
                <YAxis stroke="#9ca3af"/>
                <Tooltip/>
                <Line type="monotone" dataKey="rate" stroke="#a855f7" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-xl p-4 md:col-span-2">
          <div className="mb-2 font-semibold">Click rate</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={clickRate} margin={{ left: 4, right: 4 }}>
                <XAxis dataKey="day" stroke="#9ca3af"/>
                <YAxis stroke="#9ca3af"/>
                <Tooltip/>
                <Line type="monotone" dataKey="rate" stroke="#06b6d4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </AppShell>
  );
}



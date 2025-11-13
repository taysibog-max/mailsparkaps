import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts';

export default function OverviewChart({ data }) {
  // Transform to cumulative (always rising)
  let sum = 0;
  const cum = (data || []).map(d => {
    sum += Number(d.sent || 0);
    return { day: d.day, sent: sum };
  });
  // compute simple moving average for smoother trend (on cumulative)
  const sma = (arr, n=3) => arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i-n+1), i+1);
    const avg = slice.reduce((a,b)=>a+(b.sent||0),0)/slice.length;
    return { day: arr[i].day, avg };
  });
  const trend = sma(cum, 3);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={cum} margin={{ top: 8, left: 6, right: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gl" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#ffffff0c" vertical={false} />
        <XAxis dataKey="day" stroke="#9ca3af" tickLine={false} axisLine={false} />
        <YAxis domain={[0, 'dataMax + 1']} stroke="#9ca3af" tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#a855f733' }} animationEasing="ease-out" />
        <Area
          type="monotone"
          dataKey="sent"
          stroke="url(#gl)"
          strokeWidth={2.5}
          fillOpacity={1}
          isAnimationActive={true}
          animationDuration={900}
          animationEasing="ease-in-out"
          animationBegin={200}
          fill="url(#g)"
          dot={{ r: 2, fill: '#a855f7' }}
          activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1 }}
        />
        <Line dataKey="avg" data={trend} type="monotone" stroke="#22d3ee" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({ active, payload, label }){
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="glass rounded-lg px-3 py-2 text-sm">
      <div className="text-neutral-300">{label}</div>
      <div className="font-semibold text-white">{v} sent</div>
    </div>
  );
}



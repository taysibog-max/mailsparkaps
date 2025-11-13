import React from 'react';

type Funnel = {
  abandoned: number;
  sent: number;
  opened: number;
  clicked: number;
  recovered: number;
};

export default function FunnelGraph({ data }: { data: Funnel }) {
  const max = Math.max(1, data.abandoned);
  const stages: { label: string; value: number; color: string }[] = [
    { label: 'Abandoned', value: data.abandoned, color: 'bg-gray-300' },
    { label: 'Sent', value: data.sent, color: 'bg-blue-400' },
    { label: 'Opened', value: data.opened, color: 'bg-green-400' },
    { label: 'Clicked', value: data.clicked, color: 'bg-yellow-400' },
    { label: 'Recovered', value: data.recovered, color: 'bg-emerald-500' },
  ];
  return (
    <div className="space-y-2">
      {stages.map((s) => (
        <div key={s.label} className="w-full">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">{s.label}</span>
            <span className="text-gray-600">{s.value}</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded">
            <div className={`h-3 ${s.color} rounded`} style={{ width: `${Math.min(100, (s.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}





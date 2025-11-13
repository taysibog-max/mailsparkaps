import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import AppShell from '../../components/AppShell';
import { apiPost } from '../../lib/apiClient';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

export default function Sender() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  async function send(e){
    e.preventDefault(); setResult('');
    try{ setSending(true);
      const payload = { to, subject, html: html || undefined, text: undefined };
      const res = await apiPost('/api/send-email', payload);
      setResult('Poslano! ID: ' + (res?.messageId || 'OK'));
      setTo(''); setSubject(''); setHtml('');
    } catch(e){ setResult('Greška: ' + (e.message||'Failed')); }
    finally{ setSending(false); }
  }

  return (
    <AppShell>
      <section className="glass rounded-xl p-4 space-y-3">
        <form onSubmit={send} className="space-y-3">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">To</label>
            <input required value={to} onChange={e=>setTo(e.target.value)} placeholder="recipient@example.com" className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2"/>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Subject</label>
            <input required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject" className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2"/>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Message</label>
            <div className="bg-neutral-900 border border-white/10 rounded-xl">
              <ReactQuill theme="snow" value={html} onChange={setHtml} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-primary" disabled={sending}>{sending ? 'Slanje…' : 'Pošalji email'}</button>
            {result && <div className="text-sm text-neutral-300">{result}</div>}
          </div>
        </form>
      </section>
    </AppShell>
  );
}



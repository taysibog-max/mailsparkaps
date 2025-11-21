import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getFirebaseApp } from '../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';

const UserMenu = dynamic(() => import('./UserMenu'), { ssr: false });

export default function HomePage() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const { auth } = getFirebaseApp();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Automailer</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-neutral-300 hover:text-white">Features</a>
            <a href="#pricing" className="text-neutral-300 hover:text-white">Pricing</a>
            <a href="#faq" className="text-neutral-300 hover:text-white">FAQ</a>
            <a href="#why" className="text-neutral-300 hover:text-white">Zašto</a>
          </nav>
          <div className="flex items-center gap-2">
            {!user && (
              <>
                <Link className="btn btn-outline" href="/signin">Sign in</Link>
                <Link className="btn btn-primary" href="/signup">Sign up</Link>
              </>
            )}
            {user && <UserMenu />}
          </div>
        </div>
      </header>

      <main className="pt-28">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="inline-block text-xs uppercase tracking-wider text-pink-300/80 bg-pink-500/10 border border-pink-500/30 px-2 py-1 rounded">Novo • jednostavno slanje emailova</p>
            <h1 className="mt-4 text-5xl font-extrabold leading-tight">Pošaljite emailove<br /><span className="bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text text-transparent">brže i ljepše</span></h1>
            <p className="mt-4 text-neutral-300">Automailer je lagan i moćan način za slanje transakcionih i marketinških poruka preko vašeg SMTP‑a.</p>
            <div className="mt-6 flex items-center gap-3">
              <a href="#pricing" className="btn btn-primary">Pogledaj cijene</a>
              <a href="#try" className="btn btn-outline">Počni odmah</a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -top-10 -left-10 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
            <div className="glass rounded-2xl p-4 relative">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-full bg-pink-500/20 flex items-center justify-center">A</div>
                  <div>
                    <div className="font-semibold">Upsell reminder</div>
                    <div className="text-sm text-neutral-300">Hej Sara, ostavio/la si artikle u košarici, evo 10% popusta.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-full bg-fuchsia-500/20 flex items-center justify-center">M</div>
                  <div>
                    <div className="font-semibold">Cross‑sell</div>
                    <div className="text-sm text-neutral-300">Kupci koji su uzeli tenisice često dodaju i čarape.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-full bg-pink-500/20 flex items-center justify-center">J</div>
                  <div>
                    <div className="font-semibold">Winback</div>
                    <div className="text-sm text-neutral-300">Nismo vas vidjeli neko vrijeme, 15% popusta za povratak.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works (skraćeno) */}
        <section id="how" className="section container mx-auto max-w-6xl px-6 mt-20">
          <h2 className="text-2xl font-bold">How it works</h2>
          <div className="mt-6 grid md:grid-cols-4 gap-4">
            {[
              ['Registracija i povezivanje','Registruje se i poveže svoju platformu.'],
              ['Odabir trigger eventa','Npr. napuštena korpa, signup, newsletter.'],
              ['AI generiše predloške','Možeš pregledati ili poslati direktno.'],
              ['Automatsko slanje','Sve se loguje u dashboard za optimizaciju.'],
            ].map(([title,desc]) => (
              <article key={title} className="glass rounded-xl p-4">
                <div className="text-pink-300">★</div>
                <h3 className="font-semibold mt-2">{title}</h3>
                <p className="text-sm text-neutral-300">{desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container mx-auto max-w-6xl px-6 mt-24">
          <h2 className="text-2xl font-bold">Odaberi svoj plan</h2>
          <div className="mt-6 grid md:grid-cols-3 gap-6">
            {[
              ['Starter','$29.90/mj', ['3.000 emailova','1 automatizacija','AI subject + body','Osnovna statistika','1 integracija']],
              ['Pro','$49.90/mj', ['10.000 emailova','do 5 automatizacija','AI + personalizacija','Detaljna analitika','Woo + Webhook']],
              ['Ultimate','$99.90/mj', ['50.000 emailova','Neograničene automatizacije','AI + dinamički sadržaj','Analitika + eksport','Scheduler + retry']],
            ].map(([title, price, feats]) => (
              <article key={title} className="glass rounded-2xl p-6">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <div className="text-pink-300 font-semibold">{price}</div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                  {feats.map(f => <li key={f}>✓ {f}</li>)}
                </ul>
                <a href="#try" className="btn btn-primary mt-6 inline-block">Odaberi</a>
              </article>
            ))}
          </div>
        </section>

        {/* Zašto */}
        <section id="why" className="container mx-auto max-w-6xl px-6 mt-24">
          <h2 className="text-2xl font-bold">Zašto Automailer</h2>
          <div className="mt-6 grid md:grid-cols-2 gap-8">
            <div>
              <p><strong>Manje vremena</strong> na postavljanje, više na vaš proizvod. Jednostavno, brzo i sigurno.</p>
              <ul className="mt-4 list-disc list-inside text-neutral-300">
                <li>Brza integracija</li>
                <li>Jasan fokus na dostavljivost</li>
                <li>Transparentne cijene</li>
              </ul>
            </div>
            <div className="glass rounded-xl p-6">Grafikon/preview (stub)</div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="container mx-auto max-w-6xl px-6 mt-24">
          <h2 className="text-2xl font-bold">FAQ</h2>
          <div className="mt-4 grid md:grid-cols-3 gap-4">
            {[
              ['Da li moram imati svoj SMTP?','Da, Automailer koristi vaše SMTP podatke za slanje.'],
              ['Da li mogu slati HTML emailove?','Da, podržan je i obični tekst i HTML sadržaj.'],
              ['Kako testirati?','Postavite .env i pošaljite test ispod.'],
            ].map(([q,a]) => (
              <details key={q} className="glass rounded-xl p-4">
                <summary className="font-medium cursor-pointer">{q}</summary>
                <p className="mt-2 text-sm text-neutral-300">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Try form */}
        <section id="try" className="container mx-auto max-w-6xl px-6 mt-24 mb-20">
          <h2 className="text-2xl font-bold">Isprobajte odmah</h2>
          <p className="text-neutral-300">Pošaljite test email (koristi API rutu ove aplikacije).</p>
          <TryForm />
        </section>
      </main>
    </div>
  );
}

function TryForm() {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ to: '', subject: '', text: '' });
  async function onSubmit(e) {
    e.preventDefault();
    setSending(true); setStatus('');
    try {
      const res = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStatus('Poslano ✓');
    } catch (err) { setStatus(err.message); }
    finally { setSending(false); }
  }
  return (
    <form onSubmit={onSubmit} className="mt-6 grid md:grid-cols-3 gap-3">
      <input className="input" placeholder="primaoc@domena.com" type="email" required value={form.to} onChange={e=>setForm({ ...form, to: e.target.value })} />
      <input className="input" placeholder="Naslov" required value={form.subject} onChange={e=>setForm({ ...form, subject: e.target.value })} />
      <input className="input" placeholder="Poruka" value={form.text} onChange={e=>setForm({ ...form, text: e.target.value })} />
      <button className="btn btn-primary md:col-span-3" disabled={sending}>{sending ? 'Šaljem…' : 'Pošalji test'}</button>
      {status && <p className="text-sm text-neutral-300 md:col-span-3">{status}</p>}
    </form>
  );
}



'use client';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, Suspense } from 'react';
import { getFirebaseApp } from '../lib/firebaseClient';
import { onAuthStateChanged, getIdToken } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { LayoutDashboard, Users, Megaphone, FileText, Send, BarChart3, Settings as SettingsIcon, PlugZap } from 'lucide-react';
import UserMenu from './UserMenu';

const NAV = [
  { href: '/dashboard/overview', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/dashboard/contacts', label: 'Contacts', Icon: Users },
  { href: '/dashboard/campaigns', label: 'Campaigns', Icon: Megaphone },
  { href: '/dashboard/templates', label: 'Templates', Icon: FileText },
  { href: '/dashboard/settings', label: 'Settings', Icon: SettingsIcon },
  { href: '/dashboard/integrations', label: 'Integrations', Icon: PlugZap },
];

export default function AppShell({ children }) {
  const router = useRouter();
  const { auth, db } = getFirebaseApp();
  const [plan, setPlan] = useState('starter');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push('/signin'); return; }
      const dbRef = ref(db, `userStats/${u.uid}`);
      return onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        setPlan((data?.plan || 'starter').toUpperCase());
      });
    });
    return () => unsub && unsub();
  }, [auth, db, router]);

  // Ensure user structure + migrate global data under users/<uid>
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { auth } = getFirebaseApp();
        const u = auth.currentUser;
        if (!u) return;
        const token = await getIdToken(u, false);
        await fetch(`/api/user/ensure-structure`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        }).catch(()=>{});
        await fetch(`/api/admin/migrate-user-data?uid=${u.uid}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        }).catch(()=>{});
      } catch(_) {}
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Prefetch dashboard routes for instant navigation
  useEffect(() => {
    const routes = ['/dashboard/overview','/dashboard/contacts','/dashboard/campaigns','/dashboard/templates','/dashboard/settings'];
    routes.forEach(r => router.prefetch(r).catch(()=>{}));
  }, [router]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-pink-600 text-white">A</span>
            <span className="tracking-tight">AutoMailer</span>
          </Link>
          <div className="hidden md:flex items-center gap-3 text-xs text-neutral-300">
            <span className="opacity-70">Plan</span>
            <span className="px-2 py-1 rounded-md border border-white/15">{plan}</span>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <aside className="hidden md:block rounded-xl border border-white/10 bg-neutral-900/30 p-3 h-max sticky top-20">
          <nav className="grid gap-1">
            {NAV.map((n) => {
              const active = router.pathname === n.href;
              const Icon = n.Icon;
              return (
                <Link key={n.href} prefetch href={n.href}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg border ${active ? 'bg-pink-500/10 border-pink-500/30 text-white' : 'border-white/5 hover:bg-white/5 text-neutral-300'}`}>
                  <Icon className={`h-4 w-4 ${active ? 'text-pink-300' : 'text-neutral-400 group-hover:text-neutral-200'}`} />
                  <span className="font-medium tracking-tight">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="space-y-6">
          <Suspense fallback={<div className="rounded-xl border border-white/10 bg-neutral-900/30 p-4">Loading…</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}



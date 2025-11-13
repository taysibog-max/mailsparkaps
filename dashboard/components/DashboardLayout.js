import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getFirebaseApp } from '../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import SiteHeaderNext from './SiteHeaderNext';

const nav = [
  { href: '/dashboard/overview', label: 'Overview', icon: (cls='ico') => (<svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M3 12h8V3H3Zm0 9h8v-7H3Zm10 0h8V12h-8Zm0-18v7h8V3Z"/></svg>) },
  { href: '/dashboard/contacts', label: 'Contacts', icon: (cls='ico') => (<svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0Z"/></svg>) },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: (cls='ico') => (<svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="m2 7 10-4 10 4v4l-10 4L2 11Zm0 6 10 4 10-4v4l-10 4-10-4Z"/></svg>) },
  { href: '/dashboard/automations', label: 'Automations', icon: (cls='ico') => (<svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M9 2h6v4H9Zm0 16h6v4H9Zm11-7h4v6h-4ZM0 11h4v6H0Z"/></svg>) },
  { href: '/dashboard/settings', label: 'Settings', icon: (cls='ico') => (<svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94a7.49 7.49 0 0 0 .05-.94 7.49 7.49 0 0 0-.05-.94l2.11-1.65a.48.48 0 0 0 .11-.61l-2-3.46a.49.49 0 0 0-.6-.22l-2.49 1a7.28 7.28 0 0 0-1.63-.94l-.38-2.65A.49.49 0 0 0 13.82 2h-3.64a.49.49 0 0 0-.48.4L9.32 5.05a7.28 7.28 0 0 0-1.63.94l-2.49-1a.49.49 0 0 0-.6.22l-2 3.46a.49.49 0 0 0 .11.61l2.11 1.65a7.49 7.49 0 0 0-.05.94 7.49 7.49 0 0 0 .05.94L2.82 14.6a.48.48 0 0 0-.11.61l2 3.46a.49.49 0 0 0 .6.22l2.49-1a7.28 7.28 0 0 0 1.63.94l.38 2.65a.49.49 0 0 0 .48.4h3.64a.49.49 0 0 0 .48-.4l.38-2.65a7.28 7.28 0 0 0 1.63-.94l2.49 1a.49.49 0 0 0 .6-.22l2-3.46a.49.49 0 0 0-.11-.61ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"/></svg>) },
  { href: '/dashboard/billing', label: 'Billing', icon: (cls='ico') => (<svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v14H3Zm2 3h14V7H5Zm0 9h6v-5H5Z"/></svg>) }
];

export default function DashboardLayout({ children, active }) {
  const { auth, db } = getFirebaseApp();
  const [plan, setPlan] = useState('starter');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) window.location.href = '/signin';
      else {
        const dbRef = ref(db, `userStats/${u.uid}`);
        onValue(dbRef, (snapshot) => {
          const data = snapshot.val();
          setPlan((data?.plan || 'starter').toLowerCase());
        });
      }
    });
    return () => unsub();
  }, [auth, db]);

  const PLAN = {
    starter: { contacts: true, campaigns: true, automations: false, billing: true },
    growth: { contacts: true, campaigns: true, automations: true, billing: true },
    pro: { contacts: true, campaigns: true, automations: true, billing: true },
  }[plan] || { contacts: true, campaigns: true, automations: false, billing: true };

  return (
    <div className="min-h-screen">
      <SiteHeaderNext />
      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {children}
      </main>
    </div>
  );
}



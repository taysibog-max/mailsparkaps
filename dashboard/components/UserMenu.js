import { useEffect, useRef, useState } from 'react';
import { getFirebaseApp } from '../lib/firebaseClient';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Link from 'next/link';
import { LayoutDashboard, Settings, LogOut } from 'lucide-react';

export default function UserMenu() {
  const { auth } = getFirebaseApp();
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);
  useEffect(() => {
    function onDoc(e){ if(!ref.current) return; if(!ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);
  if (!user) return null;
  const name = user.displayName || 'there';
  const avatar = user.photoURL || `https://ui-avatars.com/api/?background=7e22ce&color=fff&name=${encodeURIComponent(name)}`;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="group flex items-center gap-3 rounded-2xl px-3 py-1.5 glass hover:shadow-soft transition">
        <div className="hidden sm:block text-sm text-neutral-300">Hi, <span className="font-semibold text-white">{name.split(' ')[0]}</span></div>
        <div className="relative">
          <img src={avatar} alt="avatar" className="h-9 w-9 rounded-full ring-2 ring-white/10 group-hover:ring-primary transition" />
          <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_6px_rgba(168,85,247,0.15)] opacity-0 group-hover:opacity-100 transition"></span>
        </div>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 text-sm">
            <div className="text-neutral-300">Signed in as</div>
            <div className="truncate font-semibold">{user.email}</div>
          </div>
          <div className="border-t border-white/10">
            <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10">
              <LayoutDashboard className="h-4 w-4 text-neutral-400" />
              <span>Dashboard</span>
            </Link>
            <Link href="#account" className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10">
              <Settings className="h-4 w-4 text-neutral-400" />
              <span>Account settings</span>
            </Link>
            <button onClick={() => signOut(auth)} className="w-full text-left flex items-center gap-2 px-4 py-2.5 hover:bg-white/10">
              <LogOut className="h-4 w-4 text-neutral-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



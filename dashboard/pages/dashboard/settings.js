import AppShell from '../../components/AppShell';
import { getFirebaseApp } from '../../lib/firebaseClient';
import { signOut, updateProfile } from 'firebase/auth';
import { useEffect, useState } from 'react';

export default function Settings() {
  const { auth } = getFirebaseApp();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(()=>{
    const u = auth.currentUser;
    if(u){ setDisplayName(u.displayName||''); setPhotoURL(u.photoURL||''); setEmail(u.email||''); }
  },[auth]);
  async function save(e){ e.preventDefault(); if(!auth.currentUser) return; try{ setSaving(true); await updateProfile(auth.currentUser, { displayName: displayName||null, photoURL: photoURL||null }); } finally{ setSaving(false); } }
  return (
    <AppShell>
      <section className="glass rounded-xl p-4 space-y-4 max-w-xl">
        <div>
          <div className="text-sm text-neutral-400">Signed in</div>
          <div className="font-semibold">{email}</div>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Display name</label>
            <input className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Photo URL</label>
            <input className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2" value={photoURL} onChange={e=>setPhotoURL(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="btn btn-outline" onClick={()=>signOut(auth)}>Logout</button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}



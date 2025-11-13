import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getFirebaseApp } from '../lib/firebaseClient';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect } from 'firebase/auth';

export default function SignIn() {
  const router = useRouter();
  const { auth, GoogleProvider } = getFirebaseApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace('/');
    });
    return () => unsub();
  }, [auth, router]);

  async function handleEmailLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/');
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    try {
      await signInWithPopup(auth, GoogleProvider);
      router.replace('/');
    } catch (e) {
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/popup-closed-by-user') {
        try {
          await signInWithRedirect(auth, GoogleProvider);
        } catch (err) { setError(err.message || String(err)); }
      } else {
        setError(e.message || String(e));
      }
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-md px-6 pt-16">
        <Link href="/" className="text-sm text-neutral-300 hover:text-white">← Back to Home</Link>
        <h1 className="mt-4 text-3xl font-extrabold">Sign in</h1>
        <p className="mt-2 text-neutral-400">Prijavi se na svoj račun.</p>
        <button onClick={handleGoogle} className="mt-6 w-full btn btn-outline">Continue with Google</button>
        <div className="my-6 h-px bg-white/10" />
        <form onSubmit={handleEmailLogin} className="grid gap-3">
          <input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" required placeholder="Email" className="input" />
          <input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" required placeholder="Password" className="input" />
          <button disabled={loading} className="btn btn-primary w-full">{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-3 text-sm text-neutral-400">Nemaš račun? <Link href="/signup" className="text-pink-300">Sign up</Link></p>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </div>
    </div>
  );
}



import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getFirebaseApp } from '../lib/firebaseClient';
import { onAuthStateChanged, createUserWithEmailAndPassword, updateProfile, signInWithPopup, signInWithRedirect } from 'firebase/auth';

export default function SignUp() {
  const router = useRouter();
  const { auth, GoogleProvider } = getFirebaseApp();
  const [name, setName] = useState('');
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

  async function handleEmailSignup(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }
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
        try { await signInWithRedirect(auth, GoogleProvider); } catch (err) { setError(err.message || String(err)); }
      } else {
        setError(e.message || String(e));
      }
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-md px-6 pt-16">
        <Link href="/" className="text-sm text-neutral-300 hover:text-white">← Back to Home</Link>
        <h1 className="mt-4 text-3xl font-extrabold">Create account</h1>
        <p className="mt-2 text-neutral-400">Registruj novi račun.</p>
        <button onClick={handleGoogle} className="mt-6 w-full btn btn-outline">Continue with Google</button>
        <div className="my-6 h-px bg-white/10" />
        <form onSubmit={handleEmailSignup} className="grid gap-3">
          <input value={name} onChange={(e)=>setName(e.target.value)} type="text" placeholder="Full name (optional)" className="input" />
          <input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" required placeholder="Email" className="input" />
          <input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" required placeholder="Password" className="input" />
          <button disabled={loading} className="btn btn-primary w-full">{loading ? 'Creating…' : 'Sign up'}</button>
        </form>
        <p className="mt-3 text-sm text-neutral-400">Već imaš račun? <Link href="/signin" className="text-pink-300">Sign in</Link></p>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </div>
    </div>
  );
}



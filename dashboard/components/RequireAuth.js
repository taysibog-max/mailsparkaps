import { useEffect, useState } from 'react';
import { getFirebaseApp } from '../lib/firebaseClient';
import { onAuthStateChanged, getIdToken } from 'firebase/auth';

export function useIdToken() {
  const { auth } = getFirebaseApp();
  const [token, setToken] = useState(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setToken(null); return; }
      const t = await getIdToken(u, true);
      setToken(t);
    });
    return () => unsub();
  }, [auth]);
  return token;
}

export default function RequireAuth({ children }) {
  const { auth } = getFirebaseApp();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) window.location.href = '/signin';
      else setReady(true);
    });
    return () => unsub();
  }, [auth]);
  if (!ready) return null;
  return children;
}



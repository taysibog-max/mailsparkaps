import { getIdToken } from 'firebase/auth';
import { getFirebaseApp } from './firebaseClient';

async function buildHeaders(extra) {
  const { auth } = getFirebaseApp();
  const user = auth.currentUser;
  const headers = { 'Content-Type': 'application/json', ...(extra||{}) };
  if (user) {
    // Use cached token when offline; avoid forced refresh which fails without network
    try { headers['Authorization'] = 'Bearer ' + await getIdToken(user); } catch (_) {}
    try { headers['X-User-Uid'] = user.uid; } catch (_) {}
  }
  return headers;
}

export async function apiGet(path) {
  // simple in-memory TTL cache to speed up repeated navigations
  if (!globalThis.__apiCache) globalThis.__apiCache = new Map();
  const key = 'GET ' + path;
  const cached = globalThis.__apiCache.get(key);
  const now = Date.now();
  if (cached && now - cached.t < 15000) { // 15s TTL
    return cached.v;
  }
  const url = path.includes('?') ? `${path}&cb=${now}` : `${path}?cb=${now}`;
  const res = await fetch(url, { headers: await buildHeaders(), cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  globalThis.__apiCache.set(key, { v: data, t: now });
  return data;
}

export async function apiPost(path, body) {
  const now = Date.now();
  const url = path.includes('?') ? `${path}&cb=${now}` : `${path}?cb=${now}`;
  const res = await fetch(url, { method: 'POST', headers: await buildHeaders(), body: JSON.stringify(body||{}), cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}



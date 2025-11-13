/**
 * Connection Cache Manager
 * Upravlja cache-om za store konekciju sa localStorage
 */

const CACHE_KEY = 'automailer_store_connection';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 sata u milisekundama

export function getConnectionCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    const now = Date.now();
    
    // Proveri da li je cache valjan (nije stariji od 24h)
    if (now - data.lastChecked > CACHE_DURATION) {
      clearConnectionCache();
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error reading connection cache:', error);
    return null;
  }
}

export function setConnectionCache(connectionData) {
  try {
    const data = {
      connectionStatus: 'connected',
      lastChecked: Date.now(),
      store: connectionData.store,
      platform: connectionData.platform,
      ...connectionData
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    console.log('✅ Connection cache saved:', data);
    return data;
  } catch (error) {
    console.error('Error saving connection cache:', error);
    return null;
  }
}

export function clearConnectionCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Connection cache cleared');
  } catch (error) {
    console.error('Error clearing connection cache:', error);
  }
}

export function isConnectionCached() {
  const cache = getConnectionCache();
  return cache !== null && cache.connectionStatus === 'connected';
}

export function getCachedStore() {
  const cache = getConnectionCache();
  return cache ? cache.store : null;
}

export function getCacheAge() {
  const cache = getConnectionCache();
  if (!cache) return null;
  return Date.now() - cache.lastChecked;
}

export function shouldRefreshCache() {
  const age = getCacheAge();
  return age === null || age > CACHE_DURATION;
}

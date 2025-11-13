/**
 * Utility za keširanje konekcije sa shop API-jem i drugim podacima
 * TTL: 24 sata (86400000ms)
 */

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

/**
 * Sačuva podatke u localStorage sa timestamp-om
 */
export function saveToCache(key, data) {
  try {
    const entry = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
    return true;
  } catch (e) {
    console.error('Cache save failed:', e);
    return false;
  }
}

/**
 * Učitava podatke iz localStorage-a, provjerava validan TTL
 * @returns {object|null} data ili null ako je keš istekao
 */
export function loadFromCache(key, ttl = CACHE_TTL) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const entry = JSON.parse(cached);
    const now = Date.now();
    
    // Provjeri je li keš istekao
    if (now - entry.timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    
    return entry.data;
  } catch (e) {
    console.error('Cache load failed:', e);
    return null;
  }
}

/**
 * Briše keš za određeni ključ
 */
export function clearCache(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Cache clear failed:', e);
  }
}

/**
 * Briše sve keširane podatke (svi ključevi koji počinju sa 'am_')
 */
export function clearAllCache() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('am_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.error('Clear all cache failed:', e);
  }
}

/**
 * Генерише cache key za trenutnog korisnika
 */
export function getCacheKey(userId, type) {
  return `am_${type}_${userId}`;
}


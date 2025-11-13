/**
 * Contacts Cache Manager
 * Upravlja cache-om za kontakte sa IndexedDB i localStorage
 */

const CONTACTS_CACHE_KEY = 'automailer_contacts_cache';
const CONTACTS_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 sati u milisekundama

// IndexedDB setup
const DB_NAME = 'AutoMailerContactsDB';
const DB_VERSION = 1;
const STORE_NAME = 'contacts';

let db = null;

// Inicijalizuj IndexedDB
export async function initContactsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('email', 'email', { unique: false });
        store.createIndex('platform', 'platform', { unique: false });
        store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
    };
  });
}

// Sačuvaj kontakte u IndexedDB
export async function saveContactsToDB(contacts, platform) {
  try {
    if (!db) await initContactsDB();
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Obriši stare kontakte za ovu platformu
    const index = store.index('platform');
    const range = IDBKeyRange.only(platform);
    const deleteRequest = index.openCursor(range);
    
    deleteRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    // Dodaj nove kontakte
    contacts.forEach(contact => {
      store.put({
        ...contact,
        platform,
        lastUpdated: Date.now()
      });
    });
    
    // Sačuvaj metadata u localStorage
    localStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify({
      lastUpdated: Date.now(),
      platform,
      count: contacts.length
    }));
    
    console.log(`✅ Saved ${contacts.length} contacts to IndexedDB for ${platform}`);
  } catch (error) {
    console.error('Error saving contacts to IndexedDB:', error);
  }
}

// Učitaj kontakte iz IndexedDB
export async function loadContactsFromDB(platform) {
  try {
    if (!db) await initContactsDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('platform');
      const request = index.getAll(platform);
      
      request.onsuccess = () => {
        const contacts = request.result.map(contact => {
          // Ukloni platform i lastUpdated iz rezultata
          const { platform: _, lastUpdated: __, ...cleanContact } = contact;
          return cleanContact;
        });
        resolve(contacts);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error loading contacts from IndexedDB:', error);
    return [];
  }
}

// Proveri da li je cache valjan
export function isContactsCacheValid(platform) {
  try {
    const cached = localStorage.getItem(CONTACTS_CACHE_KEY);
    if (!cached) return false;
    
    const data = JSON.parse(cached);
    const now = Date.now();
    
    // Proveri da li je cache valjan i za istu platformu
    return data.platform === platform && 
           (now - data.lastUpdated) < CONTACTS_CACHE_DURATION;
  } catch (error) {
    console.error('Error checking contacts cache validity:', error);
    return false;
  }
}

// Obriši cache
export function clearContactsCache() {
  try {
    localStorage.removeItem(CONTACTS_CACHE_KEY);
    
    if (db) {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
    }
    
    console.log('🗑️ Contacts cache cleared');
  } catch (error) {
    console.error('Error clearing contacts cache:', error);
  }
}

// Uzmi cache metadata
export function getContactsCacheInfo() {
  try {
    const cached = localStorage.getItem(CONTACTS_CACHE_KEY);
    if (!cached) return null;
    
    return JSON.parse(cached);
  } catch (error) {
    console.error('Error getting contacts cache info:', error);
    return null;
  }
}

// Fallback na localStorage ako IndexedDB nije dostupan
export function saveContactsToLocalStorage(contacts, platform) {
  try {
    const data = {
      contacts,
      platform,
      lastUpdated: Date.now()
    };
    localStorage.setItem(`${CONTACTS_CACHE_KEY}_${platform}`, JSON.stringify(data));
    console.log(`✅ Saved ${contacts.length} contacts to localStorage for ${platform}`);
  } catch (error) {
    console.error('Error saving contacts to localStorage:', error);
  }
}

export function loadContactsFromLocalStorage(platform) {
  try {
    const cached = localStorage.getItem(`${CONTACTS_CACHE_KEY}_${platform}`);
    if (!cached) return [];
    
    const data = JSON.parse(cached);
    const now = Date.now();
    
    // Proveri da li je cache valjan
    if ((now - data.lastUpdated) > CONTACTS_CACHE_DURATION) {
      return [];
    }
    
    return data.contacts || [];
  } catch (error) {
    console.error('Error loading contacts from localStorage:', error);
    return [];
  }
}

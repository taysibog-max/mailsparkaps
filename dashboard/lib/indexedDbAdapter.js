/**
 * IndexedDB adapter za lokalno skladištenje kontakata
 * Omogućava da se kontakti sačuvaju offline i brzo učitaju bez API poziva
 */

const DB_NAME = 'AutomailerDB';
const DB_VERSION = 1;
const CONTACTS_STORE = 'contacts';

let dbInstance = null;

/**
 * Otvara IndexedDB konekciju
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Kreiraj object store za kontakte ako ne postoji
      if (!db.objectStoreNames.contains(CONTACTS_STORE)) {
        const store = db.createObjectStore(CONTACTS_STORE, { keyPath: 'id' });
        store.createIndex('email', 'email', { unique: false });
        store.createIndex('source', 'source', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
  });
}

/**
 * Sačuva listu kontakata u IndexedDB za specifičnog korisnika
 */
export async function saveContactsToIndexedDB(userId, contacts) {
  try {
    const db = await openDB();
    const tx = db.transaction(CONTACTS_STORE, 'readwrite');
    const store = tx.objectStore(CONTACTS_STORE);

    // Prvo obriši postojeće kontakte za ovog korisnika
    const index = store.index('userId');
    const deleteRequest = index.openCursor(IDBKeyRange.only(userId));
    
    deleteRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Sačekaj da se obriše
    await new Promise((resolve) => {
      deleteRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });

    // Dodaj nove kontakte
    for (const contact of contacts) {
      const record = {
        id: `${userId}_${contact.email}`,
        userId,
        email: contact.email,
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        source: contact.source,
        importedAt: contact.importedAt || Date.now(),
        cachedAt: Date.now(),
      };
      store.put(record);
    }

    await tx.complete;
    return { success: true, count: contacts.length };
  } catch (error) {
    console.error('IndexedDB save failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Učitava kontakte iz IndexedDB-a za specifičnog korisnika
 */
export async function loadContactsFromIndexedDB(userId) {
  try {
    const db = await openDB();
    const tx = db.transaction(CONTACTS_STORE, 'readonly');
    const store = tx.objectStore(CONTACTS_STORE);
    const index = store.index('userId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(userId));
      
      request.onsuccess = () => {
        const results = request.result || [];
        // Transformiši nazad u format koji očekuje app
        const contacts = results.map(r => ({
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          source: r.source,
          importedAt: r.importedAt,
        }));
        resolve(contacts);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB load failed:', error);
    return [];
  }
}

/**
 * Briše sve kontakte za specifičnog korisnika
 */
export async function clearContactsFromIndexedDB(userId) {
  try {
    const db = await openDB();
    const tx = db.transaction(CONTACTS_STORE, 'readwrite');
    const store = tx.objectStore(CONTACTS_STORE);
    const index = store.index('userId');

    return new Promise((resolve) => {
      const request = index.openCursor(IDBKeyRange.only(userId));
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve(true);
        }
      };
      
      request.onerror = () => resolve(false);
    });
  } catch (error) {
    console.error('IndexedDB clear failed:', error);
    return false;
  }
}

/**
 * Provjerava koliko kontakata postoji u IndexedDB-u za korisnika
 */
export async function getContactsCount(userId) {
  try {
    const contacts = await loadContactsFromIndexedDB(userId);
    return contacts.length;
  } catch {
    return 0;
  }
}


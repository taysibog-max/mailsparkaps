# Kontakti - Stvarni Podaci Fix

## Problem
U tabu Contacts prikazivali su se mock podatci umjesto stvarnih kontakata koji su uspješno sinhronizirani u Integrations tab-u.

## Rješenje

### 1. Popravljena logika sinhronizacije u ContactsTab.tsx
- **Prije**: `syncContacts` funkcija je kreirala mock podatke
- **Sada**: Koristi stvarne podatke iz WooCommerce API-ja

### 2. Ažurirani API endpoint-i za konzistentnost
- `/api/syncContacts.js` - sada čuva kontakte u Firestore
- `/api/contacts/delete.js` - koristi ispravnu Firestore putanju
- `/api/add-contact.js` - ažuriran za Firestore
- `/api/contacts.js` - ažuriran za Firestore

### 3. Struktura baze podataka
```
users/{userId}/contacts/{email}
├── email: string
├── firstName: string
├── lastName: string
├── source: 'woocommerce' | 'shopify' | 'manual'
├── createdAt: string (ISO)
└── importedAt: serverTimestamp
```

### 4. Tok sinhronizacije
1. **Provjera konekcije**: Provjerava da li je WooCommerce konektovan
2. **Dohvaćanje podataka**: Koristi `/api/integrations/woo/connect-and-sync`
3. **Čuvanje u bazu**: Importuje kontakte u Firestore
4. **Ažuriranje UI**: Učitava kontakte iz Firestore-a
5. **Keširanje**: Čuva u localStorage i IndexedDB

### 5. Persistence
- **Firestore**: Glavna baza podataka
- **localStorage**: Cache za brže učitavanje
- **IndexedDB**: Fallback cache
- **Refresh/Logout**: Kontakti se čuvaju u Firestore-u

### 6. Testiranje
- `/api/test-contacts.js` - endpoint za testiranje svih kontakata u bazi
- Logovi u konzoli pokazuju tok sinhronizacije
- Success message prikazuje stvarne brojeve

## Rezultat
- Kontakti se sada prikazuju iz stvarne baze
- Sinhronizacija koristi stvarne podatke iz WooCommerce-a
- Kontakti se čuvaju nakon refresh-a i logout-a
- Eliminirani mock podatci

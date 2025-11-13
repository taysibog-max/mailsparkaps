# 🛠️ Console Commands - Dijagnostika u Browser-u

## 🔍 Kako Pokrenuti Dijagnostiku

### 1. Otvorite Browser DevTools
- Pritisnite **F12** ili **Ctrl+Shift+I** (Windows) / **Cmd+Option+I** (Mac)
- Idite na **Console** tab

### 2. Pokrenite Dijagnostiku
```javascript
// Full dijagnostika - sve odjednom
window.diagnostics.fullDiagnostics()

// Samo environment varijable
window.diagnostics.checkEnv()

// Samo Firebase status
window.diagnostics.checkFirebase()

// Samo Auth status
window.diagnostics.checkAuth()

// Obriši keš i restartuj
window.diagnostics.clearCache()
```

---

## 📊 Očekivani Rezultati

### ✅ Kad sve radi:
```javascript
// window.diagnostics.fullDiagnostics()
🔍 Running Full Diagnostics...
========================
🔧 Environment Check: {allPresent: true, missing: [], ...}
Firebase: {firebaseConfig: 'loaded', auth: 'connected', firestore: 'connected'}
Auth: {currentUser: 'user_id_here', isLoggedIn: true}
Cache: ['am_store_connection_user_id', ...]
========================
✅ Diagnostics Complete
```

### ❌ Kad ne radi (trenutno stanje):
```javascript
// window.diagnostics.fullDiagnostics()
🔍 Running Full Diagnostics...
========================
🔧 Environment Check: {allPresent: false, missing: ['NEXT_PUBLIC_FIREBASE_API_KEY', ...]}
Firebase: {firebaseConfig: 'loaded', auth: 'connected', firestore: 'error: timeout'}
Auth: {currentUser: null, isLoggedIn: false}
Cache: []
========================
✅ Diagnostics Complete
```

---

## 🚨 Problemi i Rješenja

### Problem 1: "Missing environment variables"
**Simptom:** `allPresent: false, missing: ['NEXT_PUBLIC_FIREBASE_API_KEY', ...]`
**Rješenje:** Ažurirajte `.env.local` sa stvarnim Firebase vrijednostima

### Problem 2: "Firestore: error: timeout"
**Simptom:** `firestore: 'error: timeout'`
**Rješenje:** Firebase konfiguracija nije ispravna ili Firestore nije omogućen

### Problem 3: "Auth: currentUser: null"
**Simptom:** `currentUser: null, isLoggedIn: false`
**Rješenje:** Authentication nije omogućen ili korisnik nije prijavljen

### Problem 4: "Cache: []"
**Simptom:** `Cache: []`
**Rješenje:** Normalno za prvi put - keš će se kreirati nakon što se konektuje

---

## 🔧 Debug Panel

U development mode-u, u donjem desnom uglu ćete vidjeti **Debug Panel** koji prikazuje:
- Loading status
- Connected status
- Store data
- Auth user
- Firebase status
- Environment variables
- Cache status

### Debug Panel Funkcije:
- **Clear Cache & Reload** - Briše keš i restartuje app
- Real-time status svih komponenti

---

## 📋 Checklist za Rješavanje

- [ ] **Environment varijable su postavljene** u `.env.local`
- [ ] **Firebase project postoji** i radi
- [ ] **Auth je omogućen** u Firebase Console
- [ ] **Firestore je omogućen** sa test mode rules
- [ ] **Dev server je restartovan** nakon promjena
- [ ] **Dijagnostika pokazuje zelene statusove**

---

## 🎯 Finalni Test

Nakon što sve postavite, pokrenite:
```javascript
window.diagnostics.fullDiagnostics()
```

**Trebate vidjeti:**
- ✅ Environment: All Present: yes
- ✅ Firebase: Config: loaded, Auth: connected, Firestore: connected
- ✅ Auth: currentUser: (neki ID)
- ✅ Cache: (neki keš ključevi)

**Tada će dashboard raditi brzo i glatko!** 🚀

---

## 🆘 Ako i dalje ne radi

1. **Provjerite da li je `.env.local` u `dashboard/` folderu**
2. **Provjerite da li su vrijednosti ispravne** (bez "your_*_here")
3. **Restartujte dev server**
4. **Provjerite Firebase Console** da li su servisi aktivni
5. **Pokrenite dijagnostiku** i pošaljite rezultate

**Sve optimizacije su implementirane - samo trebate Firebase config!** 🎉

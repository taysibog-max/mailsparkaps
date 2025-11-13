# 🔍 Automailer Dashboard - Dijagnostika Problema

## Problem: Dashboard se zaglavio na "Checking your store connection..."

### 🛠️ Rješenje - Korak po Korak

#### 1. **Otvorite Browser DevTools**
- Pritisnite `F12` ili `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- Idite na **Console** tab

#### 2. **Pokrenite Dijagnostiku**
U konzoli upišite i pritisnite Enter:
```javascript
window.diagnostics.fullDiagnostics()
```

#### 3. **Provjerite Rezultate**

**A) Environment Variables (najčešći problem)**
```javascript
window.diagnostics.checkEnv()
```
- Ako vidite "Missing: NEXT_PUBLIC_FIREBASE_..." - **ovo je problem!**

**B) Firebase Connection**
```javascript
window.diagnostics.checkFirebase()
```
- Ako vidite "Firestore: error: timeout" - Firebase konekcija ne radi

**C) Auth Status**
```javascript
window.diagnostics.checkAuth()
```
- Ako vidite "currentUser: null" - niste ulogovani

---

## 🚨 Najčešći Problemi i Rješenja

### Problem 1: Missing Environment Variables
**Simptom:** Console pokazuje "Missing: NEXT_PUBLIC_FIREBASE_..."

**Rješenje:**
1. Kreirajte `.env.local` datoteku u `dashboard/` folderu
2. Dodajte Firebase konfiguraciju:

```bash
# dashboard/.env.local
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

3. Restartujte dev server: `npm run dev`

### Problem 2: Firebase Project Ne Postoji
**Simptom:** "Firestore: error: Project not found"

**Rješenje:**
1. Idite na [Firebase Console](https://console.firebase.google.com)
2. Provjerite da li je project kreiran
3. Provjerite da li su environment varijable ispravne

### Problem 3: Auth Nije Konfigurisan
**Simptom:** "Auth: error" ili "currentUser: null"

**Rješenje:**
1. U Firebase Console → Authentication → Sign-in method
2. Omogućite Google Sign-in
3. Dodajte vašu domenu u authorized domains

### Problem 4: Firestore Security Rules
**Simptom:** "Firestore: error: permission denied"

**Rješenje:**
1. U Firebase Console → Firestore Database → Rules
2. Za development, koristite:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // SAMO ZA DEVELOPMENT!
    }
  }
}
```

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

## 🚀 Brze Komande

```javascript
// Provjeri sve odjednom
window.diagnostics.fullDiagnostics()

// Samo environment
window.diagnostics.checkEnv()

// Samo Firebase
window.diagnostics.checkFirebase()

// Samo Auth
window.diagnostics.checkAuth()

// Obriši keš i restartuj
window.diagnostics.clearCache()
```

---

## 📋 Checklist za Rješavanje

- [ ] Environment varijable su postavljene u `.env.local`
- [ ] Firebase project postoji i radi
- [ ] Auth je konfigurisan u Firebase Console
- [ ] Firestore security rules dozvoljavaju pristup
- [ ] Korisnik je ulogovan
- [ ] Dev server je restartovan nakon promjena

---

## 🆘 Ako Ništa Ne Radi

1. **Obrišite keš:**
```javascript
window.diagnostics.clearCache()
```

2. **Restartujte dev server:**
```bash
cd dashboard
npm run dev
```

3. **Provjerite network tab** u DevTools da vidite koji API pozivi ne rade

4. **Provjerite Firebase Console** da li su svi servisi aktivni

---

## 📞 Dodatna Pomoc

Ako i dalje imate probleme, pokrenite:
```javascript
window.diagnostics.fullDiagnostics()
```

I pošaljite rezultate - to će nam pomoći da brže dijagnostikujemo problem! 🚀

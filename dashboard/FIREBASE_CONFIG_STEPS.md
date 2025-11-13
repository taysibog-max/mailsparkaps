# 🔥 Firebase Configuration - Korak po Korak

## 🚨 Problem: "Firestore timeout" Error

Dashboard ne može da se konektuje na Firebase jer nedostaju stvarne vrijednosti u `.env.local` datoteci.

## ✅ Rješenje: Dobijte Firebase Konfiguraciju

### Korak 1: Idite na Firebase Console
1. Otvorite [Firebase Console](https://console.firebase.google.com)
2. Prijavite se sa Google account-om
3. Odaberite project **"automailer-8d125"**

### Korak 2: Dodajte Web App
1. Kliknite na **⚙️ Settings** (Project Settings)
2. Scroll down do **"Your apps"** sekcije
3. Ako nema Web app:
   - Kliknite **"Add app"** → **🌐 Web** ikona
   - Nazovite app: **"AutoMailer Dashboard"**
   - Kliknite **"Register app"**

### Korak 3: Kopirajte Konfiguraciju
Firebase će prikazati konfiguraciju ovako:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC_actual_key_here",
  authDomain: "automailer-8d125.firebaseapp.com",
  projectId: "automailer-8d125",
  storageBucket: "automailer-8d125.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### Korak 4: Ažurirajte .env.local
Zamijenite vrijednosti u `.env.local` datoteci:

```bash
# Firebase Configuration - Project: automailer-8d125
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC_actual_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=automailer-8d125.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=automailer-8d125
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=automailer-8d125.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

### Korak 5: Omogućite Firebase Servise

#### A) Authentication
1. U Firebase Console → **Authentication**
2. Kliknite **"Get started"**
3. Idite na **"Sign-in method"** tab
4. Omogućite **Google** sign-in
5. Dodajte **localhost:3002** u **Authorized domains**

#### B) Firestore Database
1. U Firebase Console → **Firestore Database**
2. Kliknite **"Create database"**
3. Odaberite **"Start in test mode"** (za development)
4. Odaberite lokaciju (europe-west ili us-central)

#### C) Security Rules (za development)
U Firestore → **Rules**, koristite:
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

### Korak 6: Restartujte Dev Server
```bash
cd dashboard
npm run dev
```

---

## 🔍 Provjera da li radi

1. **Otvorite browser na `localhost:3002`**
2. **Otvorite DevTools (F12) → Console**
3. **Pokrenite dijagnostiku:**
```javascript
window.diagnostics.fullDiagnostics()
```

**Trebali biste vidjeti:**
- ✅ Environment: All Present: yes
- ✅ Firebase: Config: loaded, Auth: connected, Firestore: connected
- ✅ Dashboard se učitava brzo bez "Checking your store connection..."

---

## 🚨 Ako i dalje ne radi

### Problem 1: "Missing environment variables"
**Rješenje:** Provjerite da li je `.env.local` u `dashboard/` folderu i da li su vrijednosti ispravne

### Problem 2: "Firebase: error: Project not found"
**Rješenje:** Provjerite da li je project ID ispravan u `.env.local`

### Problem 3: "Auth: error"
**Rješenje:** 
1. Provjerite da li je Authentication omogućen u Firebase Console
2. Provjerite da li je Google sign-in omogućen
3. Provjerite authorized domains

### Problem 4: "Firestore: error: permission denied"
**Rješenje:** Provjerite Firestore security rules (koristite test mode za development)

---

## 🎯 Očekivani Rezultat

Nakon što sve postavite:
- ✅ Dashboard se učitava brzo
- ✅ Nema "Checking your store connection..." poruku
- ✅ Debug Panel prikazuje sve zelene statusove
- ✅ Možete se prijaviti/logout
- ✅ Contacts i Campaigns sekcije rade
- ✅ Sve optimizacije rade (keš, progress bar, IndexedDB)

**Dashboard će biti potpuno funkcionalan i optimizovan!** 🚀

# 🔥 Firebase Setup - Riješavanje "Checking your store connection..." Problema

## 🚨 Problem
Dashboard se zaglavio na "Checking your store connection..." jer **nema Firebase konfiguraciju**.

## ✅ Rješenje

### Korak 1: Kreirajte `.env.local` datoteku

U `dashboard/` folderu kreirajte datoteku `.env.local` sa sljedećim sadržajem:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=automailer-8d125.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=automailer-8d125
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=automailer-8d125.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

### Korak 2: Dobijte Firebase Konfiguraciju

1. **Idite na [Firebase Console](https://console.firebase.google.com)**
2. **Odaberite project "automailer-8d125"**
3. **Idite na Project Settings (⚙️ zupčanik) → General tab**
4. **Scroll down do "Your apps" sekcije**
5. **Ako nema Web app:**
   - Kliknite "Add app" → Web (🌐 ikona)
   - Nazovite app "AutoMailer Dashboard"
   - Kliknite "Register app"
6. **Kopirajte konfiguraciju i zamijenite vrijednosti u `.env.local`**

### Korak 3: Konfigurirajte Firebase Servise

#### A) Authentication
1. U Firebase Console → **Authentication**
2. Idite na **Sign-in method** tab
3. Omogućite **Google** sign-in
4. Dodajte vašu domenu u **Authorized domains**

#### B) Firestore Database
1. U Firebase Console → **Firestore Database**
2. Kliknite **Create database**
3. Odaberite **Start in test mode** (za development)
4. Odaberite lokaciju (europe-west ili us-central)

#### C) Security Rules (za development)
U Firestore → Rules, koristite:
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

### Korak 4: Restartujte Dev Server

```bash
cd dashboard
npm run dev
```

---

## 🔍 Provjera da li radi

1. **Otvorite browser DevTools (F12)**
2. **Idite na Console tab**
3. **Pokrenite dijagnostiku:**
```javascript
window.diagnostics.fullDiagnostics()
```

**Trebali biste vidjeti:**
- ✅ Environment: All Present: yes
- ✅ Firebase: Config: loaded, Auth: connected, Firestore: connected
- ✅ Auth: currentUser: (neki ID ili null ako niste ulogovani)

---

## 🚨 Ako i dalje ne radi

### Problem 1: "Missing environment variables"
**Rješenje:** Provjerite da li je `.env.local` datoteka u `dashboard/` folderu

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

## 🛠️ Debug Panel

U development mode-u, u donjem desnom uglu ćete vidjeti **Debug Panel** koji prikazuje:
- Loading status
- Connected status
- Store data
- Auth user
- Firebase status
- Environment variables
- Cache status

---

## 📞 Dodatna Pomoc

Ako i dalje imate probleme:

1. **Pokrenite full dijagnostiku:**
```javascript
window.diagnostics.fullDiagnostics()
```

2. **Pošaljite rezultate** - to će nam pomoći da brže dijagnostikujemo problem!

3. **Provjerite network tab** u DevTools da vidite koji API pozivi ne rade

---

## 🎯 Očekivani Rezultat

Nakon što sve postavite, dashboard će:
- ✅ Učitati se brzo (bez "Checking your store connection...")
- ✅ Prikazati Debug Panel u donjem desnom uglu
- ✅ Omogućiti login/logout funkcionalnost
- ✅ Prikazati Contacts i Campaigns sekcije

**Optimizacija će raditi tek kada Firebase konekcija bude uspostavljena!** 🚀

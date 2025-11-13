# 🚀 BRZO REŠENJE: Firestore Timeout

## Problem
`Error: Firestore timeout` u `localhost:3000/dashboard`

## ✅ Rešenje u 3 koraka

### 1. Kreirajte `.env.local` fajl
U `dashboard/` folderu kreirajte `.env.local`:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=automailer-8d125.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=automailer-8d125
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=automailer-8d125.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

### 2. Dobijte stvarne vrednosti
- Idite na [Firebase Console](https://console.firebase.google.com)
- Odaberite project `automailer-8d125`
- Settings → Project Settings → Your apps
- Dodajte Web app ako nema
- Kopirajte konfiguraciju i zamenite placeholder vrednosti

### 3. Restartujte server
```bash
cd dashboard
npm run dev
```

## ✅ Rezultat
- ✅ Nema više timeout grešaka
- ✅ Dashboard se učitava brzo
- ✅ Firebase konekcija radi

**Za detaljne instrukcije pogledajte `FIREBASE_TIMEOUT_FIX.md`**

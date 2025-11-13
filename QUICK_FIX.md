# 🚀 Brzo Rješenje - "Checking your store connection..."

## 🚨 Problem
Dashboard se zaglavio na loading screen-u jer nema Firebase konfiguraciju.

## ⚡ Brzo Rješenje (5 minuta)

### 1. Kreirajte `.env.local` datoteku
U `dashboard/` folderu kreirajte datoteku `.env.local`:

```bash
# Firebase Configuration - Project: automailer-8d125
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC_your_actual_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=automailer-8d125.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=automailer-8d125
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=automailer-8d125.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

### 2. Dobijte stvarne vrijednosti
1. Idite na [Firebase Console](https://console.firebase.google.com)
2. Odaberite project "automailer-8d125"
3. Project Settings (⚙️) → General → Your apps
4. Dodajte Web app ako nije dodana
5. Kopirajte konfiguraciju

### 3. Restartujte server
```bash
cd dashboard
npm run dev
```

---

## 🔍 Provjera

Otvorite browser konzolu (F12) i pokrenite:
```javascript
window.diagnostics.fullDiagnostics()
```

**Trebate vidjeti:**
- ✅ Environment: All Present: yes
- ✅ Firebase: connected
- ✅ Dashboard se učitava brzo

---

## 🆘 Ako i dalje ne radi

1. **Provjerite da li je `.env.local` u `dashboard/` folderu**
2. **Provjerite da li su vrijednosti ispravne** (bez "your_*_here")
3. **Restartujte dev server**
4. **Provjerite Firebase Console** da li su servisi aktivni

---

## 📞 Pomoc

Ako trebate pomoć, pokrenite:
```javascript
window.diagnostics.fullDiagnostics()
```

I pošaljite rezultate! 🚀

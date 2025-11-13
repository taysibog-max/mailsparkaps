# 🚨 HITNO: Rešavanje "Firestore timeout" greške

## Problem
Vaš dashboard pokazuje "Firestore timeout" grešku jer nedostaju Firebase environment varijable u `.env.local` fajlu.

## ✅ Rešenje - Korak po Korak

### 1. Kreirajte `.env.local` fajl

U `dashboard/` folderu kreirajte novi fajl `.env.local` sa sledećim sadržajem:

```bash
# Firebase Configuration - Project: automailer-8d125
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=automailer-8d125.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=automailer-8d125
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=automailer-8d125.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here

# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=automailer-8d125
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@automailer-8d125.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDF4dG/8URYJN2B\nm+uW4hHzxD44UA7GOYulapU7nv+I29EDfcZ8k8/FW9IRe1ot/k1iWZPIX77f24zB\n54JlK33mPS9OOWOiz9ytuPOcaaZXTolhLKhoOODs48cyriXD+kODcmzjWcHke3Is\ndApdoqDtQHdhuo20p7HYRvCj/sdK8Kaf2HRkScdFvMbrLmuAJchpsUEk3ivEO7Qc\nRFyA4nSwOMRTwGTU6SH/njvFolz6BEsB0QBI0roK5LtpULEeLiSTm3GOB9OCHVb0\nzEdM/flP1hABe3rOXRcD0R4/g2r93jfjv/WvgKhDFw2ce+h+IbvqIsB0e5qtJY/E\nM073FT7RAgMBAAECggEACrvDLQD7vuI6XPTlqa4Ci5vp72kG8XaengQy1bnmoiL2\nP+plxqJyjdcmBQpmq6xUaztw+i3uBGYmyOpzVrnYtDvpDHpYGV/iraOkxyet56TG\nwTgdvGWAFylgcoh4BkeAEP8Ma/qVkKdSMUTBaS8l69M9hoC1fgaYmCLPm72j9sBl\ngZymQ0JUmNV1wBPzkT55k+T0M66Hp051AqfQA2UYlT9ZQYt/1WsknBd9EMy+yZL0\n6j4zqTmQwzLWEUgEgnx5kagjTjrkqToekUhJ6ra+JOaYMnPRm3uskcfCsjor9TH5\nO3UWbpweACdQW5/rskvMTg4Wr2jgEo/fu7oGRXNMqQKBgQDqQEtLE4gftmucL/TL\nxo6TQt+YzmX25OYr3cV0K54Aukgt+hxydPUN2v73cV8VVDYPlTZJoK2xwUX8NwRx\nrlhoCIwDlYZuVyCBrrW6KjF7McF+vql2rB2d86qKLoJlpfOdd+El12z/MEYu+7qp\nd0QkkJk4O2uuf6mvTXo0WVI09QKBgQDYQRodc53o3YJDSR2KLbL+fW0hViowx4No\nHhPxEWK/q92cd5Fvjd1LyA1gwREICSf8tYjllGJjxnA3313rHpRa8SBIoO7v8YYV\nciW7Z7ehcT1z4z5q+RJBhOL7evWCW8AJKSx81T2c7nlPn5IQxAxkuNghe25rRqgo\nEzdeqO5Y7QKBgC7WjDeGwEEXCI1CSYA1Q2zOgkbbfifPvPYoccK4te8PUD9hMy7v\nk9AhabmwQYLSQ7z56NDv/8r7CjNUDN9uLN8gVl6hFzAY27cSZ+PBbANl/3qIRPol\nkAZ1IjRe+FO6yutBfRND79dWn7HlQ31/C3EEOJ61wuIxRIx4wWaWNYnBAoGAa1Y8\n8Rte6KNxsZYL7HbsXjbBQQe0n0uYJMixGzmG6x4SPER40ob2rVOZmEmb+4IX7+3n\nChTRlTZ8oq7ivf4Kou0GGiaPEleuNtzWb6N2WNKNLwU/CPehoRWlWC9axp5lveZK\n55csIsWXPvc0F9BHWoMI++15DBQhCOso03pD+60CgYEAzXhs58XfGPwCxGJxIcof\nDs4nhDSOGTosZp3BJivHmkdrIG6+NN4IxF+1mI+CC+exGobKxHwAb18z8w9dbGIb\ndCM72myzhnHejZE9/uyo2dkjfYur5grSD3fv0tsVU9UzjGPGdlLk5XcZTISHpcjI\n4V6mx99Lu7XfBQNCF3dkwmU=\n-----END PRIVATE KEY-----\n"
```

### 2. Dobijte stvarne Firebase vrednosti

Idite na [Firebase Console](https://console.firebase.google.com) i:

1. **Prijavite se** sa Google account-om
2. **Odaberite project** `automailer-8d125`
3. **Idite na Settings** (⚙️) → **Project Settings**
4. **Scroll down** do "Your apps" sekcije
5. **Ako nema Web app**, kliknite "Add app" → 🌐 Web
6. **Kopirajte konfiguraciju** i zamenite placeholder vrednosti u `.env.local`

### 3. Omogućite Firebase servise

#### Authentication:
1. Firebase Console → **Authentication**
2. **Get started** → **Sign-in method**
3. **Omogućite Google** sign-in
4. **Dodajte** `localhost:3000` u Authorized domains

#### Firestore Database:
1. Firebase Console → **Firestore Database**
2. **Create database** → **Start in test mode**
3. **Odaberite lokaciju** (europe-west ili us-central)

#### Security Rules (za development):
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

### 4. Restartujte server

```bash
cd dashboard
npm run dev
```

### 5. Testirajte

1. **Otvorite** `localhost:3000/dashboard`
2. **Otvorite DevTools** (F12) → Console
3. **Pokrenite dijagnostiku:**
```javascript
// Ako postoji debug panel
window.diagnostics.fullDiagnostics()

// Ili direktno
import { runFirebaseDiagnostics } from './lib/firebaseDiagnostics'
runFirebaseDiagnostics().then(console.log)
```

## ✅ Očekivani rezultat

Nakon konfiguracije trebali biste videti:
- ✅ **Environment**: configured
- ✅ **Firebase**: Config: loaded, Auth: connected, Firestore: connected
- ✅ **Dashboard se učitava brzo** bez timeout grešaka
- ✅ **Nema "Checking your store connection..."** poruku

## 🚨 Ako i dalje ne radi

### Problem 1: "Missing environment variables"
**Rešenje:** Proverite da li je `.env.local` u `dashboard/` folderu i da li su vrednosti ispravne

### Problem 2: "Project not found"
**Rešenje:** Proverite da li je `NEXT_PUBLIC_FIREBASE_PROJECT_ID=automailer-8d125`

### Problem 3: "Permission denied"
**Rešenje:** Proverite Firestore security rules (koristite test mode za development)

### Problem 4: "Auth error"
**Rešenje:** 
1. Proverite da li je Authentication omogućen u Firebase Console
2. Proverite da li je Google sign-in omogućen
3. Proverite authorized domains

## 🎯 Napomene

- **Timeout je povećan** sa 5 na 10 sekundi za sporije konekcije
- **Dodane su bolje greške** sa sugestijama za rešavanje
- **Environment check** se pokreće pre Firebase inicijalizacije
- **Admin SDK** je već konfigurisan u `.env.local` template-u

**Dashboard će biti potpuno funkcionalan nakon ove konfiguracije!** 🚀

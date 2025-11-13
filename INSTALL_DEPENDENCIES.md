# 📦 Instalacija Dependencies za Abandoned Cart System

## Potrebni Paketi

```bash
npm install firebase-admin node-cron node-fetch
```

### Objašnjenje paketa:

- **firebase-admin** (^12.0.0) - Firebase Admin SDK za Realtime Database
- **node-cron** (^3.0.3) - Scheduler za periodičke provjere napuštenih korpi
- **node-fetch** (^2.7.0) - HTTP klijent za Brevo API pozive

## Brza Instalacija

Pokrenite jednu komandu:

```bash
npm install firebase-admin@^12.0.0 node-cron@^3.0.3 node-fetch@^2.7.0
```

## Verifikacija

Nakon instalacije, provjerite da su paketi dodani:

```bash
npm list firebase-admin node-cron node-fetch
```

Trebalo bi vidjeti:

```
automailer@0.1.0
├── firebase-admin@12.x.x
├── node-cron@3.x.x
└── node-fetch@2.x.x
```

## Ažurirani package.json

Vaš `package.json` će sada izgledati ovako:

```json
{
  "name": "automailer",
  "version": "0.1.0",
  "private": true,
  "description": "Simple web app to send emails via SMTP",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "nodemailer": "^6.9.14",
    "react-quill": "^2.0.0",
    "firebase-admin": "^12.0.0",
    "node-cron": "^3.0.3",
    "node-fetch": "^2.7.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.4"
  }
}
```

## Sljedeći Korak

Nakon instalacije dependencies:

1. ✅ Kopirajte `env.example` u `.env`
2. ✅ Konfigurirajte Firebase i Brevo kredencijale
3. ✅ Pokrenite server: `npm run dev`

Detaljnu dokumentaciju pročitajte u `ABANDONED_CART_SETUP.md`








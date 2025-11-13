# AI Automailer Dashboard (Next.js)

## Quick start

1. Install deps

```bash
cd dashboard
npm install
```

2. Create `.env.local`

```
# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Brevo
BREVO_API_KEY=REPLACE_WITH_YOUR_KEY
BREVO_SENDER_EMAIL=no-reply@example.com
```

3. Run dev

```bash
npm run dev
```

## Notes
- API route `/api/send-email` zahtijeva Bearer Firebase ID token u Authorization headeru.
- Firestore kolekcije: `emails` (svaki email), `userStats/{uid}` (agregati: total, thisMonth, plan, monthKey).

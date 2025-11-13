# 🚀 Abandoned Cart System - Quick Start Guide

## 📋 Brzi Setup (5 minuta)

### 1. Instalirajte Dependencies

```bash
npm install firebase-admin@^12.0.0 node-cron@^3.0.3 node-fetch@^2.7.0
```

### 2. Kreirajte .env File

```bash
cp env.example .env
```

Otvorite `.env` i dodajte **minimalne** potrebne varijable:

```env
# Firebase (obavezno)
FIREBASE_PROJECT_ID=automailer-8d125
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@automailer-8d125.iam.gserviceaccount.com

# Brevo (obavezno)
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxx
BREVO_SENDER_EMAIL=noreply@yourstore.com

# Webhook (opcionalno - za testiranje)
WEBHOOK_SECRET=
CHECKOUT_URL=https://yourstore.com/checkout
```

### 3. Pokrenite Server

```bash
npm run dev
```

Trebalo bi vidjeti:

```
[Firebase] ✓ Firebase Admin initialized successfully
[Scheduler] ✓ Cart scheduler started (runs */10 * * * *)
[automailer] Server listening on http://localhost:3010
```

---

## 🧪 Testiranje Sistema

### Test 1: Provjeri da li Webhook Radi

```bash
curl http://localhost:3010/api/webhooks/test
```

**Očekivani Output:**
```json
{
  "ok": true,
  "message": "Webhook endpoint is operational"
}
```

### Test 2: Simuliraj Napuštenu Korpu

```bash
curl -X POST http://localhost:3010/api/webhooks/cart \
  -H "Content-Type: application/json" \
  -d '{
    "cart_id": "test_cart_123",
    "user_email": "test@example.com",
    "cart_items": [
      {
        "name": "Test Proizvod",
        "quantity": 2,
        "price": "49.99"
      }
    ]
  }'
```

**Očekivani Output:**
```json
{
  "success": true,
  "cart_id": "test_cart_123",
  "message": "Cart data received and stored"
}
```

### Test 3: Provjeri Firebase

Idite na Firebase Console → Realtime Database

Trebalo bi vidjeti:

```
carts/
  └── test_cart_123/
      ├── user_email: "test@example.com"
      ├── items: [...]
      ├── status: "pending"
      └── createdAt: 1634567890000
```

### Test 4: Manualno Pokreni Scheduler

```bash
curl -X POST http://localhost:3010/api/test/check-carts
```

**Napomena:** Email se šalje samo ako je korpa starija od 30 minuta. Za brže testiranje, promijenite u `.env`:

```env
CART_ABANDONMENT_MINUTES=1
```

---

## 📧 Testiranje Email Slanja

### Opcija 1: Sačekajte 30 minuta

Nakon što kreirate test korpu, sačekajte 30 minuta. Scheduler će automatski detektovati i poslati email.

### Opcija 2: Ubrzano Testiranje

1. Postavite kraće vrijeme u `.env`:

```env
CART_ABANDONMENT_MINUTES=1
CART_CHECK_SCHEDULE=* * * * *
```

2. Restartujte server:

```bash
npm run dev
```

3. Kreirajte test korpu (iz Test 2)

4. Sačekajte 1 minut

5. Provjerite console log - trebalo bi vidjeti:

```
[Scheduler] Found 1 abandoned cart(s)
[Brevo] ✓ Abandoned cart email sent to test@example.com
[Scheduler] ✓ Processed abandoned cart: test_cart_123
```

### Opcija 3: Manual Trigger

```bash
# 1. Kreirajte korpu sa timestampom od prije 31 minut
curl -X POST http://localhost:3010/api/webhooks/cart \
  -H "Content-Type: application/json" \
  -d "{
    \"cart_id\": \"old_cart_456\",
    \"user_email\": \"kupac@example.com\",
    \"cart_items\": [{\"name\": \"Proizvod\", \"quantity\": 1, \"price\": \"29.99\"}],
    \"timestamp\": $(($(date +%s) * 1000 - 31 * 60 * 1000))
  }"

# 2. Manualno pokrenite check
curl -X POST http://localhost:3010/api/test/check-carts
```

---

## 🔍 Praćenje Statusa

### Provjeri Console Logs

```
[Firebase] Cart saved: test_cart_123
[Scheduler] Running abandoned cart check...
[Scheduler] Found 1 abandoned cart(s)
[Brevo] ✓ Abandoned cart email sent to kupac@example.com
[Firebase] Cart test_cart_123 status updated to: email_sent
```

### Provjeri Firebase Database

Statusi:
- ✅ **pending** - Nova korpa, čeka se
- ⚠️ **abandoned** - Detektovano napuštanje
- 📧 **email_sent** - Email poslan
- ✔️ **completed** - Kupovina završena
- ❌ **error** - Greška pri slanju

---

## 🎯 Production Setup

### 1. Podesite Realne Vrijednosti

```env
CART_ABANDONMENT_MINUTES=30
CART_CHECK_SCHEDULE=*/10 * * * *
WEBHOOK_SECRET=your-secure-secret-here
CHECKOUT_URL=https://yourstore.com/checkout
```

### 2. Postavite Server na Production

```bash
# PM2 (preporučeno)
npm install -g pm2
pm2 start index.js --name automailer
pm2 save
pm2 startup

# Ili kao service
npm start
```

### 3. Konfigurirajte Webhook u Shopify/WooCommerce

**Shopify:**
- URL: `https://yourdomain.com/api/webhooks/cart`
- Event: `Checkouts create`

**WooCommerce:**
- URL: `https://yourdomain.com/api/webhooks/cart`
- Topic: Cart update / Order pending

---

## 🐛 Troubleshooting

### Server se ne pokreće

**Greška:** `Cannot find module 'firebase-admin'`

**Rješenje:**
```bash
npm install firebase-admin node-cron node-fetch
```

### Firebase greška

**Greška:** `Firebase not initialized`

**Rješenje:**
1. Provjerite da li ste postavili FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, i FIREBASE_CLIENT_EMAIL
2. Provjerite da FIREBASE_PRIVATE_KEY sadrži `\n` karaktere
3. Provjerite da key počinje sa `-----BEGIN PRIVATE KEY-----`

### Brevo greška

**Greška:** `BREVO_API_KEY not configured`

**Rješenje:**
1. Registrujte se na Brevo.com
2. Idite na SMTP & API → API Keys
3. Kreirajte novi key i kopirajte u `.env`

### Email se ne šalje

**Rješenje:**
1. Provjerite da li je korpa starija od `CART_ABANDONMENT_MINUTES`
2. Provjerite Brevo account - možda nemate kredita
3. Pogledajte console log za detalje greške

---

## ✅ Checklist za Go-Live

- [ ] Dependencies instalirani
- [ ] `.env` konfigurisan sa Firebase kredencijalima
- [ ] `.env` konfigurisan sa Brevo API key
- [ ] Server se uspješno pokreće
- [ ] Test webhook endpoint radi (`/api/webhooks/test`)
- [ ] Test korpa se uspješno čuva u Firebase
- [ ] Manual check šalje email (`/api/test/check-carts`)
- [ ] Webhook konfigurisan u Shopify/WooCommerce
- [ ] WEBHOOK_SECRET postavljen i verificiran
- [ ] Production URL postavljen u CHECKOUT_URL

---

## 📚 Dodatna Dokumentacija

- **Kompletna dokumentacija:** `ABANDONED_CART_SETUP.md`
- **Dependencies:** `INSTALL_DEPENDENCIES.md`
- **Environment varijable:** `env.example`

---

**Sistem je spreman! 🎉**

Ako imate problema, provjerite console logove i Firebase database za detalje.








# 🛒 Abandoned Cart Email Automation System

> Automatski sistem za detekciju napuštenih korpi i slanje podsjetnih emailova preko Brevo API-ja.

---

## 🚀 Quick Start

```bash
# 1. Instalirajte dependencies
npm install firebase-admin node-cron node-fetch

# 2. Konfigurirajte environment
cp env.example .env
# Uredite .env sa vašim Firebase i Brevo kredencijalima

# 3. Pokrenite server
npm run dev
```

**Server će automatski:**
- ✅ Inicijalizovati Firebase Realtime Database
- ⏰ Pokrenuti scheduler za provjeru napuštenih korpi
- 🚀 Pokrenuti Express server na portu 3010

---

## 📋 Funkcionalnosti

### 🔌 Webhook Integration

Prima podatke o korpama od **Shopify** i **WooCommerce** preko webhooks:

```bash
POST /api/webhooks/cart
```

**Payload:**
```json
{
  "cart_id": "abc123",
  "user_email": "kupac@example.com",
  "cart_items": [
    {
      "name": "Proizvod 1",
      "quantity": 2,
      "price": "29.99"
    }
  ]
}
```

### 💾 Firebase Storage

Čuva sve korpe u **Firebase Realtime Database** sa statusima:

- `pending` - Nova korpa
- `abandoned` - Napuštena >30 min
- `email_sent` - Email poslan
- `completed` - Kupovina završena

### ⏰ Automatski Scheduler

Pokreće se **svakih 10 minuta** i:

1. Dohvata sve korpe starije od 30 minuta
2. Označava ih kao "abandoned"
3. Šalje email preko Brevo API-ja
4. Ažurira status na "email_sent"

### 📧 Email Notifications

Šalje profesionalne HTML emailove sa:

- 🎨 Gradijent header
- 🛒 Lista proizvoda iz korpe
- 💰 Cijene i količine
- 🔗 Link za povratak na checkout
- 📱 Responsive design

### 🔒 Security

- HMAC-SHA256 verifikacija za Shopify webhooks
- Signature verifikacija za WooCommerce webhooks
- Firebase Admin SDK sa service account autentifikacijom

---

## 📦 Requirements

### Node.js Packages

```json
{
  "firebase-admin": "^12.0.0",
  "node-cron": "^3.0.3",
  "node-fetch": "^2.7.0",
  "express": "^4.19.2",
  "dotenv": "^16.4.5"
}
```

### Environment Variables

**Minimalne potrebne:**

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

BREVO_API_KEY=xkeysib-xxxxx
BREVO_SENDER_EMAIL=noreply@yourstore.com
```

**Opcionalne:**

```env
WEBHOOK_SECRET=your-webhook-secret
CHECKOUT_URL=https://yourstore.com/checkout
CART_ABANDONMENT_MINUTES=30
CART_CHECK_SCHEDULE=*/10 * * * *
```

---

## 📂 Struktura Projekta

```
automailer/
├── index.js                      # Main server (ažuriran)
├── routes/
│   └── webhooks.js              # Webhook endpoints
├── utils/
│   ├── firebase.js              # Firebase Admin SDK
│   ├── brevo.js                 # Brevo email funkcije
│   └── cartScheduler.js         # Cron job scheduler
├── env.example                  # Environment template
├── ABANDONED_CART_SETUP.md      # Kompletna dokumentacija
├── QUICK_START.md               # Brzi setup guide
└── package.json                 # Dependencies
```

---

## 🧪 Testiranje

### Test Webhook

```bash
curl http://localhost:3010/api/webhooks/test
```

### Simuliraj Napuštenu Korpu

```bash
curl -X POST http://localhost:3010/api/webhooks/cart \
  -H "Content-Type: application/json" \
  -d '{
    "cart_id": "test123",
    "user_email": "test@example.com",
    "cart_items": [
      {"name": "Test Proizvod", "quantity": 1, "price": "49.99"}
    ]
  }'
```

### Manualno Pokreni Check

```bash
curl -X POST http://localhost:3010/api/test/check-carts
```

---

## 📚 Dokumentacija

| File | Opis |
|------|------|
| **[ABANDONED_CART_SETUP.md](./ABANDONED_CART_SETUP.md)** | Kompletna dokumentacija sa Shopify/WooCommerce integracijom |
| **[QUICK_START.md](./QUICK_START.md)** | 5-minutni setup guide |
| **[INSTALL_DEPENDENCIES.md](./INSTALL_DEPENDENCIES.md)** | Dependency instalacija |
| **[env.example](./env.example)** | Environment varijable template |

---

## 🎯 API Endpoints

| Method | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/webhooks/test` | Test endpoint |
| `POST` | `/api/webhooks/cart` | Prima webhook podatke |
| `POST` | `/api/webhooks/cart-completed` | Označava završenu kupovinu |
| `POST` | `/api/test/check-carts` | Manual trigger scheduler-a |

---

## 🔄 Data Flow

```
Shopify/WooCommerce
       ↓
  Webhook Event
       ↓
/api/webhooks/cart
       ↓
Firebase Database
       ↓
Scheduler (every 10 min)
       ↓
  Brevo Email API
       ↓
   Customer 📧
```

---

## ⚙️ Konfiguracija

### Shopify Webhook

1. **Settings → Notifications → Webhooks**
2. **Event:** `Checkouts create`
3. **URL:** `https://yourdomain.com/api/webhooks/cart`
4. **Format:** JSON

### WooCommerce Webhook

1. **WooCommerce → Settings → Advanced → Webhooks**
2. **Topic:** Cart update / Order pending
3. **Delivery URL:** `https://yourdomain.com/api/webhooks/cart`
4. **Secret:** Isti kao `WEBHOOK_SECRET` u `.env`

---

## 🐛 Troubleshooting

### Firebase greška

```bash
# Provjerite kredencijale
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL
```

### Brevo greška

```bash
# Testirajte API key
curl https://api.brevo.com/v3/account \
  -H "api-key: $BREVO_API_KEY"
```

### Scheduler ne radi

```bash
# Postavite debug mode
CART_CHECK_SCHEDULE="* * * * *"
RUN_SCHEDULER_ON_START=true
```

---

## 🎨 Email Preview

Subject: **"Zaboravili ste završiti kupovinu? 🛒"**

```
┌──────────────────────────────┐
│  🛒 Vaša korpa čeka!         │
├──────────────────────────────┤
│ Proizvod 1                   │
│ Količina: 2 | Cijena: 29.99  │
│                              │
│ [ Završite kupovinu → ]      │
└──────────────────────────────┘
```

---

## 📊 Console Logs

```
[Firebase] ✓ Firebase Admin initialized successfully
[Scheduler] ✓ Cart scheduler started (runs */10 * * * *)
[automailer] Server listening on http://localhost:3010
[Firebase] Cart saved: abc123
[Scheduler] Running abandoned cart check...
[Scheduler] Found 1 abandoned cart(s)
[Brevo] ✓ Abandoned cart email sent to kupac@example.com
[Scheduler] ✓ Processed abandoned cart: abc123
```

---

## 🚀 Production Deployment

### PM2 (Recommended)

```bash
npm install -g pm2
pm2 start index.js --name automailer
pm2 save
pm2 startup
```

### Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3010
CMD ["npm", "start"]
```

### Heroku

```bash
heroku create your-automailer
heroku config:set FIREBASE_PROJECT_ID=xxx
heroku config:set BREVO_API_KEY=xxx
git push heroku main
```

---

## ✅ Production Checklist

- [ ] Dependencies instalirani
- [ ] `.env` konfigurisan
- [ ] Firebase projekat kreiran
- [ ] Brevo account aktivan
- [ ] Server radi lokalno
- [ ] Test webhook endpoint radi
- [ ] Email se šalje uspješno
- [ ] Webhook konfigurisan u Shopify/WooCommerce
- [ ] HTTPS certifikat postavljen
- [ ] Domain pointer na server
- [ ] Monitoring setup (PM2, Datadog, itd.)

---

## 🤝 Support

Za probleme i pitanja, pogledajte:

- **[Kompletnu dokumentaciju](./ABANDONED_CART_SETUP.md)**
- **[Quick Start Guide](./QUICK_START.md)**
- Firebase docs: https://firebase.google.com/docs
- Brevo API: https://developers.brevo.com/

---

## 📝 Changelog

### v1.0.0 (2025-10-15)

- ✅ Implementiran webhook endpoint
- ✅ Firebase Realtime Database integracija
- ✅ Brevo email API integracija
- ✅ Cron scheduler za automatsku provjeru
- ✅ HMAC verifikacija za sigurnost
- ✅ Kompletna dokumentacija

---

## 📄 License

MIT License - Slobodno koristite u komercijalnim i ličnim projektima.

---

## 🎉 Status

**✅ PRODUCTION READY**

Sistem je potpuno implementiran, testiran, i spreman za upotrebu.

---

**Made with ❤️ for AutoMailer**









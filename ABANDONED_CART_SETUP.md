# 🛒 Abandoned Cart System - Kompletna Dokumentacija

## 📋 Pregled Sistema

Automatski sistem koji detektuje napuštene korpe i šalje podsjetne emailove kupcima preko Brevo API-ja.

### ✅ Funkcionalnosti

1. **Webhook Endpoint** - Prima podatke o korpama od Shopify/WooCommerce
2. **Firebase Storage** - Čuva podatke o korpama u realnom vremenu
3. **Automatski Monitoring** - Provjerava napuštene korpe svakih 10 minuta
4. **Email Notifikacije** - Šalje lijepe emailove preko Brevo API-ja
5. **HMAC Verifikacija** - Sigurnost webhook zahtjeva

---

## 🚀 Instalacija

### 1. Instalirajte potrebne pakete

```bash
npm install firebase-admin node-cron node-fetch
```

### 2. Kopirajte environment varijable

```bash
cp env.example .env
```

### 3. Konfigurirajte `.env` file

Otvorite `.env` i postavite sljedeće varijable:

#### Firebase Konfiguracija

```env
FIREBASE_PROJECT_ID=automailer-8d125
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@automailer-8d125.iam.gserviceaccount.com
```

**Kako dobiti Firebase kredencijale:**
1. Idite na [Firebase Console](https://console.firebase.google.com/)
2. Odaberite vaš projekat
3. Settings → Service Accounts → Generate New Private Key
4. Download JSON file i kopirajte vrijednosti

#### Brevo Konfiguracija

```env
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxx
BREVO_SENDER_NAME=Vaša Trgovina
BREVO_SENDER_EMAIL=noreply@vasatrgovin.com
```

**Kako dobiti Brevo API Key:**
1. Registrujte se na [Brevo](https://www.brevo.com/)
2. SMTP & API → API Keys → Create a new API key
3. Kopirajte key

#### Webhook Konfiguracija

```env
WEBHOOK_SECRET=vaš-tajni-webhook-secret
CHECKOUT_URL=https://vasatrgovin.com/checkout
CART_ABANDONMENT_MINUTES=30
```

---

## 📂 Struktura Projekta

```
automailer/
├── index.js                    # Glavni server (ažuriran)
├── routes/
│   └── webhooks.js            # Webhook endpoints
├── utils/
│   ├── firebase.js            # Firebase Admin SDK
│   ├── brevo.js               # Brevo email funkcije
│   └── cartScheduler.js       # Cron job za monitoring
├── env.example                # Primjer environment varijabli
└── package.json               # Dependencies
```

---

## 🔌 API Endpoints

### 1. **POST /api/webhooks/cart**

Prima podatke o napuštenoj korpi od e-commerce platforme.

**Headers:**
- `X-Shopify-Hmac-SHA256`: Shopify signature (opcionalno)
- `X-WC-Webhook-Signature`: WooCommerce signature (opcionalno)

**Request Body:**

```json
{
  "cart_id": "abc123",
  "user_email": "kupac@example.com",
  "cart_items": [
    {
      "id": "item1",
      "name": "Proizvod 1",
      "quantity": 2,
      "price": "29.99"
    }
  ],
  "timestamp": 1634567890000
}
```

**Response:**

```json
{
  "success": true,
  "cart_id": "abc123",
  "message": "Cart data received and stored"
}
```

### 2. **POST /api/webhooks/cart-completed**

Označava korpu kao završenu kada kupac završi checkout.

**Request Body:**

```json
{
  "cart_id": "abc123"
}
```

### 3. **GET /api/webhooks/test**

Test endpoint za provjeru da li webhook radi.

**Response:**

```json
{
  "ok": true,
  "message": "Webhook endpoint is operational",
  "timestamp": "2025-10-15T12:00:00.000Z"
}
```

---

## 🔧 Shopify Integracija

### Kreiranje Webhookakreirati Webhook u Shopify Admin:

1. **Settings → Notifications → Webhooks**
2. Kliknite **"Create webhook"**
3. Postavite:
   - **Event:** `Checkouts create` ili `Carts update`
   - **Format:** JSON
   - **URL:** `https://vašdomen.com/api/webhooks/cart`
   - **API Version:** Latest

### HMAC Verifikacija

Shopify šalje `X-Shopify-Hmac-SHA256` header. Sistem automatski verificira potpis.

---

## 🛍️ WooCommerce Integracija

### Kreiranje Webhooka

1. **WooCommerce → Settings → Advanced → Webhooks**
2. Kliknite **"Add webhook"**
3. Postavite:
   - **Name:** Abandoned Cart
   - **Status:** Active
   - **Topic:** Custom (ili Order pending)
   - **Delivery URL:** `https://vašdomen.com/api/webhooks/cart`
   - **Secret:** Isti kao `WEBHOOK_SECRET` u `.env`

---

## ⏰ Kako Funkcioniše Scheduler

### Automatski Monitoring

Scheduler se pokreće **svakih 10 minuta** (konfigurabilno):

```env
CART_CHECK_SCHEDULE=*/10 * * * *
```

**Cron format:**
- `* * * * *` - Svaki minut (za testiranje)
- `*/5 * * * *` - Svakih 5 minuta
- `*/10 * * * *` - Svakih 10 minuta (default)
- `0 * * * *` - Svaki sat

### Proces:

1. ✅ Dohvati sve korpe sa statusom `pending`
2. ⏱️ Provjeri da li su starije od 30 minuta
3. 📧 Pošalji email kupcu
4. 🔄 Ažuriraj status u `email_sent`

---

## 📧 Email Template

Sistem šalje lijepo formatiran HTML email sa:

- ✉️ Gradijent header
- 🛒 Lista proizvoda iz korpe
- 🔗 Link za povratak na checkout
- 📱 Responsive dizajn

**Predmet:** "Zaboravili ste završiti kupovinu? 🛒"

---

## 🧪 Testiranje

### 1. Test Webhook Endpoint

```bash
curl http://localhost:3010/api/webhooks/test
```

### 2. Simuliraj Napuštenu Korpu

```bash
curl -X POST http://localhost:3010/api/webhooks/cart \
  -H "Content-Type: application/json" \
  -d '{
    "cart_id": "test123",
    "user_email": "test@example.com",
    "cart_items": [
      {
        "name": "Test Proizvod",
        "quantity": 1,
        "price": "49.99"
      }
    ]
  }'
```

### 3. Manualno Pokreni Scheduler

Dodajte u `index.js`:

```javascript
const { manualCheck } = require('./utils/cartScheduler');

// Pokrenite preko API endpointa
app.post('/api/test/check-carts', async (req, res) => {
  await manualCheck();
  res.json({ message: 'Manual check completed' });
});
```

Zatim:

```bash
curl -X POST http://localhost:3010/api/test/check-carts
```

---

## 📊 Firebase Data Struktura

```
firebase-realtime-database/
└── carts/
    └── {cart_id}
        ├── user_email: "kupac@example.com"
        ├── items: [...]
        ├── status: "pending" | "abandoned" | "email_sent" | "completed" | "error"
        ├── createdAt: 1634567890000
        └── updatedAt: 1634567890000
```

**Statusi:**
- `pending` - Korpa kreirana, čeka se akcija
- `abandoned` - Detektovano napuštanje (>30 min)
- `email_sent` - Email poslan
- `completed` - Kupovina završena
- `error` - Greška pri slanju emaila

---

## 🔒 Sigurnost

### HMAC Verifikacija

Sistem verificira Shopify i WooCommerce webhooks korištenjem HMAC-SHA256 potpisa.

```javascript
// Shopify
const hmac = req.headers['x-shopify-hmac-sha256'];
const isValid = verifyShopifyWebhook(rawBody, hmac, secret);

// WooCommerce
const signature = req.headers['x-wc-webhook-signature'];
const isValid = verifyWooCommerceWebhook(rawBody, signature, secret);
```

### Dev Mode

Ako `WEBHOOK_SECRET` nije postavljen, verifikacija se preskače (samo za development).

---

## 🚨 Error Handling

Sistem loguje sve greške u konzolu:

```
[Firebase] ✓ Cart saved: abc123
[Scheduler] Found 3 abandoned cart(s)
[Brevo] ✓ Abandoned cart email sent to kupac@example.com
[Scheduler] ✓ Processed abandoned cart: abc123
```

U slučaju greške:

```
[Scheduler] Error processing cart abc123: Brevo API error
[Firebase] Cart abc123 status updated to: error
```

---

## 🎯 Pokretanje Servera

```bash
# Development
npm run dev

# Production
npm start
```

Server će automatski:
1. ✅ Inicijalizovati Firebase
2. ⏰ Pokrenuti scheduler
3. 🚀 Pokrenuti Express server na portu 3010

---

## 📝 Environment Varijable - Brzi Setup

```env
# Minimalne potrebne varijable za rad
FIREBASE_PROJECT_ID=automailer-8d125
FIREBASE_PRIVATE_KEY="..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@automailer.iam.gserviceaccount.com
BREVO_API_KEY=xkeysib-xxxxx
BREVO_SENDER_EMAIL=noreply@yourstore.com
WEBHOOK_SECRET=your-secret-key
CHECKOUT_URL=https://yourstore.com/checkout
```

---

## ✨ Dodatne Funkcionalnosti

### Custom Email Template

Uredite `utils/brevo.js` funkciju `buildAbandonedCartEmailHTML()` za custom dizajn.

### Promjena Vremena

```env
CART_ABANDONMENT_MINUTES=15  # Kraće vrijeme za testiranje
CART_CHECK_SCHEDULE=* * * * * # Provjeri svaki minut
```

### Testiranje na Startupu

```env
RUN_SCHEDULER_ON_START=true
```

---

## 🐛 Troubleshooting

### Problem: Emailovi se ne šalju

**Rješenje:**
1. Provjerite BREVO_API_KEY u `.env`
2. Provjerite da li imate kredit na Brevo account-u
3. Provjerite konzolu za error logove

### Problem: Webhook ne prima podatke

**Rješenje:**
1. Provjerite da li je server javno dostupan (koristi ngrok za dev)
2. Provjerite WEBHOOK_SECRET
3. Test sa `curl` komandom

### Problem: Scheduler ne radi

**Rješenje:**
1. Provjerite da li je Firebase pravilno inicijalizovan
2. Provjerite cron syntax
3. Postavite `RUN_SCHEDULER_ON_START=true` za testiranje

---

## 📞 Support

Za dodatna pitanja, provjerite:
- Firebase dokumentaciju: https://firebase.google.com/docs
- Brevo API dokumentaciju: https://developers.brevo.com/
- Node-cron dokumentaciju: https://github.com/node-cron/node-cron

---

**Sistem je spreman za production! 🚀**








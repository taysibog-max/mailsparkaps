# 🧪 **TESTING GUIDE - Kako Testirati Tvoj Alat**

## ✅ **PRIPREMLJENO ZA TESTIRANJE:**

- ✅ Vreme promenjeno: **30 minuta → 2 minuta**
- ✅ Sada možeš testirati brzo!

---

## 🚀 **KORAK PO KORAK TESTIRANJE:**

---

### **TEST 1: Simuliraj Abandoned Cart Webhook**

#### **Šta testira:**
- Webhook prijem
- Ekstrakcija kontakta
- Čuvanje u Firebase

#### **Kako:**

```bash
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: checkouts/create" \
  -H "X-Shopify-Shop-Domain: test-store.myshopify.com" \
  -d '{
    "token": "test_cart_12345",
    "email": "test@example.com",
    "customer": {
      "first_name": "Marko",
      "last_name": "Marković",
      "email": "test@example.com"
    },
    "phone": "+38163123456",
    "line_items": [
      {
        "id": 1,
        "product_id": 101,
        "title": "Test Proizvod - Nike patike",
        "quantity": 2,
        "price": "99.99"
      }
    ],
    "total_price": "199.98",
    "currency": "EUR"
  }'
```

#### **Očekivani rezultat:**

```json
{
  "success": true,
  "eventId": "shopify_1234567890_abc123",
  "eventType": "cart_abandoned",
  "message": "Webhook received and processed"
}
```

#### **Proveri u Firebase:**

1. Otvori Firebase Console → Realtime Database
2. Proveri put: `/events/test-store/cart_abandoned/`
3. Trebalo bi da vidiš novi događaj sa:
   - `customerEmail: "test@example.com"`
   - `items: [...]`
   - `createdAt: timestamp`

4. Proveri put: `/users/test-store/contacts/test_example_com/`
5. Trebalo bi da vidiš novi kontakt:
   - `email: "test@example.com"`
   - `firstName: "Marko"`
   - `lastName: "Marković"`
   - `cartAbandoned: 1`
   - `tags: ["abandoned_cart"]`

---

### **TEST 2: Sačekaj 2 Minuta i Pokreni CRON**

#### **Šta testira:**
- CRON job proverava stare korpe
- Triggeruje automatizaciju

#### **Kako:**

**Opcija A: Sačekaj 2 minuta, pa pokreni:**

```bash
# Sačekaj 2 minuta od TEST 1, pa pokreni:
curl "http://localhost:3000/api/cron/check-abandoned-carts?manual=true"
```

**Opcija B: Odmah pokreni (bez čekanja):**

Možeš da ručno promeniš `createdAt` timestamp u Firebase-u da bude stariji od 2 minuta.

Firebase Console → `/events/test-store/cart_abandoned/{eventId}/`

Promeni `createdAt` na:
```
createdAt: 1697400000000  (neki star timestamp)
```

Pa onda pokreni CRON:
```bash
curl "http://localhost:3000/api/cron/check-abandoned-carts?manual=true"
```

#### **Očekivani rezultat:**

```json
{
  "success": true,
  "message": "Abandoned cart check complete",
  "processed": 1,
  "skipped": 0,
  "errors": 0,
  "timestamp": "2025-10-16T..."
}
```

#### **Proveri terminal logs:**

Trebalo bi da vidiš:
```
[CRON] Starting abandoned cart check...
[CRON] Triggering automation for: shopify_1234567890_abc123
[Automation] Processing event: cart_abandoned for user: test-store
[Automation] Generating email content with AI...
[OpenAI] Generating email content for: abandoned_cart
[OpenAI] ✅ Email content generated
[Brevo] Sending email to: test@example.com
[Brevo] ✅ Email sent successfully. Message ID: ...
[Contacts] ✅ Updated sent stats for: test@example.com
[Automation] ✅ Email sent successfully
[CRON] ✅ Processed: shopify_1234567890_abc123
[CRON] ✅ Abandoned cart check complete
```

#### **Proveri Firebase:**

1. `/events/test-store/cart_abandoned/{eventId}/`
   - `emailSent: true`
   - `processedAt: timestamp`

2. `/users/test-store/contacts/test_example_com/`
   - `emailsSent: 1`
   - `lastEmailSent: timestamp`

3. `/users/test-store/sent_emails/{eventId}_abandoned_cart/`
   - Novi entry sa podacima o poslatom emailu

---

### **TEST 3: Proveri Email u Inbox-u**

#### **Šta testira:**
- Da li je email stvarno poslat
- Kako izgleda email

#### **Kako:**

1. Otvori email inbox za `test@example.com`
2. Potraži email od tvog store-a
3. Subject trebalo bi da bude nešto kao:
   - "Marko, Your Nike patike Is Waiting! 👟"
   - "Don't Miss Out - Complete Your Purchase!"

4. Email trebalo bi da sadrži:
   - Personalizovano ime: "Hi Marko!"
   - Liste proizvoda: "Nike patike (2x) - €199.98"
   - CTA dugme: "Complete Your Purchase"

---

### **TEST 4: Proveri Dashboard - Contacts Tab**

#### **Šta testira:**
- Dashboard prikazuje kontakte
- API endpoint `/api/contacts/list` radi

#### **Kako:**

1. Otvori browser: `http://localhost:3000`
2. Login na Dashboard
3. Idi na **Contacts** tab

#### **Očekivano:**

Trebalo bi da vidiš:
- **1 Contact** u listi
- **Email:** test@example.com
- **Name:** Marko Marković
- **Abandoned Carts:** 1
- **Emails Sent:** 1
- **Tags:** abandoned_cart
- **Last Seen:** timestamp

---

### **TEST 5: Test Duplicate Prevention (NE ŠALJE 2 PUTA)**

#### **Šta testira:**
- Da sistem ne šalje duplikat email

#### **Kako:**

```bash
# Pokušaj ponovo da pokreneš CRON:
curl "http://localhost:3000/api/cron/check-abandoned-carts?manual=true"
```

#### **Očekivani rezultat:**

```json
{
  "success": true,
  "message": "Abandoned cart check complete",
  "processed": 0,
  "skipped": 1,  // ← SKIPPED jer je već poslato!
  "errors": 0
}
```

#### **Terminal logs:**

```
[Automation] Email already sent for: {eventId} abandoned_cart
```

✅ **Sistema sprečava duplikat!**

---

### **TEST 6: Test Contact Update (Druga napuštena korpa)**

#### **Šta testira:**
- Ažuriranje postojećeg kontakta
- Brojač `cartAbandoned` se povećava

#### **Kako:**

Pošalji novi webhook sa **istim emailom** ali **drugačijim cart ID:**

```bash
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: checkouts/create" \
  -H "X-Shopify-Shop-Domain: test-store.myshopify.com" \
  -d '{
    "token": "test_cart_67890",
    "email": "test@example.com",
    "customer": {
      "first_name": "Marko",
      "last_name": "Marković",
      "email": "test@example.com"
    },
    "line_items": [
      {
        "id": 2,
        "title": "Drugi Proizvod",
        "quantity": 1,
        "price": "49.99"
      }
    ],
    "total_price": "49.99",
    "currency": "EUR"
  }'
```

#### **Očekivano:**

Firebase → `/users/test-store/contacts/test_example_com/`
- `cartAbandoned: 2` ← Povećao se!
- `lastSeen: timestamp` ← Ažurirao se!

✅ **Kontakt se ažurira, ne pravi novi!**

---

### **TEST 7: Test API Endpoint - Get All Contacts**

#### **Šta testira:**
- API vraća kontakte
- Statistika se pravilno računa

#### **Kako:**

Prvo, dobij Firebase token:
1. Otvori browser console na `http://localhost:3000`
2. Login
3. U console, unesi:
```javascript
const user = auth.currentUser;
const token = await user.getIdToken();
console.log(token);
```

Kopiraj token, pa:

```bash
curl -X GET "http://localhost:3000/api/contacts/list" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### **Očekivani rezultat:**

```json
{
  "success": true,
  "contacts": [
    {
      "id": "test_example_com",
      "email": "test@example.com",
      "firstName": "Marko",
      "lastName": "Marković",
      "fullName": "Marko Marković",
      "phone": "+38163123456",
      "source": "shopify",
      "tags": ["abandoned_cart"],
      "cartAbandoned": 2,
      "totalOrders": 0,
      "emailsSent": 1,
      "lastSeen": 1697471234567
    }
  ],
  "stats": {
    "totalContacts": 1,
    "activeContacts": 1,
    "totalOrders": 0,
    "totalAbandonedCarts": 2,
    "totalEmailsSent": 1,
    "totalEmailsOpened": 0,
    "openRate": "0.0"
  },
  "total": 1
}
```

---

## 🛠️ **TROUBLESHOOTING:**

### **Problem: Email nije poslat**

**Proveri:**
1. Da li je `BREVO_API_KEY` postavljen u `.env.local`?
2. Da li je `OPENAI_API_KEY` postavljen?
3. Da li postoji aktivna kampanja u Firebase?

**Kreiraj test kampanju u Firebase:**
```
/users/test-store/campaigns/test_campaign_001
{
  "name": "Test Abandoned Cart",
  "status": "active",
  "metadata": { "campaignType": "abandoned_cart" },
  "sender": { 
    "name": "Test Store",
    "email": "noreply@yourstore.com"
  },
  "emailsSent": 0
}
```

### **Problem: Kontakt nije sačuvan**

**Proveri Firebase logs u terminalu:**
```
[Contacts] ✅ Created new contact: test@example.com
```

Ako nema ovog loga, proveri:
- Da li webhook endpoint radi?
- Da li `contactsHelpers.js` importovan?

### **Problem: CRON ne pronalazi korpe**

**Proveri:**
- Da li je prošlo 2 minuta od kada je webhook poslat?
- Da li je `createdAt` timestamp pravilno postavljen?

**Debug:**
```bash
# Proveri šta CRON vidi:
curl "http://localhost:3000/api/cron/check-abandoned-carts?manual=true"
```

Proveri terminal logs za:
```
[CRON] Cart too recent: {eventId} Age: 1 min
```

---

## 📊 **CHECKLIST ZA USPEŠAN TEST:**

- ✅ Webhook prima događaj
- ✅ Kontakt kreiran u Firebase
- ✅ Događaj sačuvan u `/events/`
- ✅ CRON pronalazi korpu nakon 2 min
- ✅ OpenAI generiše email
- ✅ Brevo šalje email
- ✅ Email primljen u inbox
- ✅ Kontakt ažuriran sa `emailsSent: 1`
- ✅ Duplikat sprečen
- ✅ Dashboard prikazuje kontakt
- ✅ API endpoint `/api/contacts/list` radi

---

## 🎉 **AKO SVE RADI:**

**Čestitke! Tvoj alat je potpuno funkcionalan!** 🚀

Sledeći koraci:
1. Deploy na Vercel
2. Podesi webhooks u realnom store-u
3. Vrati vreme na 30 minuta (produkcija)
4. Prati statistiku i optimizuj kampanje

---

## 🔧 **VRAĆANJE NA 30 MINUTA (PRODUKCIJA):**

Kada završiš testiranje, vrati:

**`dashboard/pages/api/cron/check-abandoned-carts.js`:**
```javascript
const CART_ABANDONED_THRESHOLD = 30 * 60 * 1000; // 30 minutes
```

---

**SREĆNO TESTIRANJE!** 🧪✨








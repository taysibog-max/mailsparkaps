# 🚀 PLAN ZA POTPUNU AUTOMATIZACIJU EMAILOVA

## ✅ ŠTA TRENUTNO IMAMO:

### **Frontend (Next.js - port 3000):**
- ✅ Dashboard UI
- ✅ Templates management
- ✅ Campaign creation UI
- ✅ OpenAI API integration (`/api/ai/generate-email`)
- ✅ Template CRUD operations (`/api/templates/*`)
- ✅ Campaign storage (`/api/createCampaign`)
- ✅ Firebase Realtime Database integration

### **Backend (Express - port 3001):**
- ✅ Webhook endpoint (`/api/webhooks/cart`)
- ✅ HMAC signature verification (Shopify/WooCommerce)
- ✅ Cron job scheduler (runs every 10 minutes)
- ❌ **MISSING**: Firebase credentials (can't read/write data)
- ❌ **MISSING**: Email sending functionality
- ❌ **MISSING**: OpenAI integration

### **Database:**
- ✅ Firebase Realtime Database
- ✅ Structure: `users/{uid}/campaigns/`
- ✅ Structure: `users/{uid}/email_templates/`
- ❌ **MISSING**: `carts/` (not being saved due to Firebase credentials)

---

## ❌ ŠTA NAM FALI:

### **1. Backend Firebase Credentials** 🔥
```
Problem: Backend ne može pristupiti Firebase-u
Terminal: "[Firebase] Missing Firebase credentials. Cart tracking disabled."

Rješenje:
- Dodaj Firebase service account key u .env
- Inicijalizuj Firebase Admin SDK u backend-u
```

### **2. Brevo Email Sending API** 📧
```
Problem: Nemamo endpoint koji ŠALJE emailove

Trebamo kreirati:
POST /api/brevo/send-email

Body:
{
  "to": "user@example.com",
  "subject": "Subject",
  "htmlContent": "<p>Email content</p>",
  "sender": {
    "name": "Your Store",
    "email": "store@email.com"
  }
}

Koristi: Brevo API endpoint /v3/smtp/email
```

### **3. Automatski Email Trigger Sistem** 🤖
```
Problem: Webhook prima cart → Čuva u Firebase → NIŠTA DALJE

Trebamo:
1. Cron job (svakih 10 min) provjerava `carts/` u Firebase
2. Pronalazi carts starije od 30 minuta sa status: "pending"
3. Za svaki cart:
   - Dohvati user email
   - Dohvati aktivnu "Abandoned Cart" kampanju iz Firebase
   - Generiše personalizirani email sa OpenAI
   - Pošalje email preko Brevo API
   - Ažurira cart status na "email_sent"
```

### **4. OpenAI Integration u Backend** 🧠
```
Problem: OpenAI je samo u frontend-u

Trebamo:
- Dodaj OpenAI API key u backend .env
- Kreiraj funkciju za generisanje emaila
- Integriraj sa abandoned cart flow-om
```

### **5. Campaign Activation Email Sender** 📨
```
Problem: Kada korisnik aktivira kampanju, ne šalje se email

Trebamo:
POST /api/campaigns/send

Body:
{
  "campaignId": "123",
  "recipients": ["user1@email.com", "user2@email.com"]
}

Flow:
1. Dohvati campaign iz Firebase
2. Dohvati email template
3. Generiše personalizirani sadržaj za svakog recipienta
4. Pošalje email preko Brevo API
5. Trackuje status (sent, opened, clicked)
```

---

## 🔧 KONKRETNI FAJLOVI KOJI NEDOSTAJU:

### **1. `.env` u ROOT (backend):**
```env
# Firebase Admin
FIREBASE_PROJECT_ID=automailer-8d125
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@automailer-8d125.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://automailer-8d125-default-rtdb.firebaseio.com

# Brevo
BREVO_API_KEY=xkeysib-...

# OpenAI
OPENAI_API_KEY=sk-...

# Webhook
WEBHOOK_SECRET=your_webhook_secret_here

# Server
PORT=3001
```

### **2. `utils/brevoEmail.js` (backend):**
```javascript
// Funkcija za slanje emailova preko Brevo API
async function sendEmail(to, subject, htmlContent, sender) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: sender.name,
        email: sender.email,
      },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  
  return response.json();
}
```

### **3. `utils/openaiBackend.js` (backend):**
```javascript
// OpenAI integracija za backend
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateAbandonedCartEmail(cartData) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Generate abandoned cart recovery email...',
      },
      {
        role: 'user',
        content: JSON.stringify(cartData),
      },
    ],
  });
  
  return completion.choices[0].message.content;
}
```

### **4. `utils/cartScheduler.js` (AŽURIRANJE):**
```javascript
// Dodati logiku za automatsko slanje emailova
async function checkAbandonedCarts() {
  const carts = await getAbandonedCarts(); // Firebase
  
  for (const cart of carts) {
    // 1. Generiši email sa OpenAI
    const emailContent = await generateAbandonedCartEmail(cart);
    
    // 2. Pošalji email preko Brevo
    await sendEmail(
      cart.user_email,
      'Complete Your Purchase',
      emailContent,
      { name: 'Your Store', email: 'store@email.com' }
    );
    
    // 3. Ažuriraj status
    await updateCartStatus(cart.id, 'email_sent');
  }
}
```

### **5. `routes/email.js` (NOVI):**
```javascript
// Express route za slanje emailova
router.post('/send', async (req, res) => {
  const { to, subject, htmlContent, sender } = req.body;
  
  try {
    const result = await sendEmail(to, subject, htmlContent, sender);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🔄 FLOW NAKON IMPLEMENTACIJE:

### **Scenario 1: Abandoned Cart**
```
1. Korisnik napusti korpu na Shopify/WooCommerce
   ↓
2. Shopify/WooCommerce šalje webhook na: 
   http://your-server.com/api/webhooks/cart
   ↓
3. Backend prima webhook → Verificira HMAC → Čuva u Firebase
   Firebase: carts/{cartId}
   {
     user_email: "user@email.com",
     items: [...],
     status: "pending",
     timestamp: 1697471234567
   }
   ↓
4. Cron job (svakih 10 min) provjerava Firebase
   → Pronalazi cart stariji od 30 min
   ↓
5. Za taj cart:
   a) Generiše email sa OpenAI
      "Hi [Name], you left these items in your cart..."
   b) Pošalje email preko Brevo API
   c) Ažurira status: "email_sent"
   ↓
6. Korisnik dobije email! ✅
```

### **Scenario 2: Manual Campaign Activation**
```
1. Korisnik kreira kampanju u UI
   ↓
2. Klikne "Activate Campaign"
   ↓
3. Frontend šalje: POST /api/campaigns/send
   Body: { campaignId, recipients: [...] }
   ↓
4. Backend:
   a) Dohvati campaign iz Firebase
   b) Dohvati email template
   c) Za svakog recipienta:
      - Generiše personalizirani content sa OpenAI
      - Pošalje email preko Brevo API
   ↓
5. Trackuje rezultate u Firebase
   {
     status: "sent",
     sentAt: timestamp,
     emailsSent: 150,
     opened: 0,
     clicked: 0
   }
```

---

## 📊 TIMELINE ZA IMPLEMENTACIJU:

### **Faza 1: Backend Setup (30 min)**
- [ ] Dodaj `.env` sa Firebase credentials
- [ ] Inicijalizuj Firebase Admin u backend-u
- [ ] Testiraj da backend može čitati/pisati Firebase

### **Faza 2: Email Sending (45 min)**
- [ ] Kreiraj `utils/brevoEmail.js`
- [ ] Kreiraj `routes/email.js`
- [ ] Testiraj slanje emaila preko Brevo API

### **Faza 3: OpenAI Backend (30 min)**
- [ ] Dodaj OpenAI u backend dependencies
- [ ] Kreiraj `utils/openaiBackend.js`
- [ ] Testiraj generisanje email sadržaja

### **Faza 4: Automatski Cron Job (60 min)**
- [ ] Ažuriraj `utils/cartScheduler.js`
- [ ] Integriraj OpenAI + Brevo
- [ ] Testiraj end-to-end abandoned cart flow

### **Faza 5: Campaign Sending (45 min)**
- [ ] Kreiraj `/api/campaigns/send`
- [ ] Integriraj sa frontend "Activate" dugmetom
- [ ] Testiraj manual campaign sending

### **Faza 6: Testing & Debugging (60 min)**
- [ ] Test webhook → Firebase
- [ ] Test cron job → email
- [ ] Test manual campaign
- [ ] Debug any issues

**UKUPNO: ~4.5 sata**

---

## ✅ NAKON IMPLEMENTACIJE, IMAĆEMO:

```
✅ Potpuno automatski sistem za abandoned cart emailove
✅ Webhook prima podatke → Automatski šalje email nakon 30 min
✅ OpenAI generisanje personaliziranih emailova
✅ Brevo API za slanje emailova
✅ Firebase tracking svih akcija
✅ Manual campaign sending sa UI
✅ Real-time statistike i tracking
```

---

## 🚀 ŽELIŠ DA POČNEM SA IMPLEMENTACIJOM?

Mogу da napravim kompletnu implementaciju sa svim fajlovima.
Počinjem sa Faza 1?









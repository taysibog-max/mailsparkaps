# ✅ Abandoned Cart - Automatska Detekcija KOMPLETIRANA

## 🎉 Šta je Napravljeno?

Implementiran je **kompletno automatski sistem** za detekciju napuštenih korpi i slanje personalizovanih emailova!

---

## 📦 Novi Fajlovi

### 1. **`/public/cart-tracker.js`**
- JavaScript tracking script
- Automatski detektuje email unos
- Prati proizvode u korpi
- Šalje podatke kada korisnik napusti stranicu
- SendBeacon API za pouzdanu isporuku
- localStorage persistence
- Real-time heartbeat sync

### 2. **`/pages/api/cart-tracking.js`**
- API endpoint za primanje tracking podataka
- Validacija email formata
- Firestore database integration
- Automatsko pokretanje email kampanje
- OpenAI email generation
- Brevo email sending
- CORS enabled

### 3. **`/public/test-checkout.html`**
- Kompletna test checkout stranica
- Live demo sa 3 proizvoda
- Real-time tracker status
- Debug panel
- Funkcionalna korpa sa quantity controls

### 4. **Dokumentacija**
- `CART_TRACKER_SETUP.md` - Kompletna dokumentacija
- `CART_TRACKER_QUICKSTART.md` - 3-minute quick start
- `ABANDONED_CART_AUTO_COMPLETE.md` - Ovaj fajl

---

## 🚀 Kako Funkcioniše?

```
┌─────────────────────────────────────────────────────────┐
│  CHECKOUT STRANICA (bilo koja)                          │
│  - Korisnik unese email                                 │
│  - JavaScript tracker detektuje unos                     │
│  - Prikuplja podatke o proizvodima                      │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  KORISNIK NAPUŠTA STRANICU                              │
│  - Close tab / Back button / Switch tab                 │
│  - SendBeacon automatski šalje podatke                  │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  API ENDPOINT (/api/cart-tracking)                      │
│  - Prima podatke                                         │
│  - Validira email                                        │
│  - Čuva u Firestore                                     │
│  - Detektuje "abandoned" status                         │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  OPENAI EMAIL GENERATION                                │
│  - Generiše personalizovan subject                      │
│  - Generiše body sa AI-jem                              │
│  - Uključuje proizvode iz korpe                         │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  BREVO EMAIL SENDING                                    │
│  - Profesionalan HTML email                             │
│  - Lista proizvoda                                       │
│  - Link za povratak na checkout                         │
│  - 10% discount ponuda                                   │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  EMAIL U INBOX-U (1-2 sekunde)                          │
│  ✅ Korisnik dobija email                               │
│  ✅ Klikom na link vraća se na checkout                 │
│  ✅ Završava kupovinu                                    │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🎯 Automatska Detekcija
- ✅ Ne zahtijeva WooCommerce/Shopify webhooks
- ✅ Radi sa bilo kojom checkout stranicom
- ✅ Automatski detektuje email, ime, telefon
- ✅ Automatski detektuje proizvode u korpi

### 🔄 Real-time Tracking
- ✅ Heartbeat svakih 30 sekundi
- ✅ Instant sync sa backend-om
- ✅ localStorage persistence između sesija
- ✅ SendBeacon API za pouzdanu isporuku

### 🤖 AI Email Generation
- ✅ OpenAI GPT-4o-mini integration
- ✅ Personalizovani sadržaj za svakog korisnika
- ✅ Različiti prompti za različite kampanje
- ✅ Professional tone i writing style

### 📧 Professional Emails
- ✅ Brevo API integration
- ✅ HTML email templates
- ✅ Responsive design (mobile-friendly)
- ✅ Custom branding
- ✅ Call-to-action buttons

### 💾 Data Storage
- ✅ Firestore database
- ✅ Real-time updates
- ✅ Status tracking (pending/abandoned/email_sent)
- ✅ Analytics ready

---

## 🧪 Testiranje

### Quick Test (2 minuta)

1. **Pokreni dashboard** (ako već nije):
```bash
cd dashboard
npm run dev
```

2. **Otvori test checkout**:
```
http://localhost:3000/test-checkout.html
```

3. **Test scenario**:
   - Unesi **svoj email** (mora biti validan)
   - Opcionalno: dodaj ime i telefon
   - **Zatvori tab** ili klikni back button
   - Provjerite **email inbox** (dolazi za 1-2 sekunde!)

4. **Debug mode** (opciono):
```javascript
// Otvori Console (F12) i prati logove
CartTracker.init({
  apiUrl: 'http://localhost:3000/api/cart-tracking',
  trackingId: 'test',
  debugMode: true, // ← Enable
});
```

### Očekivani Console Output

```
[CartTracker] ✅ CartTracker inicijalizovan
[CartTracker] 📥 Učitano prethodno stanje
[CartTracker] 👂 Event listeners postavljeni
[CartTracker] 💓 Heartbeat started
[CartTracker] 📧 Email detektovan: user@example.com
[CartTracker] 🛒 Korpa ažurirana: Array(3)
[CartTracker] 📤 Šaljem podatke na backend...
[CartTracker] ✅ Podaci poslati uspješno
[CartTracker] 🚪 Korisnik napušta stranicu
```

### Očekivani Backend Output

```
[Cart Tracking] 📥 Primljeni podaci: {
  cart_id: 'cart_1234567890_abc123',
  user_email: 'user@example.com',
  is_abandoned: true,
  items_count: 3
}
[Cart Tracking] ✅ Korpa sačuvana: cart_1234567890_abc123
[Cart Tracking] 🚨 Detektovana napuštena korpa - pokrećem email kampanju
[AI] Generating email for campaign: abandoned_cart
[Cart Tracking] ✉️ Email kampanja pokrenuta za: user@example.com
[Cart Tracking] ✅ Email uspješno poslan na: user@example.com
```

---

## 🎯 Production Setup

### 1. Dodaj Script na Svoj Sajt

Na kraju checkout stranice:

```html
<!-- Prije </body> taga -->
<script src="https://yourstore.com/cart-tracker.js"></script>
<script>
  CartTracker.init({
    apiUrl: 'https://yourstore.com/api/cart-tracking',
    trackingId: 'YOUR_STORE_ID',
    debugMode: false, // Disable u production
  });

  // Očisti tracker nakon uspješne kupovine
  document.getElementById('checkoutForm').addEventListener('submit', function(e) {
    // ... nakon uspješnog payementa ...
    CartTracker.clearCart();
  });
</script>
```

### 2. Označi Email Polje

```html
<input type="email" data-cart-email name="email" required />
```

### 3. Označi Proizvode (Opciono)

```html
<div class="cart-item" data-cart-item>
  <h3 data-cart-item-name>Naziv Proizvoda</h3>
  <span data-cart-item-price>99.99</span>
  <input type="number" data-cart-item-quantity value="1" />
</div>
```

### 4. Environment Variables

Provjerite da su svi environment variables postavljeni u `.env`:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Brevo
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=noreply@yourstore.com

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
```

---

## 📊 Praćenje Performansi

### Firestore Collections

```
Collections:
  └── abandoned_carts/
      └── {cart_id}/
          ├── cart_id: string
          ├── user_email: string
          ├── user_name: string | null
          ├── user_phone: string | null
          ├── items: array
          ├── status: "pending" | "abandoned" | "email_sent" | "completed"
          ├── email_sent: boolean
          ├── email_sent_at: timestamp
          ├── createdAt: timestamp
          ├── updatedAt: timestamp
          ├── tracking_id: string
          ├── page_url: string
          └── platform: "custom_checkout"
```

### Metrics to Track

- **Abandonment Rate**: Koliko korpi je napušteno
- **Email Open Rate**: Brevo dashboard
- **Click-through Rate**: Link clicks u emailu
- **Recovery Rate**: Koliko korisnika završi kupovinu
- **Revenue Recovered**: Ukupna vrijednost recovered carts

---

## 🔧 Troubleshooting

### Problem: Email ne dolazi

**Rješenja:**
1. Provjerite Console (F12) - da li je email detektovan?
2. Provjerite `BREVO_API_KEY` u `.env`
3. Provjerite Brevo dashboard - da li je email sent?
4. Provjerite spam folder
5. Testiraj sa drugim email providerom (Gmail, Outlook)

### Problem: Tracker ne detektuje email

**Rješenja:**
1. Dodaj `data-cart-email` atribut na input
2. Provjerite da je email valid format
3. Uključi `debugMode: true` i prati console logs
4. Provjerite da li je script učitan (`http://localhost:3000/cart-tracker.js`)

### Problem: Proizvodi se ne detektuju

**Rješenja:**
1. Dodaj `data-cart-item` atribute
2. Koristi manual tracking: `CartTracker.track(...)`
3. Provjerite HTML strukturu u console logu

### Problem: CORS Error

**Rješenje:**
API endpoint `/api/cart-tracking.js` već ima CORS headers:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

Ako i dalje ne radi, provjerite browser console za detalje.

---

## 🎨 Prilagođavanje Email Template

Email template je u `/pages/api/cart-tracking.js` u funkciji `triggerAbandonedCartEmail()`.

Možete prilagoditi:
- Subject line
- Body text
- HTML styling
- Discount amount
- CTA button text
- Branding (logo, colors)

---

## 📈 Next Steps

### Optimizacije

1. **A/B Testing**
   - Test različite subject lines
   - Test različite discount amounts
   - Test različite timing (instant vs 30min vs 24h)

2. **Segmentacija**
   - VIP customers - veći discount
   - Prvi kupci - welcome bonus
   - Vraćeni kupci - loyalty rewards

3. **Follow-up Emails**
   - 2nd email nakon 24h
   - 3rd email nakon 3 dana
   - SMS reminder

4. **Analytics Integration**
   - Google Analytics events
   - Facebook Pixel tracking
   - Custom dashboard za metriku

---

## ✅ Zaključak

Sistem je **potpuno funkcionalan** i spreman za production!

**Šta je potrebno:**
1. ✅ 3 linije JavaScript koda na checkout stranici
2. ✅ Email input sa `data-cart-email` atributom
3. ✅ Environment variables konfigurisani

**Šta sistem radi automatski:**
1. ✅ Detektuje email unos
2. ✅ Prati proizvode u korpi
3. ✅ Šalje podatke kada korisnik napusti stranicu
4. ✅ Generiše AI email
5. ✅ Šalje profesionalan HTML email
6. ✅ Prati status u bazi

**Zero manual intervention. Potpuno automatski! 🎉**

---

## 📚 Dokumentacija

- **CART_TRACKER_QUICKSTART.md** - 3-minute setup guide
- **CART_TRACKER_SETUP.md** - Kompletna dokumentacija
- **test-checkout.html** - Live demo

---

## 🚀 Ready to Launch!

Testirajte sistem, prilagodite email template, i **deploy to production**!

**Happy selling! 💰**








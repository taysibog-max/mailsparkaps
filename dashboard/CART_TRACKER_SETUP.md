# 🛒 AutoMailer - Automatski Abandoned Cart Tracker

## 🎯 Pregled

Sistem automatski detektuje kada korisnik napusti checkout stranicu bez završetka kupovine i **automatski** šalje personalizovan email sa AI-generisanim sadržajem.

---

## ✨ Funkcionalnosti

✅ **Automatska Detekcija** - Prati ponašanje korisnika na checkout stranici  
✅ **Real-time Tracking** - Detektuje email čim ga korisnik unese  
✅ **AI Email Generation** - Generiše personalizovane emailove sa OpenAI  
✅ **Brevo Integration** - Šalje profesionalne HTML emailove  
✅ **localStorage Persistence** - Čuva podatke između sesija  
✅ **Cross-browser Support** - Radi na svim modernim browser-ima  
✅ **CORS Ready** - Može se koristiti na bilo kom domenu  

---

## 🚀 Kako Funkcioniše

```
Korisnik unese email na checkout-u
         ↓
JavaScript tracker detektuje email
         ↓
Prikuplja podatke o proizvodima u korpi
         ↓
Korisnik napusti stranicu (close tab / back button)
         ↓
Automatski šalje podatke na backend (SendBeacon API)
         ↓
Backend API prima podatke i označava kao "abandoned"
         ↓
OpenAI generiše personalizovan email sadržaj
         ↓
Brevo šalje email sa listom proizvoda i linkom za povratak
         ↓
Email dolazi na korisnikov inbox za 1-2 sekunde! 📧
```

---

## 📦 Instalacija

### Metod 1: Auto-Init (Najbrži)

Dodaj ovaj kod na **kraj** svoje checkout stranice:

```html
<!-- Na kraju body taga -->
<script src="https://yourstore.com/cart-tracker.js"></script>
<script>
  CartTracker.init({
    apiUrl: 'http://localhost:3000/api/cart-tracking',
    trackingId: 'YOUR_STORE_ID', // Dobij u dashboard-u
    debugMode: false, // Postavi na true za testiranje
  });
</script>
```

### Metod 2: Data Attributes (Automatski)

```html
<div data-cart-tracker-auto-init 
     data-api-url="http://localhost:3000/api/cart-tracking"
     data-tracking-id="YOUR_STORE_ID"
     data-debug="false">
</div>

<script src="https://yourstore.com/cart-tracker.js"></script>
```

---

## 🏷️ Označavanje Polja

Tracker automatski detektuje polja, ali možeš ih i eksplicitno označiti:

### Email (OBAVEZNO)

```html
<!-- Metod 1: Data atribut -->
<input type="email" data-cart-email name="email" />

<!-- Metod 2: Automatska detekcija -->
<input type="email" name="email" id="email" />
```

### Ime i Telefon (Opciono)

```html
<input type="text" data-cart-name name="name" />
<input type="tel" data-cart-phone name="phone" />
```

### Proizvodi u Korpi

#### Metod 1: Data Atributi (Preporučeno)

```html
<div class="cart-item" data-cart-item>
  <h3 data-cart-item-name>Premium Slušalice XM-5</h3>
  <span data-cart-item-price>299.99</span>
  <input type="number" data-cart-item-quantity value="1" />
</div>
```

#### Metod 2: Automatska Detekcija (WooCommerce/Shopify compatible)

```html
<div class="cart-item">
  <h3 class="product-name">Premium Slušalice XM-5</h3>
  <span class="price">299.99 KM</span>
  <input type="number" class="qty" value="1" />
</div>
```

Tracker automatski detektuje klase: `.cart-item`, `.product-name`, `.price`, `.qty`

---

## 🎨 Primjer: Kompletna Checkout Stranica

```html
<!DOCTYPE html>
<html lang="sr">
<head>
  <title>Checkout - Vaša Prodavnica</title>
</head>
<body>
  <h1>Checkout</h1>
  
  <!-- Checkout Form -->
  <form id="checkoutForm">
    <label>Email *</label>
    <input type="email" data-cart-email required />
    
    <label>Ime</label>
    <input type="text" data-cart-name />
    
    <label>Telefon</label>
    <input type="tel" data-cart-phone />
    
    <button type="submit">Završi kupovinu</button>
  </form>

  <!-- Korpa -->
  <div class="cart">
    <h2>Vaša Korpa</h2>
    
    <div class="cart-item" data-cart-item>
      <h3 data-cart-item-name>Proizvod 1</h3>
      <span data-cart-item-price>99.99</span>
      <input type="number" data-cart-item-quantity value="1" />
    </div>
    
    <div class="cart-item" data-cart-item>
      <h3 data-cart-item-name>Proizvod 2</h3>
      <span data-cart-item-price>149.99</span>
      <input type="number" data-cart-item-quantity value="2" />
    </div>
  </div>

  <!-- AutoMailer Tracker (na kraju) -->
  <script src="/cart-tracker.js"></script>
  <script>
    CartTracker.init({
      apiUrl: 'http://localhost:3000/api/cart-tracking',
      trackingId: 'YOUR_STORE_ID',
      debugMode: true,
    });

    // Clear cart after successful purchase
    document.getElementById('checkoutForm').addEventListener('submit', (e) => {
      e.preventDefault();
      // ... process payment ...
      CartTracker.clearCart(); // Očisti tracking nakon uspješne kupovine
    });
  </script>
</body>
</html>
```

---

## ⚙️ Konfiguracija

### Opcije

```javascript
CartTracker.init({
  // API endpoint (obavezno)
  apiUrl: 'http://localhost:3000/api/cart-tracking',
  
  // Tracking ID iz dashboard-a (obavezno)
  trackingId: 'YOUR_STORE_ID',
  
  // Debug mode (prikazuje console logs)
  debugMode: false,
  
  // Abandoned threshold (default: 30 minuta)
  abandonedThresholdMinutes: 30,
  
  // Heartbeat interval (default: 30 sekundi)
  heartbeatIntervalSeconds: 30,
});
```

### API Metode

```javascript
// Manual tracking
CartTracker.track('user@example.com', [
  { name: 'Proizvod', price: '99.99', quantity: 1 }
], { name: 'Ime Korisnika', phone: '+387 61 234 567' });

// Očisti korpu nakon kupovine
CartTracker.clearCart();

// Pokupi podatke o korpi
CartTracker.captureCartData();

// Pošalji podatke na backend
CartTracker.sendToBackend();
```

---

## 🧪 Testiranje

### 1. Pokreni Test Checkout Stranicu

Otvori u browser-u:

```
http://localhost:3000/test-checkout.html
```

### 2. Test Scenario

1. **Unesi svoj email** u email polje
2. **Opcionalno:** Dodaj ime i telefon
3. **Napusti stranicu** (zatvori tab ili klikni back)
4. **Provjerite email inbox** - email bi trebao stići za 1-2 sekunde!

### 3. Debug Mode

Uključi debug mode da vidiš šta se dešava:

```javascript
CartTracker.init({
  apiUrl: 'http://localhost:3000/api/cart-tracking',
  trackingId: 'test',
  debugMode: true, // ← Console logs enabled
});
```

Otvori **Developer Console** (F12) i prati logove:

```
[CartTracker] ✅ CartTracker inicijalizovan
[CartTracker] 📧 Email detektovan: user@example.com
[CartTracker] 🛒 Korpa ažurirana: [...]
[CartTracker] 📤 Šaljem podatke na backend...
[CartTracker] ✅ Podaci poslati uspješno
[CartTracker] 🚪 Korisnik napušta stranicu
```

---

## 📧 Email Primjer

Korisnik će dobiti profesionalan HTML email sa:

✅ AI-generisanim personalizovanim sadržajem  
✅ Listom proizvoda iz korpe  
✅ Linkovima za povratak na checkout  
✅ Discount ponudom (10% off)  
✅ Responsive dizajnom (mobile-friendly)  

**Subject:** Zaboravili ste završiti kupovinu? Vaša korpa čeka! 🛒

**Body:**
```
Poštovani [Ime],

Primijetili smo da ste ostavili neke artikle u korpi...

Artikli u vašoj korpi:
- Premium Slušalice XM-5 x1 - 299.99 KM
- Pametni Sat SportWatch Pro x1 - 599.99 KM

Završite kupovinu sada i ostvarite 10% popusta!

[Završi kupovinu sada! 🚀]

S poštovanjem,
Tim Vaše Prodavnice
```

---

## 🔧 Backend Setup

Backend je već konfigurisan! API endpoint `/api/cart-tracking` automatski:

1. ✅ Prima tracking podatke
2. ✅ Validira email format
3. ✅ Čuva u Firestore database
4. ✅ Detektuje abandoned carts
5. ✅ Generiše email sa OpenAI
6. ✅ Šalje preko Brevo API-ja
7. ✅ Ažurira status u bazi

### Environment Variables

Provjerite da su ove varijable postavljene u `.env`:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Brevo (email sending)
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=noreply@yourstore.com

# Firebase (data storage)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
```

---

## 🌐 Integracije

### WooCommerce

```php
// functions.php

// Dodaj tracker na checkout stranicu
add_action('wp_footer', function() {
  if (is_checkout()) {
    ?>
    <script src="https://yourstore.com/cart-tracker.js"></script>
    <script>
      CartTracker.init({
        apiUrl: 'http://localhost:3000/api/cart-tracking',
        trackingId: 'woo_<?php echo get_current_blog_id(); ?>',
      });
    </script>
    <?php
  }
});

// Očisti tracker nakon uspješne kupovine
add_action('woocommerce_thankyou', function($order_id) {
  ?>
  <script>
    if (window.CartTracker) {
      CartTracker.clearCart();
    }
  </script>
  <?php
});
```

### Shopify (Liquid)

```liquid
<!-- checkout.liquid -->
<script src="https://yourstore.com/cart-tracker.js"></script>
<script>
  CartTracker.init({
    apiUrl: 'http://localhost:3000/api/cart-tracking',
    trackingId: 'shopify_{{ shop.id }}',
  });

  // Clear on purchase
  {% if checkout.order_id %}
    CartTracker.clearCart();
  {% endif %}
</script>
```

### Custom E-commerce

Ako imaš svoj custom e-commerce sistem, jednostavno dodaj tracking script na checkout stranicu i označi relevantna polja!

---

## 📊 Statistike

Možeš pratiti abandoned carts u Firebase Console:

```
Collections:
  └── abandoned_carts
      └── cart_abc123
          ├── cart_id: "cart_abc123"
          ├── user_email: "user@example.com"
          ├── items: [...]
          ├── status: "email_sent"
          ├── email_sent_at: 1234567890
          └── createdAt: 1234567890
```

---

## 🛠️ Troubleshooting

### Email ne dolazi?

1. **Provjerite console logs** (F12) - da li je email detektovan?
2. **Provjerite email format** - mora biti validan (user@example.com)
3. **Provjerite BREVO_API_KEY** u `.env` fajlu
4. **Provjerite spam folder** 
5. **Provjerite Brevo dashboard** - da li je email sent?

### Tracker ne radi?

1. **Provjerite da li je script učitan** - otvori `http://localhost:3000/cart-tracker.js`
2. **Provjerite console errors** (F12)
3. **Uključi debug mode** - `debugMode: true`
4. **Provjerite CORS** - API mora dozvoliti cross-origin requests

### Proizvodi se ne detektuju?

1. **Dodaj data-cart-item atribute** - lakše je nego automatska detekcija
2. **Provjerite HTML strukturu** - da li postoje klase `.cart-item`, `.product-name`, `.price`?
3. **Koristi manual tracking** - `CartTracker.track(...)`

---

## 🎯 Best Practices

✅ **Uključi tracking što prije** - na početku checkout flow-a  
✅ **Označi polja eksplicitno** - koristi data-cart-* atribute  
✅ **Očisti tracker nakon kupovine** - pozovi `CartTracker.clearCart()`  
✅ **Testiraj na različitim browser-ima** - Chrome, Firefox, Safari  
✅ **Prati email delivery rate** - u Brevo dashboard-u  
✅ **A/B test email content** - različiti subject lines, CTA buttons  

---

## 📞 Podrška

Ako imaš pitanja ili probleme:

1. **Provjerite dokumentaciju** - čitaj ovaj fajl pažljivo
2. **Provjerite console logs** - uključi debug mode
3. **Testiraj na test-checkout.html** - provjerite da li radi lokalno
4. **Kontaktiraj support** - info@automailer.ba

---

## 🚀 Zaključak

Sistem je **potpuno automatski** i ne zahtijeva manual intervenciju!

Jednom kada dodaš tracking script na svoju checkout stranicu, sistem će automatski:

1. ✅ Detektovati email unos
2. ✅ Prikupiti podatke o proizvodima
3. ✅ Detektovati kada korisnik napusti stranicu
4. ✅ Generisati personalizovan email sa AI-jem
5. ✅ Poslati email preko Brevo-a
6. ✅ Pratiti status u bazi

**Sve što ti treba je dodati 3 linije koda na checkout stranicu! 🎉**

```html
<script src="/cart-tracker.js"></script>
<script>
  CartTracker.init({ apiUrl: '...', trackingId: '...' });
</script>
```

**That's it! Sistem radi! 🚀**









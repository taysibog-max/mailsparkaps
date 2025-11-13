# 🚀 Quick Start - Abandoned Cart Tracker

## 3 Minuta do Automatskih Emailova! ⚡

---

## 📋 Šta Trebam?

✅ Checkout stranica (bilo koja)  
✅ Email input polje  
✅ 3 linije JavaScript koda  

---

## 🎯 Setup (3 koraka)

### Korak 1: Dodaj Script

Na **kraju** svoje checkout stranice (prije `</body>`):

```html
<script src="http://localhost:3000/cart-tracker.js"></script>
<script>
  CartTracker.init({
    apiUrl: 'http://localhost:3000/api/cart-tracking',
    trackingId: 'YOUR_STORE_ID',
  });
</script>
```

### Korak 2: Označi Email Polje

Dodaj `data-cart-email` na email input:

```html
<input type="email" data-cart-email name="email" />
```

### Korak 3: Označi Proizvode (Opciono)

```html
<div class="cart-item" data-cart-item>
  <h3 data-cart-item-name>Proizvod 1</h3>
  <span data-cart-item-price>99.99</span>
  <input data-cart-item-quantity value="1" />
</div>
```

---

## 🧪 Testiranje

1. Otvori: **http://localhost:3000/test-checkout.html**
2. Unesi **svoj email**
3. **Zatvori tab** (napusti stranicu)
4. **Provjerite inbox** - email dolazi za 1-2 sekunde! 📧

---

## ✅ To je to!

Sistem automatski:
- ✅ Detektuje email
- ✅ Prati proizvode u korpi
- ✅ Šalje podatke kada korisnik napusti stranicu
- ✅ Generiše AI email
- ✅ Šalje preko Brevo-a

**Potpuno automatski. Zero manual work. 🎉**

---

## 📖 Više Detalja?

Čitaj: **CART_TRACKER_SETUP.md** za kompletnu dokumentaciju

---

## 🐛 Problem?

1. Uključi debug mode:
```javascript
CartTracker.init({
  apiUrl: 'http://localhost:3000/api/cart-tracking',
  trackingId: 'test',
  debugMode: true, // ← Enable console logs
});
```

2. Otvori Console (F12) i prati logove

3. Testuj na test-checkout.html prije nego na svom sajtu

---

## 🎯 Šta Dalje?

- Testiraj sistem
- Prilagodi email template
- Dodaj discount codes
- A/B test subject lines
- Prati conversion rate

**Happy selling! 🚀**








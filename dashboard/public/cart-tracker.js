/**
 * 🛒 AutoMailer - Abandoned Cart Tracker
 * 
 * Automatski detektuje napuštene korpe i šalje podatke na backend
 * 
 * UPOTREBA:
 * =========
 * 
 * 1. Dodaj ovaj script na svoju checkout stranicu:
 * 
 *    <script src="https://vasadomena.com/cart-tracker.js"></script>
 *    <script>
 *      CartTracker.init({
 *        apiUrl: 'http://localhost:3001/api/cart-tracking',
 *        trackingId: 'VAŠ_TRACKING_ID' // Dobijete u dashboard-u
 *      });
 *    </script>
 * 
 * 2. Označi polja na checkout stranici sa data atributima:
 * 
 *    <input type="email" data-cart-email name="email" />
 *    <input type="text" data-cart-name name="name" />
 *    <input type="tel" data-cart-phone name="phone" />
 * 
 * 3. Proizvodi u korpi (opciono, može automatski detektovati):
 * 
 *    <div class="cart-item" data-cart-item>
 *      <span data-cart-item-name>Proizvod 1</span>
 *      <span data-cart-item-price>49.99</span>
 *      <input data-cart-item-quantity value="1" />
 *    </div>
 */

(function(window) {
  'use strict';

  const CartTracker = {
    config: {
      apiUrl: 'http://localhost:3001/api/cart-tracking',
      trackingId: null,
      trackingEnabled: true,
      debugMode: false,
      // Pošalji odmah pri napuštanju taba/prozora
      sendOnLeave: true,
      // Ako korisnik ostane neaktivan X sekundi, tretiraj kao napušteno
      inactivityThresholdSeconds: 60,
      abandonedThresholdMinutes: 30,
      heartbeatIntervalSeconds: 30,
    },

    state: {
      cartId: null,
      userEmail: null,
      userName: null,
      userPhone: null,
      cartItems: [],
      lastUpdate: null,
      lastActivity: Date.now(),
      abandonTriggered: false,
      isTracking: false,
      heartbeatInterval: null,
    },

    /**
     * Inicijalizacija tracker-a
     */
    init(options = {}) {
      // Merge config
      Object.assign(this.config, options);

      if (!this.config.trackingId) {
        console.warn('[CartTracker] ⚠️ trackingId nije postavljen. Dobij ga u AutoMailer dashboard-u.');
      }

      // Generiši ili učitaj cart ID
      this.state.cartId = this.getOrCreateCartId();

      // Učitaj prethodno stanje iz localStorage
      this.loadState();

      // Setup event listeners
      this.setupListeners();

      // Start heartbeat
      this.startHeartbeat();

      this.log('✅ CartTracker inicijalizovan', {
        cartId: this.state.cartId,
        trackingId: this.config.trackingId
      });

      // Track page visibility
      this.trackPageVisibility();
    },

    /**
     * Generiši ili učitaj Cart ID
     */
    getOrCreateCartId() {
      let cartId = localStorage.getItem('automailer_cart_id');
      
      if (!cartId) {
        cartId = 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('automailer_cart_id', cartId);
      }

      return cartId;
    },

    /**
     * Učitaj stanje iz localStorage
     */
    loadState() {
      try {
        const savedState = localStorage.getItem('automailer_cart_state');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          Object.assign(this.state, parsed);
          this.log('📥 Učitano prethodno stanje', this.state);
        }
      } catch (err) {
        this.log('⚠️ Greška pri učitavanju stanja', err);
      }
    },

    /**
     * Sačuvaj stanje u localStorage
     */
    saveState() {
      try {
        localStorage.setItem('automailer_cart_state', JSON.stringify({
          cartId: this.state.cartId,
          userEmail: this.state.userEmail,
          userName: this.state.userName,
          userPhone: this.state.userPhone,
          cartItems: this.state.cartItems,
          lastUpdate: Date.now(),
        }));
      } catch (err) {
        this.log('⚠️ Greška pri čuvanju stanja', err);
      }
    },

    /**
     * Setup event listeners
     */
    setupListeners() {
      // Email input
      const emailInput = document.querySelector('[data-cart-email], input[type="email"][name*="email"], #email, .email-input');
      if (emailInput) {
        emailInput.addEventListener('blur', () => {
          this.state.userEmail = emailInput.value.trim();
          if (this.isValidEmail(this.state.userEmail)) {
            this.log('📧 Email detektovan:', this.state.userEmail);
            this.captureCartData();
            this.sendToBackend();
          }
          this.state.lastActivity = Date.now();
        });

        // Real-time tracking
        emailInput.addEventListener('input', () => {
          this.state.userEmail = emailInput.value.trim();
          if (this.isValidEmail(this.state.userEmail)) {
            this.captureCartData();
          }
          this.state.lastActivity = Date.now();
        });
      }

      // Name input
      const nameInput = document.querySelector('[data-cart-name], input[name*="name"], #name, .name-input');
      if (nameInput) {
        nameInput.addEventListener('blur', () => {
          this.state.userName = nameInput.value.trim();
          this.sendToBackend();
          this.state.lastActivity = Date.now();
        });
      }

      // Phone input
      const phoneInput = document.querySelector('[data-cart-phone], input[type="tel"], input[name*="phone"], #phone');
      if (phoneInput) {
        phoneInput.addEventListener('blur', () => {
          this.state.userPhone = phoneInput.value.trim();
          this.sendToBackend();
          this.state.lastActivity = Date.now();
        });
      }

      // Detect when user leaves page/tab (više događaja radi pouzdanosti)
      const onLeave = () => this.handlePageLeave();
      window.addEventListener('beforeunload', onLeave);
      window.addEventListener('pagehide', onLeave); // iOS/Safari
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) onLeave();
        else this.state.lastActivity = Date.now();
      });

      this.log('👂 Event listeners postavljeni');
    },

    /**
     * Prati vidljivost stranice
     */
    trackPageVisibility() {
      let hidden, visibilityChange;
      
      if (typeof document.hidden !== 'undefined') {
        hidden = 'hidden';
        visibilityChange = 'visibilitychange';
      } else if (typeof document.msHidden !== 'undefined') {
        hidden = 'msHidden';
        visibilityChange = 'msvisibilitychange';
      } else if (typeof document.webkitHidden !== 'undefined') {
        hidden = 'webkitHidden';
        visibilityChange = 'webkitvisibilitychange';
      }

      if (typeof document[hidden] !== 'undefined') {
        document.addEventListener(visibilityChange, () => {
          if (document[hidden]) {
            this.log('👁️ Korisnik je otišao sa stranice');
            this.handlePageLeave();
          } else {
            this.log('👁️ Korisnik se vratio na stranicu');
          }
        }, false);
      }
    },

    /**
     * Pokupi podatke o korpi
     */
    captureCartData() {
      // Auto-detect cart items
      const cartItems = [];
      
      // Method 1: data-cart-item attribute
      const itemElements = document.querySelectorAll('[data-cart-item]');
      itemElements.forEach(item => {
        const name = item.querySelector('[data-cart-item-name]')?.textContent.trim() || 'Nepoznat proizvod';
        const priceText = item.querySelector('[data-cart-item-price]')?.textContent.trim() || '0';
        const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        const quantityInput = item.querySelector('[data-cart-item-quantity]');
        const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;

        cartItems.push({ name, price: price.toFixed(2), quantity });
      });

      // Method 2: Common e-commerce class names
      if (cartItems.length === 0) {
        const commonSelectors = [
          '.cart-item, .cart_item, .product, .product-item',
          '.woocommerce-cart-form__cart-item',
          '.checkout-cart-item',
        ];

        commonSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(item => {
            const name = item.querySelector('.product-name, .product-title, h3, h4')?.textContent.trim() || 'Proizvod';
            const priceText = item.querySelector('.price, .product-price, .amount')?.textContent.trim() || '0';
            const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
            const quantityInput = item.querySelector('input[type="number"], .qty, .quantity');
            const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;

            if (name && price > 0) {
              cartItems.push({ name, price: price.toFixed(2), quantity });
            }
          });
        });
      }

      this.state.cartItems = cartItems;
      this.saveState();
      this.log('🛒 Korpa ažurirana:', cartItems);
    },

    /**
     * Šalje podatke na backend
     */
    async sendToBackend(isAbandoned = false) {
      if (!this.state.userEmail || !this.isValidEmail(this.state.userEmail)) {
        this.log('⚠️ Email nije validan, ne šaljem podatke');
        return;
      }

      this.captureCartData(); // Refresh cart data

      const payload = {
        cart_id: this.state.cartId,
        user_email: this.state.userEmail,
        user_name: this.state.userName,
        user_phone: this.state.userPhone,
        cart_items: this.state.cartItems,
        timestamp: Date.now(),
        tracking_id: this.config.trackingId,
        page_url: window.location.href,
        is_abandoned: isAbandoned,
      };

      try {
        this.log('📤 Šaljem podatke na backend...', payload);

        const response = await fetch(this.config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          this.log('✅ Podaci poslati uspješno', result);
          this.state.lastUpdate = Date.now();
          this.saveState();
        } else {
          this.log('❌ Greška pri slanju podataka:', response.status);
        }
      } catch (error) {
        this.log('❌ Greška pri slanju podataka:', error);
      }
    },

    /**
     * Kada korisnik napusti stranicu
     */
    handlePageLeave() {
      if (!this.config.sendOnLeave) return;
      // Fallback: pokušaj ponovo pročitati email direktno iz DOM-a
      if (!this.state.userEmail || !this.isValidEmail(this.state.userEmail)) {
        const emailInput = document.querySelector('[data-cart-email], input[type="email"][name*="email"], #email, .email-input');
        if (emailInput) {
          const v = String(emailInput.value || '').trim();
          if (this.isValidEmail(v)) this.state.userEmail = v;
        }
      }
      if (this.state.userEmail && this.isValidEmail(this.state.userEmail)) {
        this.log('🚪 Korisnik napušta stranicu - šaljem podatke o napuštenoj korpi');
        
        // Use sendBeacon for reliable delivery
        const payload = JSON.stringify({
          cart_id: this.state.cartId,
          user_email: this.state.userEmail,
          user_name: this.state.userName,
          user_phone: this.state.userPhone,
          cart_items: this.state.cartItems,
          timestamp: Date.now(),
          tracking_id: this.config.trackingId,
          page_url: window.location.href,
          is_abandoned: true,
        });

        if (navigator.sendBeacon) {
          // Some Safari versions drop beacons in certain cases; capture return value
          const blob = new Blob([payload], { type: 'application/json' });
          const ok = navigator.sendBeacon(this.config.apiUrl, blob);
          if (!ok) {
            try {
              fetch(this.config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true,
                mode: 'cors',
                credentials: 'omit',
                cache: 'no-store',
                referrerPolicy: 'no-referrer'
              });
            } catch (_) {}
          }
        } else {
          // Fallback for older browsers
          try {
            fetch(this.config.apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
              keepalive: true,
              mode: 'cors',
              credentials: 'omit',
              cache: 'no-store',
              referrerPolicy: 'no-referrer'
            });
          } catch (_) {}
        }
      }
    },

    /**
     * Heartbeat - periodički šalje podatke
     */
    startHeartbeat() {
      this.state.heartbeatInterval = setInterval(() => {
        if (this.state.userEmail && this.isValidEmail(this.state.userEmail)) {
          this.log('💓 Heartbeat - ažuriram podatke');
          this.sendToBackend();
        }

        // Inactivity-based abandoned detection
        const idleFor = (Date.now() - this.state.lastActivity) / 1000;
        const hasItems = (this.state.cartItems || []).length > 0;
        if (
          this.config.inactivityThresholdSeconds > 0 &&
          idleFor >= this.config.inactivityThresholdSeconds &&
          !this.state.abandonTriggered &&
          this.isValidEmail(this.state.userEmail) && hasItems
        ) {
          this.log('⏳ Inactivity threshold reached -> sending abandoned');
          this.state.abandonTriggered = true;
          this.sendToBackend(true);
        }
      }, this.config.heartbeatIntervalSeconds * 1000);
    },

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
      if (this.state.heartbeatInterval) {
        clearInterval(this.state.heartbeatInterval);
        this.state.heartbeatInterval = null;
      }
    },

    /**
     * Validiraj email
     */
    isValidEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    },

    /**
     * Logger
     */
    log(...args) {
      if (this.config.debugMode) {
        console.log('[CartTracker]', ...args);
      }
    },

    /**
     * Clear tracking data (pozovi nakon uspješne kupovine)
     */
    clearCart() {
      localStorage.removeItem('automailer_cart_id');
      localStorage.removeItem('automailer_cart_state');
      this.state.cartId = this.getOrCreateCartId();
      this.state.userEmail = null;
      this.state.userName = null;
      this.state.userPhone = null;
      this.state.cartItems = [];
      this.log('🗑️ Korpa očišćena');
    },

    /**
     * Manual tracking (za custom implementacije)
     */
    track(email, items, userData = {}) {
      this.state.userEmail = email;
      this.state.userName = userData.name || null;
      this.state.userPhone = userData.phone || null;
      this.state.cartItems = items;
      this.sendToBackend();
    },
  };

  // Export to global scope
  window.CartTracker = CartTracker;

  // Auto-init ako postoji data-cart-tracker-auto-init
  if (document.querySelector('[data-cart-tracker-auto-init]')) {
    document.addEventListener('DOMContentLoaded', () => {
      const element = document.querySelector('[data-cart-tracker-auto-init]');
      const apiUrl = element.getAttribute('data-api-url') || 'http://localhost:3001/api/cart-tracking';
      const trackingId = element.getAttribute('data-tracking-id');
      const debugMode = element.getAttribute('data-debug') === 'true';

      CartTracker.init({ apiUrl, trackingId, debugMode });
    });
  }

})(window);


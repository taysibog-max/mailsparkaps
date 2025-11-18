'use strict';

(function () {
  // Firebase config loader (optional if not present)
  window.loadFirebase = function(cfg){
    if(!cfg || !cfg.apiKey){ console.warn('Firebase config missing'); return null; }
    if(window.firebaseApp){ return window.firebaseApp; }
    const app = firebase.initializeApp(cfg);
    window.firebaseApp = app;
    return app;
  };
  const form = document.getElementById('email-form');
  const statusEl = document.getElementById('status');
  const tabs = document.querySelectorAll('.tab');
  const priceCards = document.querySelectorAll('.price-card');
  const typedText = document.getElementById('typed-text');
  const particlesCanvas = document.getElementById('hero-particles');
  const signinBtn = document.getElementById('signin-btn');
  const userMenuMount = document.getElementById('user-menu-mount');
  const dashNav = document.getElementById('dash-nav');
  const dashContent = document.getElementById('dash-content');

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = type || '';
  }

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      setStatus('Sending...', 'info');

      const formData = new FormData(form);
      const payload = {
        to: formData.get('to'),
        subject: formData.get('subject'),
        text: formData.get('text'),
        html: formData.get('html') || undefined,
      };

      try {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Failed to send.');
        }
        setStatus('Email sent! ID: ' + data.messageId, 'success');
        form.reset();
      } catch (err) {
        setStatus('Error: ' + (err.message || err), 'error');
      }
    });
  }

  // Pricing tabs
  function updatePrices(plan) {
    priceCards.forEach(function (card) {
      var monthly = Number(card.getAttribute('data-monthly'));
      var yearly = Number(card.getAttribute('data-yearly'));
      var amount = plan === 'yearly' ? yearly : monthly;
      var period = plan === 'yearly' ? '/yr' : '/mo';
      var amountEl = card.querySelector('.price-amount');
      var periodEl = card.querySelector('.period');
      if (amountEl) amountEl.textContent = String(amount);
      if (periodEl) periodEl.textContent = period;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      var plan = tab.getAttribute('data-plan');
      updatePrices(plan);
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = link.getAttribute('href').slice(1);
      var target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Header scroll state
  (function initHeaderScroll() {
    var header = document.querySelector('.site-header');
    var toggle = document.querySelector('.menu-toggle');
    var nav = document.getElementById('primary-nav');
    if (!header) return;
    function onScroll() {
      if (window.scrollY > 6) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Mobile menu toggle
    if (toggle && nav) {
      toggle.addEventListener('click', function(){
        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        if (!expanded) header.classList.add('open'); else header.classList.remove('open');
      });
      // Close on nav click (for single page anchors)
      nav.addEventListener('click', function(e){
        var target = e.target;
        if (target.tagName === 'A') {
          toggle.setAttribute('aria-expanded', 'false');
          header.classList.remove('open');
        }
      });
    }
  })();

  // Firebase Auth mount for public site
  (function initPublicAuth(){
    if (!window.firebase || !window.FIREBASE_CONFIG) return;
    var app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
    var auth = firebase.auth();
    if (signinBtn) { signinBtn.addEventListener('click', function(){ window.location.href = '/signin'; }); }
    function renderUser(user){
      var signupBtn = document.querySelector('.btn.shine.signup');
      if (!user) {
        if (userMenuMount) userMenuMount.innerHTML = '';
        if (signinBtn) signinBtn.style.display = 'inline-block';
        if (signupBtn) signupBtn.style.display = 'inline-block';
        return;
      }
      if (signinBtn) signinBtn.style.display = 'none';
      if (signupBtn) signupBtn.style.display = 'none';
      var name = (user.displayName || 'there').split(' ')[0];
      var avatarUrl = user.photoURL;
      userMenuMount.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.style.position = 'relative';
      var btn = document.createElement('button');
      btn.className = 'user-chip';
      // Build chip content programmatically to handle image errors -> fallback initial
      var hi = document.createElement('span');
      hi.className = 'hi';
      hi.innerHTML = 'Hi, <strong>'+name+'</strong>';
      var avatarWrap = document.createElement('span');
      avatarWrap.className = 'user-avatar';
      var initialEl = document.createElement('span');
      initialEl.className = 'initial';
      initialEl.textContent = (name[0]||'U').toUpperCase();
      if (avatarUrl) {
        var img = new Image();
        img.alt = '';
        img.src = avatarUrl;
        img.onerror = function(){ avatarWrap.innerHTML = ''; avatarWrap.appendChild(initialEl); };
        avatarWrap.appendChild(img);
      } else {
        avatarWrap.appendChild(initialEl);
      }
      btn.appendChild(hi);
      btn.appendChild(avatarWrap);
      var open = false; var menu;
      function close(){ if (menu){ menu.remove(); menu=null; open=false; } }
      function toggle(){ if (open){ close(); return; } open=true; menu = document.createElement('div'); menu.className='menu-card';
        // Prefer Next.js dashboard if configured, else fallback to static dashboard
        var dashOrigin = (window.RUNTIME && window.RUNTIME.DASHBOARD_ORIGIN)
          ? window.RUNTIME.DASHBOARD_ORIGIN.replace(/\/$/, '')
          : 'http://localhost:3000';
        var dashHref = dashOrigin + '/dashboard/overview';
        menu.innerHTML = '<div class="menu-head"><div class="email">'+(user.email||'')+'</div></div>'+
          '<a class="menu-item" href="'+dashHref+'">\n            <svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/></svg>Dashboard\n          </a>'+
          '<a class="menu-item" href="#account">\n            <svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0Z"/></svg>Account settings\n          </a>'+
          '<button class="menu-item logout" id="logout-btn" type="button">\n            <svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M10 17v-2h4v-6h-4V7h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1Zm-2-5h-6v-2h6l-2-2 1.4-1.4L11.8 11l-4.4 4.4L6 14Z"/></svg>Logout\n          </button>';
        wrap.appendChild(menu);
        menu.querySelector('#logout-btn').addEventListener('click', function(){ auth.signOut(); close(); });
        document.addEventListener('click', onDoc, { once: true });
      }
      function onDoc(e){ if (!wrap.contains(e.target)) close(); }
      btn.addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
      wrap.appendChild(btn);
      userMenuMount.appendChild(wrap);
    }
    auth.onAuthStateChanged(renderUser);
  })();

  // SPA-like dashboard switching for /dashboard.html
  (function initDashboard(){
    if (!dashNav || !dashContent) return;
    function setActive(view){
      dashNav.querySelectorAll('.dash-link').forEach(function(a){ a.classList.toggle('active', a.getAttribute('data-view')===view); });
      dashContent.querySelectorAll('.dash-section').forEach(function(s){ s.classList.toggle('hidden', s.getAttribute('data-section')!==view); });
    }
    dashNav.addEventListener('click', function(e){
      var a = e.target.closest('.dash-link'); if(!a) return; e.preventDefault();
      setActive(a.getAttribute('data-view'));
    });
    setActive('overview');
  })();

  // Reveal on scroll
  (function revealOnScroll() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { observer.observe(el); });
  })();

  // Animate WHY chart line drawing
  (function animateWhyChart() {
    var line = document.getElementById('why-line');
    var fill = document.getElementById('why-fill');
    if (!line || !fill) return;
    var svg = line.ownerSVGElement;
    function setup() {
      var len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      fill.style.opacity = 0;
    }
    setup();
    var played = false;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !played) {
          played = true;
          line.style.transition = 'stroke-dashoffset 1.6s ease';
          line.style.strokeDashoffset = 0;
          setTimeout(function () { fill.style.transition = 'opacity 0.8s ease'; fill.style.opacity = 1; }, 600);
          obs.disconnect();
        }
      });
    }, { threshold: 0.2 });
    obs.observe(svg);
  })();

  // Typewriter messages in hero (inside hero card)
  (function initTypewriter() {
    if (!typedText) return;
    var messages = [
      'Hey {{name}}, your purchase is almost complete — take 10% off today!',
      'Increase sales with automated upsell emails — even while you sleep.',
      'Personalized follow‑ups that bring users back and lift conversion.'
    ];
    var msgIndex = 0;
    var charIndex = 0;
    var deleting = false;

    function tick() {
      var current = messages[msgIndex];
      if (!deleting) {
        charIndex++;
        typedText.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          deleting = true;
          setTimeout(tick, 1400);
          return;
        }
      } else {
        charIndex--;
        typedText.textContent = current.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          msgIndex = (msgIndex + 1) % messages.length;
        }
      }
      var delay = deleting ? 28 : 34; // speed
      setTimeout(tick, delay);
    }
    tick();
  })();

  // Particles background over entire hero section
  (function initParticles() {
    if (!particlesCanvas) return;
    var canvas = particlesCanvas;
    var ctx = canvas.getContext('2d');
    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    var particles = Array.from({ length: 70 }).map(function () {
      return {
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        r: 1 + Math.random() * 2.2,
        dx: -0.35 + Math.random() * 0.7,
        dy: -0.35 + Math.random() * 0.7,
        hue: 320 + Math.random() * 40
      };
    });

    function step() {
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      particles.forEach(function (p) {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > w) p.dx *= -1;
        if (p.y < 0 || p.y > h) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + p.hue + ', 80%, 60%, 0.45)';
        ctx.fill();
      });
      requestAnimationFrame(step);
    }
    step();
  })();

  // Animated message feed
  (function initMsgFeed() {
    var box = document.querySelector('.msg-box');
    if (!box) return;
    // Clear any static rows so we can animate one-by-one
    box.innerHTML = '';
    var messages = [
      { initials: 'A', title: 'Upsell reminder', text: 'Hey Sara, you left items in your cart — here’s 10% off.' },
      { initials: 'M', title: 'Cross‑sell', text: 'Customers who bought sneakers often add socks.' },
      { initials: 'J', title: 'Winback', text: 'We haven’t seen you in a while — enjoy 15% off to come back.' },
      { initials: 'K', title: 'Post‑purchase', text: 'Thanks for your order! Here’s a related pick you may like.' }
    ];
    var idx = -1;
    var unread = 0;
    function pushNext() {
      idx = (idx + 1) % messages.length;
      unread = (unread + 1);
      var m = messages[idx];
      var row = document.createElement('div');
      row.className = 'msg-row enter';
      row.innerHTML = '<div class="avatar">' + m.initials + '</div>' +
        '<div class="msg"><div class="msg-title">' + m.title + '</div><div class="msg-text">' + m.text + '</div></div>' +
        '<span class="unread-bell" title="New message">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a6 6 0 0 1 6 6v3.28c0 .74.3 1.46.83 1.98l.84.82c.63.62.18 1.7-.72 1.7H4.05c-.9 0-1.35-1.08-.72-1.7l.84-.82c.53-.52.83-1.24.83-1.98V8a6 6 0 0 1 6-6Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z"/></svg>'+
        '</span>';
      // Prepend to appear on top
      if (box.firstChild) box.insertBefore(row, box.firstChild); else box.appendChild(row);
      // Remove the enter class after animation ends to allow future animations if recycled
      row.addEventListener('animationend', function(){ row.classList.remove('enter'); }, { once: true });
      // Keep only the latest 4
      while (box.children.length > 4) {
        box.removeChild(box.lastElementChild);
      }
      // Bell icon replaces numeric count; no text updates needed
    }
    // start immediately and then interval
    pushNext();
    setInterval(pushNext, 2500);
  })();

  // Pointer-follow glow for CTA buttons
  (function pointerFollowCTA(){
    var ctas = document.querySelectorAll('.btn.shine, .btn.subtle');
    if(!ctas.length) return;
    ctas.forEach(function(btn){
      btn.addEventListener('pointermove', function(e){
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        btn.style.setProperty('--x', x + 'px');
        btn.style.setProperty('--y', y + 'px');
      }, { passive: true });
    });
  })();

  // AI chip typing animation
  (function initAiChip() {
    var el = document.getElementById('ai-chip-text');
    if (!el) return;
    var phrases = [
      'Powered by AI & Real‑time Data',
      'Writes upsell emails for you',
      'Optimizes send time automatically',
      'Learns from conversions to improve'
    ];
    var p = 0, i = 0, del = false;
    function tick() {
      var text = phrases[p];
      if (!del) {
        i++;
        el.textContent = text.slice(0, i);
        if (i === text.length) { del = true; setTimeout(tick, 1200); return; }
      } else {
        i--;
        el.textContent = text.slice(0, i);
        if (i === 0) { del = false; p = (p + 1) % phrases.length; }
      }
      setTimeout(tick, del ? 30 : 40);
    }
    tick();
  })();
})();



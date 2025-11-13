/**
 * API Endpoint za primanje tracking podataka sa checkout stranice
 * 
 * Prima podatke o napuštenim korpama i automatski pokreće email kampanju
 */

import { adminAuth, adminDb, adminDatabase } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  // CORS headers za cross-origin requests
  let responseOrigin = req.headers.origin;
  // fallback: derive from referer if Origin header missing
  if (!responseOrigin && req.headers.referer) {
    try { responseOrigin = new URL(req.headers.referer).origin; } catch (_) {}
  }
  if (responseOrigin && responseOrigin !== 'null') {
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const diag = { suppressed: false, locked: false, alreadySentToday: false, emailAttempted: false, emailSent: false, limiterGap: false, brevoError: null, brevoConfig: 'env' };
    const {
      cart_id,
      user_email,
      user_name,
      user_phone,
      cart_items = [],
      timestamp,
      tracking_id,
      page_url,
      is_abandoned = false,
    } = req.body;

    // Validacija
    if (!cart_id || !user_email) {
      return res.status(400).json({ 
        error: 'Missing required fields: cart_id, user_email' 
      });
    }

    // Validacija email formata
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user_email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    console.log('[Cart Tracking] 📥 Primljeni podaci:', {
      cart_id,
      user_email,
      is_abandoned,
      items_count: cart_items.length,
      tracking_id,
    });

    // Suppression list (do-not-send)
    const emailKey = Buffer.from(String(user_email || '').toLowerCase()).toString('base64');
    try {
      const supSnap = await adminDatabase.ref(`suppression/${emailKey}`).get();
      if (supSnap.exists() && supSnap.val()) {
        console.log('[Cart Tracking] 🛑 Suppressed:', user_email);
        diag.suppressed = true;
        return res.status(200).json({ success: true, suppressed: true, diag });
      }
    } catch (_) {}

    // Derive store name and owner uid for attribution
    let derivedStoreName = '';
    let ownerUid = null;
    try {
      let hostName = '';
      try {
        const o = req.headers.origin || req.headers.referer || '';
        if (o) hostName = new URL(o).hostname || '';
      } catch (_) {}
      derivedStoreName = (hostName && hostName.replace(/^www\./,'')) || '';
      const rawKey = (derivedStoreName || '').toLowerCase();
      const underscoreKey = rawKey.replace(/\./g,'_');
      let ownerSnap = null;
      try {
        ownerSnap = await adminDatabase.ref(`storeOwners/${rawKey}`).get();
      } catch(_) {}
      if (!ownerSnap || !ownerSnap.exists()) {
        try { ownerSnap = await adminDatabase.ref(`storeOwners/${underscoreKey}`).get(); } catch(_) {}
      }
      if (ownerSnap && ownerSnap.exists()) ownerUid = ownerSnap.val();

      // Auto-discovery: search users/*/integrations/woocommerce for matching host if mapping missing
      if (!ownerUid && rawKey) {
        try {
          const usersSnap = await adminDatabase.ref('users').get();
          if (usersSnap.exists()) {
            const all = usersSnap.val() || {};
            const hostLower = rawKey;
            for (const [uidKey, userNode] of Object.entries(all)) {
              try {
                const shopUrl = userNode?.integrations?.woocommerce?.shopUrl || '';
                if (shopUrl) {
                  const h = new URL(shopUrl).hostname.replace(/^www\./,'');
                  if (h.toLowerCase() === hostLower) {
                    ownerUid = uidKey;
                    // persist mapping for future requests (both keys)
                    await adminDatabase.ref(`storeOwners/${hostLower}`).set(uidKey);
                    await adminDatabase.ref(`storeOwners/${hostLower.replace(/\./g,'_')}`).set(uidKey);
                    break;
                  }
                }
              } catch(_) {}
            }
          }
        } catch(_) {}
      }
      // Fallback: try to resolve from page_url in body
      if (!ownerUid) {
        try {
          const purl = req.body?.page_url || '';
          if (purl) {
            const phost = new URL(purl).hostname.replace(/^www\./,'');
            const pkey = phost.replace(/\./g,'_');
            const o2 = await adminDatabase.ref(`storeOwners/${pkey}`).get();
            if (o2.exists()) ownerUid = o2.val();
            if (!derivedStoreName) derivedStoreName = phost;
          }
        } catch(_) {}
      }
    } catch(_) {}

    // Generiši writeCartId (ako već postoji drugi email pod istim cart_id, napraviti novi id da ne prepisuje)
    let writeCartId = cart_id;
    try {
      if (ownerUid && cart_id) {
        const existSnap = await adminDatabase.ref(`users/${ownerUid}/abandoned_carts/${cart_id}`).get();
        if (existSnap.exists()) {
          const ex = existSnap.val() || {};
          if (ex.user_email && ex.user_email !== user_email) {
            const suffix = Buffer.from(String(user_email)).toString('base64').replace(/[^a-z0-9]/gi,'').slice(0,6);
            writeCartId = `${cart_id}_${suffix}`;
          }
        }
      }
    } catch(_) {}

    // Sačuvaj u Realtime Database (stabilno i dostupno lokalno)
    const cartData = {
      cart_id: writeCartId,
      user_email,
      user_name: user_name || null,
      user_phone: user_phone || null,
      items: cart_items,
      status: is_abandoned ? 'abandoned' : 'pending',
      createdAt: timestamp || Date.now(),
      updatedAt: Date.now(),
      tracking_id: tracking_id || null,
      page_url: page_url || null,
      platform: 'custom_checkout',
      store_name: derivedStoreName || null,
      owner_uid: ownerUid || null,
    };

    // Upisuj isključivo pod korisnikom radi izolacije podataka po accountu
    if (ownerUid) {
      try { await adminDatabase.ref(`users/${ownerUid}/abandoned_carts/${writeCartId}`).set(cartData); } catch(_) {}
    } else {
      // Ako ne možemo odrediti vlasnika, ne upisujemo globalno
      console.warn('[Cart Tracking] ⚠️ ownerUid not resolved; cart will not be stored globally');
    }

    console.log('[Cart Tracking] ✅ Korpa sačuvana:', cart_id);

    // Ako je korpa napuštena, automatski pokreni email kampanju
    // Force sending when abandoned (ignore items length)
    if (is_abandoned) {
      console.log('[Cart Tracking] 🚨 Detektovana napuštena korpa - pokrećem email kampanju');
      
      try {
        // Pročitaj per-user anti-spam postavke (sa podrazumijevanim vrijednostima)
        let lockMs = 45000; // 45s
        let dailyMax = 1;   // 1 email/dan po adresi
        let perCartMax = 3; // max 3 dana po jednom cartu
        let cooldownMs = 60000; // minimalni razmak između mailova po cartu
        try {
          if (ownerUid) {
            const setSnap = await adminDatabase.ref(`users/${ownerUid}/settings/antispam`).get();
            if (setSnap.exists()) {
              const s = setSnap.val() || {};
              lockMs = Number(s.lockMs || lockMs);
              dailyMax = Number(s.dailyMax || dailyMax);
              perCartMax = Number(s.perCartMax || perCartMax);
              cooldownMs = Number(s.cooldownMs || cooldownMs);
            }
          }
        } catch(_) {}

        // Daily limiter
        const date = new Date();
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth()+1).padStart(2,'0');
        const d = String(date.getUTCDate()).padStart(2,'0');
        const dayKey = `${y}${m}${d}`;
        let dailyRef = null; let todaysCount = 0;
        if (ownerUid) {
          try {
            dailyRef = adminDatabase.ref(`users/${ownerUid}/daily_sends/${emailKey}/${dayKey}`);
            const snap = await dailyRef.get();
            todaysCount = snap.exists() ? Number(snap.val() || 0) : 0;
            if (todaysCount >= dailyMax) {
              console.log('[Cart Tracking] ⛔ Daily limit reached for', user_email);
              diag.alreadySentToday = true;
              return res.status(200).json({ success: true, skipped: 'already_sent_today', diag });
            }
          } catch(_) {}
        }

        // Lock (kratki burst zaštita) - transakcijski da ne dođe do trke
        if (ownerUid) {
          try {
            const lockRef = adminDatabase.ref(`users/${ownerUid}/locks/${emailKey}`);
            const tr = await lockRef.transaction(cur => {
              const nowTs = Date.now();
              if (cur && (nowTs - cur) < lockMs) {
                return; // abort transaction -> committed=false
              }
              return nowTs; // set new lock timestamp
            }, {applyLocally: false});
            if (!tr.committed) {
              console.log('[Cart Tracking] 🔒 Lock held, skipping for', user_email);
              diag.locked = true;
              return res.status(200).json({ success: true, skipped: 'locked', diag });
            }
          } catch(_) {}
        }

        // Trigger abandoned cart email (pozovi postojeći sistem)
        // Derive store name from origin/referrer host
        let hostName = '';
        try {
          const o = req.headers.origin || req.headers.referer || '';
          if (o) hostName = new URL(o).hostname || '';
        } catch (_) {}
        const store_name = hostName && hostName.replace(/^www\./,'');
        // Prefer template subject/body if exists for this store/user
        let preferredSubject = null;
        let templateHtml = null;
        let ownerUidTpl = null;
        try {
          const storeKey = (store_name || 'default').replace(/\./g,'_');
          // 1) direct store templates (optional)
          const tplRef = adminDatabase.ref(`store_templates/${storeKey}/abandoned_cart`);
          const tplSnap = await tplRef.get();
          if (tplSnap.exists()) {
            const v = tplSnap.val() || {};
            preferredSubject = v.subject || preferredSubject;
            templateHtml = v.html || templateHtml;
          }
          // 2) mapping store -> uid, read user's templates if available
          const ownerSnap = await adminDatabase.ref(`storeOwners/${storeKey}`).get();
          if (ownerSnap.exists()) ownerUidTpl = ownerSnap.val();
          if (ownerUidTpl) {
            const userTplSnap = await adminDatabase.ref(`users/${ownerUidTpl}/email_templates`).get();
            if (userTplSnap.exists()) {
              const all = userTplSnap.val() || {};
              let latest = null;
              Object.values(all).forEach(t => {
                if ((t.campaignType || '') === 'abandoned_cart') {
                  if (!latest || (t.updatedAt || 0) > (latest.updatedAt || 0)) latest = t;
                }
              });
              if (latest) {
                preferredSubject = latest.subject || preferredSubject;
                templateHtml = latest.htmlContent || templateHtml;
              }
            }
          }
        } catch(_) {}

        await triggerAbandonedCartEmail({
          user_email,
          user_name,
          cart_items,
          cart_id: writeCartId,
          page_url,
          store_name,
          preferredSubject,
          templateHtml,
          owner_uid: ownerUid || ownerUidTpl || null,
        });

        console.log('[Cart Tracking] ✉️ Email kampanja pokrenuta za:', user_email);
        // Upiši dnevni send count nakon uspješnog slanja
        try {
          if (dailyRef) {
            await dailyRef.set((todaysCount || 0) + 1);
          }
        } catch(_) {}
      } catch (emailError) {
        console.error('[Cart Tracking] ❌ Greška pri slanju emaila:', emailError);
        diag.brevoError = emailError?.message || String(emailError);
        // Ne vraćaj grešku korisniku, samo logiraj
      }
    }

    res.status(200).json({
      success: true,
      message: 'Cart data received successfully',
      cart_id,
      is_abandoned,
      diag,
    });

  } catch (error) {
    console.error('[Cart Tracking] ❌ Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Automatski šalje email za napuštenu korpu
 */
async function triggerAbandonedCartEmail(cartData) {
  const { user_email, user_name, cart_items, cart_id, page_url, store_name, preferredSubject, templateHtml, owner_uid } = cartData;

  // Pripremi podatke za email
  const customerData = {
    name: user_name || 'friend',
    email: user_email,
    storeName: store_name || 'Your Store',
    productName: cart_items[0]?.name || 'product',
    cartUrl: page_url || 'https://yourstore.com/checkout',
  };

  // Generiši email sadržaj sa AI-jem (koristi postojeći sistem)
  try {
    const { generateEmailContent } = require('../../lib/openai');
    let subject = preferredSubject || 'You left items in your cart';
    let body = 'Complete your purchase to secure your items.';
    try {
      if (!templateHtml) {
        const generated = await generateEmailContent('abandoned_cart', customerData);
        subject = generated.subject || subject;
        body = generated.body || body;
      }
    } catch (aiErr) {
      console.error('[Cart Tracking] ⚠️ OpenAI generation failed, using fallback:', aiErr?.message || aiErr);
    }

    // Anti-spam limiter: maksimalno 3 emaila po korisniku u 24h i pauza >= 60s
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const MIN_GAP_MS = 60 * 1000; // 1 minute gap
    const emailKey = Buffer.from(String(user_email || '').toLowerCase()).toString('base64');

    const emailLimitRef = owner_uid 
      ? adminDatabase.ref(`users/${owner_uid}/email_limits/${emailKey}`)
      : adminDatabase.ref(`email_limits/${emailKey}`);
    const emailLimitSnap = await emailLimitRef.get();
    let emailLimit = emailLimitSnap.exists() ? emailLimitSnap.val() : { count24h: 0, windowStart: now, lastSentAt: 0 };
    if (!emailLimit.windowStart || now - emailLimit.windowStart > ONE_DAY) {
      emailLimit = { count24h: 0, windowStart: now, lastSentAt: emailLimit.lastSentAt || 0 };
    }
    // Campaign requirement: send at most 1 email per day, for 3 consecutive days
    if (emailLimit.count24h >= 1) {
      console.log('[Cart Tracking] ⛔ Daily limit reached for', user_email);
      return;
    }
    if (now - (emailLimit.lastSentAt || 0) < MIN_GAP_MS) {
      console.log('[Cart Tracking] ⏱️ Throttled for', user_email);
      return;
    }

    // Per-cart limiter (spriječi višestruko slanje za isti cart_id)
    try {
      const cartRefMeta = adminDatabase.ref(`abandoned_carts/${cart_id}/email_meta`);
      const metaSnap = await cartRefMeta.get();
      const meta = metaSnap.exists() ? metaSnap.val() : { dayCount: 0, lastSentAt: 0 };
      if ((meta.dayCount || 0) >= 3) {
        console.log('[Cart Tracking] ⛔ Campaign completed (3 days) for', cart_id);
        return;
      }
      if (now - (meta.lastSentAt || 0) < MIN_GAP_MS) {
        console.log('[Cart Tracking] ⏱️ Cart throttled for', cart_id);
        return;
      }
    } catch (_) {}

    // Pošalji email preko Brevo API-ja
    // Prefer per-user Brevo config; fallback na env
    let brevoApiKey = process.env.BREVO_API_KEY;
    let brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@example.com';
    try {
      if (owner_uid) {
        const cfgSnap = await adminDatabase.ref(`users/${owner_uid}/integrations/brevo`).get();
        if (cfgSnap.exists()) {
          const cfg = cfgSnap.val() || {};
          brevoApiKey = cfg.apiKey || brevoApiKey;
          brevoSenderEmail = cfg.senderEmail || brevoSenderEmail;
        }
      }
    } catch(_) {}

    if (!brevoApiKey) {
      console.error('[Cart Tracking] ⚠️ BREVO_API_KEY nije postavljen');
      return;
    }

    // Formatiraj cart items za email
    const cartItemsHtml = cart_items.map(item => `
      <li style="background:#f3f4f6;padding:12px;border-radius:8px;margin-bottom:8px;color:#111827">
        <strong>${item.name}</strong><br>
        <span style="font-size:12px;color:#6b7280">Qty: ${item.quantity} | Price: ${item.price}</span>
      </li>
    `).join('');

    const msgId = Buffer.from(`${user_email}:${cart_id}:${Date.now()}`).toString('base64');
    // Zapiši samo pod korisnikom (bez globalne poruke)
    try {
      if (owner_uid) {
        await adminDatabase.ref(`users/${owner_uid}/messages/${msgId}`).set({ user_email, cart_id, created_at: now });
      }
    } catch(_) {}
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const trackOpen = `${base}/api/track/open?m=${encodeURIComponent(msgId)}&uid=${encodeURIComponent(owner_uid||'')}&c=${encodeURIComponent(cart_id)}`;
    const trackClick = (u) => `${base}/api/track/click?m=${encodeURIComponent(msgId)}&uid=${encodeURIComponent(owner_uid||'')}&c=${encodeURIComponent(cart_id)}&u=${encodeURIComponent(u)}`;

    const htmlContent = `
      <div style="font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#ffffff;padding:0;margin:0">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
          <tr>
            <td style="padding:24px;text-align:left;color:#111827">
              <div style="font-size:22px;line-height:1.3;font-weight:800;letter-spacing:.2px">${subject}</div>
              <div style="opacity:.8;margin-top:6px;font-size:14px">A reminder from ${customerData.storeName}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;color:#374151">
              <p style="margin:0 0 10px;font-size:15px">Hello ${user_name ? user_name : 'there'},</p>
              ${body.split('\n').map(line => `<p style=\"margin:0 0 10px;font-size:15px\">${line}</p>`).join('')}
              <div style="margin:16px 0 8px;font-weight:700;color:#111827">Items in your cart</div>
              <ul style="list-style:none;padding:0;margin:8px 0">${cartItemsHtml}</ul>
              <div style="text-align:left;margin-top:18px">
                <a href="${trackClick((page_url || 'https://yourstore.com/checkout') + '?cart_id=' + cart_id)}" style="background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block">Complete your purchase</a>
              </div>
              <p style="font-size:12px;color:#6b7280;text-align:left;margin-top:18px">If you’ve already completed your order, you can safely ignore this message.</p>
              <img src="${trackOpen}" width="1" height="1" style="display:block;border:0;outline:none;" alt="" />
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px;text-align:left;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb">© ${new Date().getFullYear()} ${customerData.storeName}</td>
          </tr>
        </table>
      </div>
    `;

    const emailPayload = {
      sender: { 
        email: brevoSenderEmail, 
        name: customerData.storeName 
      },
      to: [{ 
        email: user_email,
        name: user_name || undefined,
      }],
      subject: subject,
      htmlContent: (templateHtml || htmlContent),
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      let errBody = '';
      try { errBody = await response.text(); } catch (_) {}
      console.error('[Cart Tracking] ❌ Brevo error:', response.status, errBody);
      throw new Error(`Brevo API error: ${response.status} ${response.statusText} ${errBody}`);
    }
    try { const bodyTxt = await response.text(); console.log('[Cart Tracking] Brevo response body:', bodyTxt); } catch(_) {}

    console.log('[Cart Tracking] ✅ Email uspješno poslan na:', user_email);

    // Ažuriraj status u bazi (samo pod korisnikom)
    if (owner_uid) {
      try { await adminDatabase.ref(`users/${owner_uid}/abandoned_carts/${cart_id}`).update({ email_sent: true, email_sent_at: now, status: 'email_sent' }); } catch(_) {}
    }

    // Update per-cart meta atomically & increment global 'sent' for dashboard
    try {
      await adminDatabase.ref(`abandoned_carts/${cart_id}/email_meta`).transaction((cur) => {
        const c = cur && typeof cur === 'object' ? cur : {};
        return { lastSentAt: now, dayCount: (c.dayCount || 0) + 1 };
      });
    } catch (_) {}

    try {
      if (owner_uid) {
        await adminDatabase.ref(`users/${owner_uid}/stats`).transaction((cur)=>{
          const s = cur && typeof cur === 'object' ? cur : {};
          return { ...s, sent: (s.sent||0)+1 };
        });
      }
    } catch(_) {}

    // Update global email limit
    await emailLimitRef.set({
      count24h: 1, // exactly one mail today
      windowStart: emailLimit.windowStart,
      lastSentAt: now,
    });

  } catch (error) {
    console.error('[Cart Tracking] ❌ Greška pri slanju emaila:', error);
    throw error;
  }
}


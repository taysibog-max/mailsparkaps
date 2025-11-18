/**
 * Automation Helper Functions
 * For email generation, duplicate prevention, and automation logic
 */

import OpenAI from 'openai';

// Initialize OpenAI (singleton pattern)
let openaiInstance = null;

function getOpenAI() {
  if (!openaiInstance && process.env.OPENAI_API_KEY) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

/**
 * Campaign configurations for different types
 */
const CAMPAIGN_CONFIGS = {
  abandoned_cart: {
    systemPrompt: 'You are an expert email marketer specializing in cart recovery. Write persuasive, friendly emails that encourage customers to complete their purchase.',
    goal: 'Recover abandoned shopping cart and drive conversion',
    tone: 'Friendly, helpful, with urgency',
    cta: 'Complete Your Purchase',
  },
  welcome_email: {
    systemPrompt: 'You are a friendly brand representative welcoming new customers. Write warm, engaging welcome emails.',
    goal: 'Welcome new customer and introduce brand',
    tone: 'Warm, welcoming, enthusiastic',
    cta: 'Start Shopping',
  },
  post_purchase: {
    systemPrompt: 'You are a customer success specialist writing thank you emails. Express gratitude and provide helpful post-purchase information.',
    goal: 'Thank customer for purchase and provide order confirmation',
    tone: 'Grateful, supportive, professional',
    cta: 'Track Your Order',
  },
  review_request: {
    systemPrompt: 'You are a customer experience manager requesting product reviews. Write polite, non-pushy review request emails.',
    goal: 'Request product review from satisfied customer',
    tone: 'Polite, appreciative, non-pushy',
    cta: 'Leave a Review',
  },
  reactivation: {
    systemPrompt: 'You are a retention specialist re-engaging inactive customers. Write compelling emails that bring customers back.',
    goal: 'Re-engage inactive customer and drive return visit',
    tone: 'Excited, enticing, special offer focused',
    cta: 'Welcome Back - Shop Now',
  },
};

/**
 * Generate AI-powered email content
 * @param {string} campaignType - Type of campaign
 * @param {object} customerData - Customer information
 * @returns {Promise<{subject: string, htmlContent: string}>}
 */
export async function generateEmailContent(campaignType, customerData = {}) {
  const openai = getOpenAI();
  
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const config = CAMPAIGN_CONFIGS[campaignType];
  if (!config) {
    throw new Error(`Unknown campaign type: ${campaignType}`);
  }

  const { customerName, customerEmail, cartItems, orderNumber, productName, lastVisit } = customerData;

  // Build prompt based on campaign type
  let userPrompt = `Generate an email for a ${campaignType.replace('_', ' ')} campaign.\n\n`;
  userPrompt += `Customer Name: ${customerName || 'Valued Customer'}\n`;
  userPrompt += `Email: ${customerEmail || 'customer@example.com'}\n\n`;

  if (campaignType === 'abandoned_cart' && cartItems && cartItems.length > 0) {
    userPrompt += `Cart Items:\n`;
    cartItems.forEach((item, idx) => {
      userPrompt += `${idx + 1}. ${item.name} - Quantity: ${item.quantity} - Price: ${item.price}\n`;
    });
    userPrompt += `\n`;
  }

  if (campaignType === 'post_purchase' && orderNumber) {
    userPrompt += `Order Number: ${orderNumber}\n\n`;
  }

  if (campaignType === 'review_request' && productName) {
    userPrompt += `Product Name: ${productName}\n\n`;
  }

  if (campaignType === 'reactivation' && lastVisit) {
    userPrompt += `Last Visit: ${lastVisit}\n\n`;
  }

  userPrompt += `Goal: ${config.goal}\n`;
  userPrompt += `Tone: ${config.tone}\n`;
  userPrompt += `CTA: ${config.cta}\n\n`;
  // Add discount guidance for abandoned carts
  if (campaignType === 'abandoned_cart') {
    userPrompt += `Include a limited-time 10% discount code (SAVE10) valid for 24 hours if they complete the purchase now.\n`;
  }
  userPrompt += `Generate ONLY the email subject and HTML body. Format as JSON: {"subject": "...", "htmlContent": "..."}\n`;
  userPrompt += `Make the HTML professional with inline CSS. Include the CTA button.\n`;
  userPrompt += `IMPORTANT: Write in ENGLISH language only!`;

  console.log('[OpenAI] Generating email content for:', campaignType);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: config.systemPrompt + ' Write professional, personalized emails in ENGLISH language only.',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Try to parse JSON response
    let emailData;
    try {
      // Remove markdown code blocks if present
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      emailData = JSON.parse(cleanedText);
    } catch (parseError) {
      // Fallback: extract subject and body manually
      const subjectMatch = responseText.match(/subject['":\s]+([^"'\n]+)/i);
      const htmlMatch = responseText.match(/htmlContent['":\s]+([^"'\n]+)/i) || 
                        responseText.match(/body['":\s]+([^"'\n]+)/i);
      
      emailData = {
        subject: subjectMatch ? subjectMatch[1] : `${config.cta} - ${customerName || 'Valued Customer'}`,
        htmlContent: htmlMatch ? htmlMatch[1] : responseText,
      };
    }

    console.log('[OpenAI] ✅ Email content generated');

    return {
      subject: emailData.subject || `${config.cta}`,
      htmlContent: emailData.htmlContent || emailData.body || responseText,
    };

  } catch (error) {
    console.error('[OpenAI] Error generating email:', error);
    throw error;
  }
}

/**
 * Check if email was already sent to prevent duplicates
 * @param {object} adminDatabase - Firebase Admin Database instance
 * @param {string} userId - User ID
 * @param {string} eventId - Event ID (cart ID, order ID, etc.)
 * @param {string} campaignType - Campaign type
 * @returns {Promise<boolean>}
 */
export async function wasEmailSent(adminDatabase, userId, eventId, campaignType) {
  try {
    const sentEmailRef = adminDatabase.ref(`users/${userId}/sent_emails/${eventId}_${campaignType}`);
    const snapshot = await sentEmailRef.once('value');
    return snapshot.exists();
  } catch (error) {
    console.error('[Automation] Error checking email status:', error);
    return false;
  }
}

/**
 * Mark email as sent to prevent duplicates
 * @param {object} adminDatabase - Firebase Admin Database instance
 * @param {string} userId - User ID
 * @param {string} eventId - Event ID
 * @param {string} campaignType - Campaign type
 * @param {object} emailData - Email metadata
 */
export async function markEmailAsSent(adminDatabase, userId, eventId, campaignType, emailData = {}) {
  try {
    const sentEmailRef = adminDatabase.ref(`users/${userId}/sent_emails/${eventId}_${campaignType}`);
    await sentEmailRef.set({
      eventId,
      campaignType,
      sentAt: Date.now(),
      to: emailData.to,
      subject: emailData.subject,
      status: 'sent',
    });
    console.log('[Automation] ✅ Email marked as sent:', `${eventId}_${campaignType}`);
  } catch (error) {
    console.error('[Automation] Error marking email as sent:', error);
  }
}

/**
 * Get active campaign for user
 * @param {object} adminDatabase - Firebase Admin Database instance
 * @param {string} userId - User ID
 * @param {string} campaignType - Campaign type
 * @returns {Promise<object|null>}
 */
export async function getActiveCampaign(adminDatabase, userId, campaignType) {
  try {
    const DEBUG = String(process.env.AUTOMATION_DEBUG || '').trim() === '1';
    // Read both active campaigns and drafts (defensive: some UIs may save wrong bucket)
    const campaignsRef = adminDatabase.ref(`users/${userId}/campaigns`);
    const draftsRef = adminDatabase.ref(`users/${userId}/campaigns_drafts`);
    const [snapshot, draftsSnap] = await Promise.all([
      campaignsRef.once('value'),
      draftsRef.once('value').catch(() => null),
    ]);
    
    if (!snapshot.exists()) {
      // If there are zero regular campaigns but drafts exist, we still continue
      if (!draftsSnap || !draftsSnap.exists()) {
        return null;
      }
    }

    const campaignsData = snapshot.exists() ? (snapshot.val() || {}) : {};
    const draftsData = draftsSnap && draftsSnap.exists() ? (draftsSnap.val() || {}) : {};
    // Merge nodes (drafts won't pass isActive unless explicitly set)
    const campaigns = { ...campaignsData, ...draftsData };
    if (DEBUG) {
      try {
        const keys = Object.keys(campaigns);
        console.log('[Automation][debug] getActiveCampaign:', {
          userId,
          campaignType,
          keysCount: keys.length,
          keysPreview: keys.slice(0, 5),
        });
      } catch (_) {}
    }

    // Helper to normalize campaign type strings (e.g., "Abandoned Cart" -> "abandoned_cart")
    const normalizeType = (t) => {
      const v = String(t || '')
        .toLowerCase()
        .normalize('NFD')                // remove diacritics
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_')         // treat spaces and hyphens equally
        .trim();
      // Treat legacy/default Brevo type as abandoned cart in our automation
      return v === 'classic' ? 'abandoned_cart' : v;
    };

    const targetType = normalizeType(campaignType);
    const isActive = (c) => {
      const raw = (c?.status ?? c?.sender?.status);
      const s = String(raw ?? '').toLowerCase();
      // Accept common variants and booleans/numbers-as-strings
      return (
        s === 'active' ||
        s === 'enabled' ||
        s === 'running' ||
        s === 'live' ||
        s === 'on' ||
        s === 'published' ||
        raw === true ||
        raw === 1 ||
        s === '1'
      ) || c?.enabled === true;
    };

    // 1) Exact match by explicit metadata.campaignType (preferred)
    let campaignId = Object.keys(campaigns).find(id => {
      const campaign = campaigns[id];
      const storedType = normalizeType(
        campaign?.metadata?.campaignType || campaign?.type
      );
      return isActive(campaign) && storedType === targetType;
    });

    // 2) Heuristic: infer type from campaign name when metadata missing
    if (!campaignId) {
      // First try ACTIVE by name
      campaignId = Object.keys(campaigns).find(id => {
        const c = campaigns[id];
        if (!isActive(c)) return false;
        const name = String(c?.name || c?.metadata?.name || '').toLowerCase();
        const looksAbandoned = name.includes('abandoned') || name.includes('napu') || name.includes('cart');
        const looksWelcome = name.includes('welcome');
        const looksPostPurchase = name.includes('post') || name.includes('thank');
        const inferred =
          looksAbandoned ? 'abandoned_cart' :
          looksWelcome ? 'welcome_email' :
          looksPostPurchase ? 'post_purchase' : null;
        return inferred === targetType;
      });
      // If no ACTIVE by name, allow ANY by name (covers slučaj kad status stoji u sender.status ili nedostaje)
      if (!campaignId) {
        campaignId = Object.keys(campaigns).find(id => {
          const c = campaigns[id];
          const name = String(c?.name || c?.metadata?.name || '').toLowerCase();
          const looksAbandoned = name.includes('abandoned') || name.includes('napu') || name.includes('cart');
          const looksWelcome = name.includes('welcome');
          const looksPostPurchase = name.includes('post') || name.includes('thank');
          const inferred =
            looksAbandoned ? 'abandoned_cart' :
            looksWelcome ? 'welcome_email' :
            looksPostPurchase ? 'post_purchase' : null;
          return inferred === targetType;
        });
      }
    }

    // 3) Fallback: if there's exactly one active campaign, use it
    if (!campaignId) {
      const activeIds = Object.keys(campaigns).filter(id => isActive(campaigns[id]));
      if (activeIds.length === 1) {
        campaignId = activeIds[0];
      }
    }

    // 4) Last-resort within this user: if there's exactly one campaign with matching type
    // regardless of status (covers mis-set status cases), use it.
    if (!campaignId) {
      const typeMatchedIds = Object.keys(campaigns).filter(id => {
        const c = campaigns[id];
        const storedType = normalizeType(c?.metadata?.campaignType || c?.type);
        return storedType === targetType;
      });
      if (typeMatchedIds.length === 1) {
        campaignId = typeMatchedIds[0];
      }
    }

    // 5) Absolute last-resort: ako postoji samo jedna kampanja ukupno, koristi je
    if (!campaignId) {
      const allIds = Object.keys(campaigns);
      if (allIds.length === 1) {
        campaignId = allIds[0];
      }
    }
    // 6) Pick the most recently updated/created campaign as a defensive default
    if (!campaignId) {
      const entries = Object.entries(campaigns || {});
      if (entries.length > 0) {
        entries.sort((a, b) => {
          const aTime = Number(b?.[1]?.updatedAt || b?.[1]?.createdAt || 0);
          const bTime = Number(a?.[1]?.updatedAt || a?.[1]?.createdAt || 0);
          return aTime - bTime;
        });
        campaignId = entries[0][0];
      }
    }

    if (!campaignId) {
      if (DEBUG) {
        try {
          console.log('[Automation][debug] No campaignId matched for', { userId, targetType });
        } catch (_) {}
      }
      return null;
    }

    // Auto-normalize/persist fixes if needed (so naredni put bude čist)
    try {
      const selected = campaigns[campaignId] || {};
      const ref = adminDatabase.ref(`users/${userId}/campaigns/${campaignId}`);
      const normalizedType = normalizeType(selected?.metadata?.campaignType || selected?.type);
      const rootStatus = String(selected?.status ?? '').toLowerCase();
      const senderStatus = String(selected?.sender?.status ?? '').toLowerCase();
      const shouldSetType = normalizedType !== targetType;
      const shouldSetStatus =
        !rootStatus ||
        (rootStatus !== 'active' && senderStatus === 'active');
      if (shouldSetType || shouldSetStatus) {
        const patch = {};
        if (shouldSetType) {
          patch['metadata'] = { ...(selected?.metadata || {}), campaignType: targetType };
        }
        if (shouldSetStatus) {
          patch['status'] = 'active';
        }
        await ref.update({ ...patch, updatedAt: Date.now() }).catch(() => {});
        if (DEBUG) {
          console.log('[Automation][debug] Campaign node normalized for', { userId, campaignId, patchApplied: Object.keys(patch) });
        }
      }
    } catch (_) {}

    return {
      id: campaignId,
      ...campaigns[campaignId],
    };
  } catch (error) {
    console.error('[Automation] Error fetching active campaign:', error);
    return null;
  }
}

/**
 * Send automated email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Email HTML content
 * @param {object} sender - Sender info { name, email }
 * @returns {Promise<object>}
 */
export async function sendAutomatedEmail(to, subject, htmlContent, sender = {}) {
  try {
    // Try multiple bases for dev/prod compatibility
    const bases = [];
    if (process.env.NEXT_PUBLIC_APP_URL) bases.push(process.env.NEXT_PUBLIC_APP_URL);
    if (process.env.VERCEL_URL) bases.push(`https://${process.env.VERCEL_URL}`);
    bases.push('http://localhost:3002', 'http://localhost:3000');

    let lastErr = null;
    for (const base of bases) {
      try {
        const url = `${base}/api/brevo/send-email`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to,
            subject,
            htmlContent,
            senderName: sender.name,
            senderEmail: sender.email,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) return data;
        lastErr = new Error(data?.error || `Failed via ${url}`);
      } catch (e) {
        lastErr = e;
      }
    }

    // Final fallback: call Brevo API directly from server if available
    if (process.env.BREVO_API_KEY) {
      const direct = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: sender.name || 'Your Store',
            email: sender.email || process.env.SENDER_EMAIL || 'noreply@yourdomain.com',
          },
          to: [{ email: to }],
          subject,
          htmlContent,
        }),
      });
      const d = await direct.json().catch(() => ({}));
      if (!direct.ok) {
        throw new Error(d?.message || d?.error || 'Brevo direct send failed');
      }
      return d;
    }

    throw lastErr || new Error('Failed to send email');
  } catch (error) {
    console.error('[Automation] Error sending email:', error);
    throw error;
  }
}


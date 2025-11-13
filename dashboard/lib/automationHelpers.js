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
    const campaignsRef = adminDatabase.ref(`users/${userId}/campaigns`);
    const snapshot = await campaignsRef.once('value');
    
    if (!snapshot.exists()) {
      return null;
    }

    const campaigns = snapshot.val();

    // Helper to normalize campaign type strings (e.g., "Abandoned Cart" -> "abandoned_cart")
    const normalizeType = (t) => String(t || '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .trim();

    const targetType = normalizeType(campaignType);

    const campaignId = Object.keys(campaigns).find(id => {
      const campaign = campaigns[id];
      const storedType = normalizeType(
        campaign?.metadata?.campaignType || campaign?.type
      );
      return campaign.status === 'active' && storedType === targetType;
    });

    if (!campaignId) {
      return null;
    }

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


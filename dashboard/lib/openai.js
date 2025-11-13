'use strict';

import OpenAI from 'openai';

/**
 * Initialize OpenAI client
 */
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  return new OpenAI({ apiKey });
}

/**
 * Campaign type configurations for AI prompts
 */
const CAMPAIGN_CONFIGS = {
  abandoned_cart: {
    title: 'Abandoned Cart Email',
    goal: 'remind customers to complete their purchase',
    tone: 'friendly and encouraging',
    cta: 'Complete Your Purchase',
  },
  welcome_email: {
    title: 'Welcome Email',
    goal: 'welcome new customers',
    tone: 'warm and professional',
    cta: 'Start Shopping',
  },
  post_purchase: {
    title: 'Post Purchase Email',
    goal: 'thank customer for their purchase',
    tone: 'grateful and informative',
    cta: 'View Your Order',
  },
  review_request: {
    title: 'Review Request Email',
    goal: 'request product review',
    tone: 'polite and encouraging',
    cta: 'Leave a Review',
  },
  reactivation: {
    title: 'Reactivation Email',
    goal: 'reactivate inactive customers',
    tone: 'enthusiastic with special offer',
    cta: 'Shop Again',
  },
};

/**
 * Generate personalized email content using OpenAI
 * @param {string} campaignType - Type of campaign (abandoned_cart, welcome_email, etc.)
 * @param {object} customerData - Customer and product data
 * @returns {Promise<{subject: string, body: string}>}
 */
export async function generateEmailContent(campaignType, customerData = {}) {
  try {
    const client = getOpenAIClient();
    const config = CAMPAIGN_CONFIGS[campaignType] || CAMPAIGN_CONFIGS.welcome_email;

    // Build context from customer data
    const customerName = customerData.name || customerData.firstName || 'kupče';
    const storeName = customerData.storeName || 'naša prodavnica';
    const productName = customerData.productName || customerData.product || 'proizvod';
    const productPrice = customerData.price || '';
    
    // Create detailed prompt
    const prompt = buildPrompt(config, {
      customerName,
      storeName,
      productName,
      productPrice,
      campaignType,
    });

    // Call OpenAI API
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Using efficient model
      messages: [
        {
          role: 'system',
          content: 'You are an expert in email marketing for e-commerce stores. Write professional, personalized emails in ENGLISH language only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const generatedText = response.choices[0].message.content.trim();

    // Parse subject and body
    const parsed = parseEmailContent(generatedText);

    return {
      subject: parsed.subject,
      body: parsed.body,
      generatedAt: new Date().toISOString(),
      campaignType,
      model: 'gpt-4o-mini',
    };

  } catch (error) {
    console.error('[OpenAI] Error generating email:', error);
    throw new Error(`AI generisanje nije uspjelo: ${error.message}`);
  }
}

/**
 * Build OpenAI prompt based on campaign type and customer data
 */
function buildPrompt(config, data) {
  const { customerName, storeName, productName, productPrice, campaignType } = data;

  let prompt = `Write a professional ${config.title} for an e-commerce store.\n\n`;
  prompt += `Goal: ${config.goal}\n`;
  prompt += `Tone: ${config.tone}\n\n`;
  prompt += `Details:\n`;
  prompt += `- Customer name: ${customerName}\n`;
  prompt += `- Store name: ${storeName}\n`;
  
  if (campaignType === 'abandoned_cart') {
    prompt += `- Product in cart: ${productName}\n`;
    if (productPrice) {
      prompt += `- Price: ${productPrice}\n`;
    }
    prompt += `\nAdd motivation to complete purchase (e.g., "Limited availability" or "Complete your order within 24h").\n`;
  } else if (campaignType === 'welcome_email') {
    prompt += `\nAdd a warm welcome and brief store overview.\n`;
  } else if (campaignType === 'post_purchase') {
    prompt += `- Purchased product: ${productName}\n`;
    prompt += `\nThank them for their purchase and provide useful delivery information.\n`;
  } else if (campaignType === 'review_request') {
    prompt += `- Product to review: ${productName}\n`;
    prompt += `\nPolitely request a product review.\n`;
  } else if (campaignType === 'reactivation') {
    prompt += `\nOffer a special discount (10-20%) to return.\n`;
  }

  prompt += `\nResponse format:\n`;
  prompt += `Subject: [short and catchy email subject]\n`;
  prompt += `Body: [email content with paragraphs and CTA button: "${config.cta}"]\n\n`;
  prompt += `Use HTML formatting for body (paragraphs: <p>, bold: <strong>, buttons: <a> with inline CSS).\n`;
  prompt += `Email should be short (200-300 words), personalized and positive.\n`;
  prompt += `IMPORTANT: Write in ENGLISH language only!`;

  return prompt;
}

/**
 * Parse OpenAI response into subject and body
 */
function parseEmailContent(text) {
  const lines = text.split('\n');
  let subject = '';
  let body = '';
  let isBody = false;

  for (const line of lines) {
    if (line.toLowerCase().startsWith('subject:')) {
      subject = line.replace(/^subject:\s*/i, '').trim();
    } else if (line.toLowerCase().startsWith('body:')) {
      body = line.replace(/^body:\s*/i, '').trim();
      isBody = true;
    } else if (isBody) {
      body += '\n' + line;
    }
  }

  // Fallback: if parsing failed, use first line as subject
  if (!subject && lines.length > 0) {
    subject = lines[0].replace(/^#+\s*/, '').trim();
    body = lines.slice(1).join('\n').trim();
  }

  // Clean up
  subject = subject.replace(/['"]/g, '').trim();
  body = body.trim();

  return { subject, body };
}

/**
 * Generate email for multiple recipients with personalization
 * @param {string} campaignType 
 * @param {Array} recipients - Array of customer objects
 * @returns {Promise<Array>}
 */
export async function generateBulkEmails(campaignType, recipients) {
  const results = [];

  for (const recipient of recipients.slice(0, 10)) { // Limit to 10 for cost
    try {
      const email = await generateEmailContent(campaignType, {
        name: recipient.name || recipient.email,
        storeName: 'Vaša Prodavnica',
      });
      
      results.push({
        recipient: recipient.email,
        ...email,
        status: 'success',
      });
    } catch (error) {
      results.push({
        recipient: recipient.email,
        status: 'error',
        error: error.message,
      });
    }
  }

  return results;
}


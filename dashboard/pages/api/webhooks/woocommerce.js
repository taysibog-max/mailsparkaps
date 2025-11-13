/**
 * WooCommerce Webhook Handler
 * POST /api/webhooks/woocommerce
 * 
 * Handles events: cart.abandoned, order.created, customer.created
 */

import { adminDatabase } from '../../../lib/firebaseAdmin';
import { extractContactFromEvent, saveOrUpdateContact } from '../../../lib/contactsHelpers';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyWooCommerceSignature(rawBody, signature, secret) {
  if (!secret) {
    console.warn('[WooCommerce Webhook] WEBHOOK_SECRET not set, skipping verification (dev mode)');
    return true;
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  return hash === signature;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const bodyText = rawBody.toString('utf8');
    const payload = JSON.parse(bodyText);

    // Verify signature
    const signature = req.headers['x-wc-webhook-signature'];
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!verifyWooCommerceSignature(bodyText, signature, webhookSecret)) {
      console.error('[WooCommerce Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Get event from header or payload
    const topic = req.headers['x-wc-webhook-topic'] || payload.event || 'unknown';
    console.log('[WooCommerce Webhook] Received:', topic);

    // Extract store URL and resolve owner uid from Realtime DB mapping
    const storeUrl = req.headers['x-wc-webhook-source'] || payload.store_url || 'unknown';
    let userId = storeUrl.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '_');
    try {
      const host = new URL(storeUrl).host || storeUrl;
      const keyHost = host.toLowerCase().replace(/[^a-z0-9.-]/gi, '_');
      const ownerSnap = await adminDatabase.ref(`storeOwners/${keyHost}`).once('value');
      if (ownerSnap.exists()) userId = ownerSnap.val();
    } catch (_) { /* fallback to sanitized storeUrl */ }

    let eventType = 'unknown';
    let eventData = {};

    // Handle different WooCommerce events
    if (topic.includes('cart') || topic.includes('abandoned')) {
      eventType = 'cart_abandoned';
      eventData = {
        cartId: payload.cart_id || payload.id,
        customerEmail: payload.user_email || payload.billing?.email,
        customerName: payload.customer_name || payload.billing?.first_name || 'Customer',
        items: (payload.cart_items || payload.line_items || []).map(item => ({
          id: item.id,
          productId: item.product_id,
          name: item.name || item.product_name,
          quantity: item.quantity,
          price: item.price || item.total,
          sku: item.sku,
        })),
        totalPrice: payload.cart_total || payload.total,
        currency: payload.currency || 'USD',
        status: 'pending',
        platform: 'woocommerce',
        storeUrl,
      };
    } else if (topic.includes('order.created') || topic.includes('order_created')) {
      eventType = 'order_created';
      eventData = {
        orderId: payload.id,
        orderNumber: payload.number || payload.order_number,
        customerEmail: payload.billing?.email,
        customerName: `${payload.billing?.first_name || ''} ${payload.billing?.last_name || ''}`.trim() || 'Customer',
        items: (payload.line_items || []).map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        totalPrice: payload.total,
        currency: payload.currency,
        platform: 'woocommerce',
        storeUrl,
      };
    } else if (topic.includes('customer.created') || topic.includes('customer_created')) {
      eventType = 'customer_created';
      eventData = {
        customerId: payload.id,
        customerEmail: payload.email,
        customerName: `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || 'Customer',
        platform: 'woocommerce',
        storeUrl,
      };
    }

    // Store event in Firebase
    const eventId = `woo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventRef = adminDatabase.ref(`events/${userId}/${eventType}/${eventId}`);
    
    await eventRef.set({
      ...eventData,
      eventId,
      eventType,
      topic,
      createdAt: Date.now(),
      processedAt: null,
      emailSent: false,
    });

    console.log('[WooCommerce Webhook] ✅ Event stored:', eventType, eventId);

    // Extract and save contact (async, don't wait)
    const contactData = extractContactFromEvent(eventData);
    if (contactData) {
      saveOrUpdateContact(adminDatabase, userId, contactData, eventType).catch(err => {
        console.error('[WooCommerce Webhook] Contact save error:', err);
      });
    }

    // Trigger automation
    triggerAutomation(userId, eventId, eventType, eventData).catch(err => {
      console.error('[WooCommerce Webhook] Automation trigger error:', err);
    });

    return res.status(200).json({
      success: true,
      eventId,
      eventType,
      message: 'Webhook received and processed',
    });

  } catch (error) {
    console.error('[WooCommerce Webhook] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

async function triggerAutomation(userId, eventId, eventType, eventData) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/automation/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        eventId,
        eventType,
        eventData,
      }),
    });

    if (!response.ok) {
      throw new Error('Automation trigger failed');
    }

    console.log('[WooCommerce Webhook] ✅ Automation triggered');
  } catch (error) {
    console.error('[WooCommerce Webhook] Automation trigger error:', error);
  }
}

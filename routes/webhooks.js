'use strict';

const express = require('express');
const crypto = require('crypto');
const { saveCart } = require('../utils/firebase');

const router = express.Router();

/**
 * Verify WooCommerce signature
 * @param {string} body - Raw request body
 * @param {string} signature - Signature header value
 * @param {string} secret - Webhook secret
 */
function verifyWooCommerceWebhook(body, signature, secret) {
  if (!secret) {
    console.warn('[Webhook] WEBHOOK_SECRET not set, skipping verification');
    return true;
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return hash === signature;
}

/**
 * POST /api/webhooks/cart
 * Receive cart abandoned events from WooCommerce
 */
router.post('/cart', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Get raw body for signature verification
    const rawBody = req.body.toString('utf8');
    const bodyData = JSON.parse(rawBody);

    // Detect platform and verify signature
    const wooSignature = req.headers['x-wc-webhook-signature'];
    const webhookSecret = process.env.WEBHOOK_SECRET;

    let isValid = false;
    let platform = 'woocommerce';

    if (wooSignature) {
      isValid = verifyWooCommerceWebhook(rawBody, wooSignature, webhookSecret);
    } else if (!webhookSecret) {
      // No signature header - allow in dev mode
      isValid = true;
      console.warn('[Webhook] No signature header detected, allowing in dev mode');
    }

    if (!isValid) {
      console.error('[Webhook] Invalid signature from', platform);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Extract cart data
    const cartData = extractCartData(bodyData, platform);

    if (!cartData) {
      return res.status(400).json({ error: 'Invalid cart data' });
    }

    // Validate required fields
    if (!cartData.cart_id || !cartData.user_email) {
      return res.status(400).json({ 
        error: 'Missing required fields: cart_id, user_email' 
      });
    }

    // Save to Firebase
    await saveCart(cartData.cart_id, {
      user_email: cartData.user_email,
      items: cartData.cart_items || [],
      timestamp: cartData.timestamp || Date.now(),
      platform,
    });

    console.log(`[Webhook] ✓ Cart saved from ${platform}: ${cartData.cart_id}`);

    res.status(200).json({ 
      success: true, 
      cart_id: cartData.cart_id,
      message: 'Cart data received and stored',
    });

  } catch (error) {
    console.error('[Webhook] Error processing cart webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * Extract cart data from webhook payload
 * Handles different formats from WooCommerce
 */
function extractCartData(payload, platform) {
  try {
    if (platform === 'woocommerce') {
      // WooCommerce cart format
      return {
        cart_id: payload.cart_id || payload.id,
        user_email: payload.user_email || payload.billing?.email,
        cart_items: (payload.cart_items || payload.line_items || []).map(item => ({
          id: item.id,
          product_id: item.product_id,
          name: item.name || item.product_name,
          quantity: item.quantity,
          price: item.price || item.total,
          sku: item.sku,
        })),
        timestamp: payload.timestamp || Date.now(),
      };
    }

    // Generic format (fallback)
    return {
      cart_id: payload.cart_id,
      user_email: payload.user_email,
      cart_items: payload.cart_items,
      timestamp: payload.timestamp,
    };

  } catch (error) {
    console.error('[Webhook] Error extracting cart data:', error);
    return null;
  }
}

/**
 * POST /api/webhooks/cart-completed
 * Mark cart as completed when user finishes checkout
 */
router.post('/cart-completed', express.json(), async (req, res) => {
  try {
    const { cart_id } = req.body;

    if (!cart_id) {
      return res.status(400).json({ error: 'Missing cart_id' });
    }

    const { updateCartStatus } = require('../utils/firebase');
    await updateCartStatus(cart_id, 'completed');

    console.log(`[Webhook] ✓ Cart marked as completed: ${cart_id}`);

    res.json({ success: true, cart_id });
  } catch (error) {
    console.error('[Webhook] Error marking cart as completed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/webhooks/test
 * Test endpoint to verify webhook is working
 */
router.get('/test', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Webhook endpoint is operational',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;



'use strict';

const fetch = require('node-fetch');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Send abandoned cart email via Brevo
 * @param {string} recipientEmail - Customer email
 * @param {Array} cartItems - Array of cart items
 * @param {string} cartId - Cart ID for checkout link
 */
async function sendAbandonedCartEmail(recipientEmail, cartItems, cartId) {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    throw new Error('BREVO_API_KEY not configured');
  }

  // Build email HTML content
  const htmlContent = buildAbandonedCartEmailHTML(cartItems, cartId);
  
  const payload = {
    sender: {
      name: process.env.BREVO_SENDER_NAME || 'Your Store',
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@yourstore.com',
    },
    to: [
      {
        email: recipientEmail,
      },
    ],
    subject: 'Zaboravili ste završiti kupovinu? 🛒',
    htmlContent,
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Brevo API error: ${data.message || response.statusText}`);
    }

    console.log(`[Brevo] ✓ Abandoned cart email sent to ${recipientEmail} (messageId: ${data.messageId})`);
    return data;
  } catch (error) {
    console.error('[Brevo] Failed to send email:', error.message);
    throw error;
  }
}

/**
 * Build HTML content for abandoned cart email
 * @param {Array} items - Cart items
 * @param {string} cartId - Cart ID
 */
function buildAbandonedCartEmailHTML(items, cartId) {
  const checkoutLink = process.env.CHECKOUT_URL 
    ? `${process.env.CHECKOUT_URL}?cart_id=${cartId}` 
    : `https://yourstore.com/checkout?cart_id=${cartId}`;

  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 15px; border-bottom: 1px solid #eee;">
        <strong>${item.name || item.title || 'Product'}</strong><br>
        <span style="color: #666; font-size: 14px;">
          Količina: ${item.quantity || 1}
          ${item.price ? ` | Cijena: ${formatPrice(item.price)}` : ''}
        </span>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🛒 Vaša korpa čeka!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 20px 0;">
                Primjetili smo da ste ostavili proizvode u vašoj korpi. Ne propustite ove fantastične artikle!
              </p>
              
              <h2 style="font-size: 20px; color: #333; margin: 30px 0 20px 0;">Proizvodi u vašoj korpi:</h2>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #eee; border-radius: 6px; overflow: hidden;">
                ${itemsHTML}
              </table>
              
              <div style="text-align: center; margin: 40px 0 20px 0;">
                <a href="${checkoutLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                  Završite kupovinu →
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; text-align: center; margin: 20px 0 0 0;">
                Imate pitanja? Kontaktirajte nas na ${process.env.BREVO_SENDER_EMAIL || 'support@yourstore.com'}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999; margin: 0;">
                © ${new Date().getFullYear()} Your Store. Sva prava zadržana.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Format price with currency
 * @param {number|string} price 
 */
function formatPrice(price) {
  if (typeof price === 'number') {
    return `${price.toFixed(2)} KM`;
  }
  return price;
}

module.exports = {
  sendAbandonedCartEmail,
};



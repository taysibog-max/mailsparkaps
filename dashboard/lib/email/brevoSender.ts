import { getUserTemplate, renderTemplate } from './template';
import { sanitizeEmail } from '../../utils/pixelTypes';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export interface SendAbandonedEmailArgs {
  uid: string;
  tokenKey: string;
  email: string;
  shopDomain?: string | null;
  abandonedAt: number;
  checkout?: Record<string, any> | null;
}

interface SendResult {
  ok: true;
}

export async function sendAbandonedEmail(args: SendAbandonedEmailArgs): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const recipient = sanitizeEmail(args.email);
  if (!recipient) {
    throw new Error('Invalid customer email');
  }

  const senderEmail = process.env.SENDER_EMAIL || process.env.FROM_EMAIL || 'hello@mailspark.app';
  const senderName = process.env.SENDER_NAME || 'MailSpark';

  const checkout: Record<string, any> = {
    ...(args.checkout || {}),
    customerEmail: recipient,
    shopDomain: args.shopDomain || args.checkout?.shopDomain || args.checkout?.shop_domain || null,
    abandoned_at: args.abandonedAt,
  };
  if (!checkout.checkout_url) {
    checkout.checkout_url = checkout.checkoutUrl || checkout.cart_url || checkout.url || '';
  }

  const template = await getUserTemplate(args.uid);
  const rendered = renderTemplate({ template, checkout });
  const htmlContent = rendered.html?.trim() ? rendered.html : buildFallbackHtml(checkout);
  const textContent = buildTextContent(checkout);

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [{ email: recipient }],
    subject: rendered.subject || 'Zaboravili ste nešto u korpi 🛒',
    htmlContent,
    textContent,
    headers: {
      'X-Mailer': 'MailSpark Pixel',
    },
  };

  await sendWithRetry(payload, apiKey);
  return { ok: true };
}

async function sendWithRetry(body: Record<string, any>, apiKey: string): Promise<void> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return;
      }

      const retryable = response.status === 429 || response.status >= 500;
      const errorText = await safeText(response);
      if (!retryable || attempt === maxAttempts) {
        throw new Error(`Brevo API responded with ${response.status}: ${errorText}`);
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
    }
    await sleep(500 * attempt);
  }
}

function buildFallbackHtml(checkout: Record<string, any>): string {
  const productTable = buildProductTable(checkout);
  const totalPrice = formatPrice(checkout.total_price || checkout.totalPrice || checkout.subtotal_price);
  const checkoutUrl = checkout.checkout_url || checkout.checkoutUrl || '#';
  const shop = checkout.shopDomain || checkout.shop_domain || 'našoj prodavnici';

  return `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:32px;">
      <table style="max-width:520px;margin:0 auto;background:white;border-radius:18px;padding:24px;">
        <tr><td style="font-size:12px;text-transform:uppercase;color:#6366f1">${shop}</td></tr>
        <tr><td><h1 style="font-size:24px;color:#0f172a;">Zaboravili ste nešto u korpi 🛒</h1></td></tr>
        <tr><td style="color:#475467;font-size:15px;">Proizvodi i dalje čekaju na vas. Nastavite kupovinu jednim klikom.</td></tr>
        <tr><td>${productTable}</td></tr>
        <tr><td style="padding-top:12px;font-size:14px;color:#475467;">Ukupno: <strong>${totalPrice}</strong></td></tr>
        <tr>
          <td style="padding-top:18px;">
            <a href="${checkoutUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;">Nastavite kupovinu</a>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildTextContent(checkout: Record<string, any>): string {
  const lines: string[] = [];
  lines.push('Zaboravili ste nešto u korpi 🛒');
  lines.push(`Prodavnica: ${checkout.shopDomain || checkout.shop_domain || 'Vaša prodavnica'}`);
  const items = extractLineItems(checkout);
  if (items.length) {
    lines.push('');
    lines.push('Proizvodi:');
    items.forEach((item) => {
      lines.push(`- ${item.title} x${item.quantity} · ${item.price}`);
    });
  } else if (checkout.line_items || checkout.items) {
    lines.push('');
    lines.push('Proizvodi:');
    lines.push(JSON.stringify(checkout.line_items || checkout.items, null, 2));
  }
  lines.push('');
  lines.push(`Ukupno: ${formatPrice(checkout.total_price || checkout.totalPrice || checkout.subtotal_price)}`);
  const url = checkout.checkout_url || checkout.checkoutUrl || '#';
  lines.push(`Završite kupovinu: ${url}`);
  return lines.join('\n');
}

function buildProductTable(checkout: Record<string, any>): string {
  const items = extractLineItems(checkout);
  if (!items.length) {
    const fallback = checkout?.line_items || checkout?.items || checkout?.products || {};
    const serialized = escapeHtml(JSON.stringify(fallback, null, 2));
    return `<pre style="background:#0f172a;color:#e2e8f0;padding:18px;border-radius:12px;white-space:pre-wrap;font-size:12px;">${serialized}</pre>`;
  }

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;font-weight:600;color:#0f172a;font-size:14px;">${escapeHtml(item.title)}</td>
        <td style="padding:8px 0;text-align:center;color:#475467;font-size:13px;">x${item.quantity}</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;font-size:14px;">${escapeHtml(item.price)}</td>
      </tr>
    `,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;">${rows}</table>`;
}

interface LineItem {
  title: string;
  quantity: number;
  price: string;
}

function extractLineItems(checkout: Record<string, any>): LineItem[] {
  const source = checkout?.line_items || checkout?.lineItems || checkout?.items || [];
  if (!Array.isArray(source)) return [];
  return source
    .map((raw: any) => {
      const title = typeof raw?.title === 'string' ? raw.title.trim() : typeof raw?.name === 'string' ? raw.name.trim() : null;
      const quantityValue = Number(raw?.quantity || raw?.qty || 1);
      const priceRaw = raw?.price || raw?.price_total || raw?.line_price || raw?.total || '';
      const price = typeof priceRaw === 'number' ? formatPrice(priceRaw, checkout?.currency) : String(priceRaw || '');
      return {
        title: title || 'Proizvod',
        quantity: Number.isFinite(quantityValue) ? quantityValue : 1,
        price: price || '—',
      };
    })
    .filter(Boolean);
}

function formatPrice(value: any, currency?: string): string {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  const unit = currency || 'RSD';
  try {
    return new Intl.NumberFormat('sr-RS', { style: 'currency', currency: unit, minimumFractionDigits: 2 }).format(num);
  } catch {
    return `${num} ${unit}`;
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



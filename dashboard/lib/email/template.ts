import { adminDatabase } from '../firebaseAdmin';

export interface UserTemplate {
  subject: string;
  html: string;
  previewText?: string;
}

export interface RenderTemplateArgs {
  template: UserTemplate;
  checkout?: Record<string, any> | null;
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  previewText: string;
}

const DEFAULT_TEMPLATE: UserTemplate = {
  subject: 'Zaboravili ste nešto u korpi 🛒',
  previewText: 'Još uvek čuvamo vaše proizvode – završite kupovinu za par sekundi.',
  html: `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f5; padding:32px;">
      <span style="display:none!important;color:transparent;height:0;width:0;opacity:0;overflow:hidden;">
        Još uvek čuvamo vaše proizvode – završite kupovinu za par sekundi.
      </span>
      <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.15);">
        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p style="text-transform:uppercase;font-size:12px;letter-spacing:0.12em;color:#818cf8;margin:0;">
              {{shop_domain}}
            </p>
            <h1 style="margin:12px 0 8px;font-size:26px;color:#0f172a;">Korpa vas čeka 🎁</h1>
            <p style="margin:0;color:#475467;font-size:15px;line-height:1.6;">
              Hej,<br/>
              Ostavljeni proizvodi još uvek čekaju na vas. Završite kupovinu pre nego što se rasprodaju.
            </p>
            <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;">{{customer_email}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px 32px;">
            {{product_table}}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;">
            <div style="font-size:14px;color:#475467;margin-bottom:18px;">
              Ukupno: <strong style="color:#0f172a;font-size:16px;">{{total_price}}</strong>
            </div>
            <a href="{{checkout_url}}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:600;">
              Nastavite kupovinu
            </a>
            <p style="margin-top:16px;font-size:12px;color:#94a3b8;">
              Napušteno: {{abandoned_at}}
            </p>
          </td>
        </tr>
      </table>
      <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:18px;">
        Ako ste već završili kupovinu, slobodno zanemarite ovu poruku.
      </p>
    </div>
  `,
};

export async function getUserTemplate(uid: string): Promise<UserTemplate> {
  if (!uid) {
    return DEFAULT_TEMPLATE;
  }
  try {
    const snap = await adminDatabase.ref(`users/${uid}/email_template`).once('value');
    if (!snap.exists()) {
      return DEFAULT_TEMPLATE;
    }
    const val = snap.val() || {};
    const subject = typeof val.subject === 'string' && val.subject.trim().length > 0 ? val.subject : DEFAULT_TEMPLATE.subject;
    const html = typeof val.html === 'string' && val.html.trim().length > 0 ? val.html : DEFAULT_TEMPLATE.html;
    const preview = typeof val.previewText === 'string' && val.previewText.trim().length > 0 ? val.previewText : DEFAULT_TEMPLATE.previewText;
    return {
      subject,
      html,
      previewText: preview,
    };
  } catch (err) {
    console.warn('[template] Failed to load user template, using default:', err);
    return DEFAULT_TEMPLATE;
  }
}

export function renderTemplate({ template, checkout }: RenderTemplateArgs): RenderedTemplate {
  const data = checkout || {};
  const customerEmail = sanitizeString(data.customerEmail || data.customer_email);
  const shopDomain = sanitizeString(data.shopDomain || data.shop_domain) || 'Vaša prodavnica';
  const totalPrice = formatPrice(data.total_price || data.totalPrice || data.subtotal_price || data.total);
  const abandonedAt = formatDate(data.abandoned_at || data.abandonedAt || Date.now());
  const checkoutUrl = getCheckoutUrl(data);
  const productTable = buildProductTable(data);

  const replacements: Record<string, string> = {
    '{{customer_email}}': customerEmail || '',
    '{{shop_domain}}': shopDomain,
    '{{total_price}}': totalPrice,
    '{{product_table}}': productTable,
    '{{abandoned_at}}': abandonedAt,
    '{{checkout_url}}': checkoutUrl,
  };

  const subject = apply(template.subject || DEFAULT_TEMPLATE.subject, replacements);
  const previewTextRaw = template.previewText || DEFAULT_TEMPLATE.previewText || '';
  const previewText = apply(previewTextRaw, replacements);
  const html = apply(template.html || DEFAULT_TEMPLATE.html, {
    ...replacements,
    '{{preview_text}}': previewText,
  });

  return {
    subject: subject || DEFAULT_TEMPLATE.subject,
    html: ensurePreview(html, previewText),
    previewText,
  };
}

function apply(str: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce((acc, [token, value]) => {
    return acc.split(token).join(value || '');
  }, str || '');
}

function formatDate(value: any): string {
  const date = Number.isFinite(value) ? new Date(Number(value)) : new Date();
  try {
    return date.toLocaleString('sr-RS', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return date.toISOString();
  }
}

function formatPrice(value: any, currency?: string): string {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  const fallbackCurrency = currency || 'RSD';
  try {
    return new Intl.NumberFormat('sr-RS', {
      style: 'currency',
      currency: fallbackCurrency,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num} ${fallbackCurrency}`;
  }
}

function ensurePreview(html: string, preview: string): string {
  if (!preview) return html;
  if (html.includes('<!--preview-text-->')) {
    return html.replace('<!--preview-text-->', buildPreview(preview));
  }
  return `${buildPreview(preview)}${html}`;
}

function buildPreview(preview: string): string {
  return `<span style="display:none!important;color:transparent;height:0;width:0;opacity:0;overflow:hidden;">${escapeHtml(
    preview,
  )}</span>`;
}

function sanitizeString(value: any): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function getCheckoutUrl(checkout: Record<string, any>): string {
  const url =
    checkout?.checkout_url ||
    checkout?.checkoutUrl ||
    checkout?.url ||
    checkout?.cart_url ||
    checkout?.cartUrl ||
    '';
  return typeof url === 'string' && url ? url : '#';
}

interface LineItem {
  title: string;
  quantity: number;
  price: string;
  image?: string;
}

function buildProductTable(checkout: Record<string, any>): string {
  const items = extractLineItems(checkout);
  if (!items.length) {
    const fallback = checkout?.line_items || checkout?.items || checkout?.products || {};
    const serialized = escapeHtml(JSON.stringify(fallback, null, 2));
    return `<pre style="background:#0f172a;color:#e2e8f0;padding:18px;border-radius:12px;white-space:pre-wrap;font-size:12px;">${serialized}</pre>`;
  }

  const rows = items
    .map((item) => {
      const imageCell = item.image
        ? `<td style="padding:12px;"><img src="${item.image}" alt="${escapeHtml(item.title)}" width="54" height="54" style="border-radius:12px;object-fit:cover;"></td>`
        : '<td style="padding:12px;width:54px;"></td>';
      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          ${imageCell}
          <td style="padding:12px 6px;">
            <div style="font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(item.title)}</div>
            <div style="font-size:12px;color:#94a3b8;">Količina: ${item.quantity}</div>
          </td>
          <td style="padding:12px 6px;text-align:right;font-size:14px;font-weight:600;color:#0f172a;">
            ${escapeHtml(item.price)}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-spacing:0;border-collapse:separate;">
      ${rows}
    </table>
  `;
}

function extractLineItems(checkout: Record<string, any>): LineItem[] {
  const source = checkout?.line_items || checkout?.lineItems || checkout?.items || [];
  if (!Array.isArray(source)) return [];
  return source
    .map((raw: any) => {
      const title = sanitizeString(raw?.title || raw?.name) || 'Proizvod';
      const quantity = Number(raw?.quantity || raw?.qty || 1);
      const priceValue = raw?.price || raw?.price_total || raw?.line_price || raw?.total || '';
      const price = typeof priceValue === 'number' ? formatPrice(priceValue, checkout?.currency) : String(priceValue || '');
      const image = raw?.image || raw?.image_url || raw?.imageUrl || raw?.featured_image;
      return {
        title,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        price: price || '—',
        image: typeof image === 'string' ? image : undefined,
      };
    })
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}



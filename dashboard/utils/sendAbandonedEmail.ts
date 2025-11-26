import { sendTransactionalEmail } from '../lib/brevo';

type Stage = 'first' | 'second' | 'third';

interface AbandonedEmailPayload {
  email: string;
  checkout_url?: string;
  line_items?: string;
  total?: string;
  currency?: string;
  shopDomain?: string;
  checkoutId?: string;
  stage: Stage;
}

const SUBJECTS: Record<Stage, string> = {
  first: 'Zaboravili ste artikle u korpi?',
  second: 'Podsjetnik: proizvodi vas čekaju',
  third: 'Posljednja šansa da vratite svoju narudžbu',
};

function buildHtml(payload: AbandonedEmailPayload) {
  const lineItems = payload.line_items ? `<p><strong>Proizvodi:</strong> ${payload.line_items}</p>` : '';
  const totalBlock =
    payload.total && payload.currency
      ? `<p><strong>Ukupno:</strong> ${payload.total} ${payload.currency}</p>`
      : '';
  const cta = payload.checkout_url
    ? `<p><a href="${payload.checkout_url}" style="padding:12px 18px;border-radius:6px;background:#ff40a1;color:#fff;text-decoration:none;">Nastavi kupovinu</a></p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111;">
      <p>Pozdrav,</p>
      <p>Izgleda da ste započeli narudžbu u trgovini ${payload.shopDomain || 'vašoj trgovini'}, ali je niste dovršili.</p>
      ${lineItems}
      ${totalBlock}
      ${cta}
      <p>Vaš MailSpark tim</p>
    </div>
  `;
}

export async function sendAbandonedEmail(to: string, payload: AbandonedEmailPayload) {
  if (!to) {
    throw new Error('Missing recipient email');
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@mailspark.app';
  const senderName = process.env.BREVO_SENDER_NAME || 'MailSpark';
  const templateId = process.env.BREVO_ABANDONED_TEMPLATE_ID
    ? Number(process.env.BREVO_ABANDONED_TEMPLATE_ID)
    : null;

  const params = {
    CHECKOUT_URL: payload.checkout_url,
    LINE_ITEMS: payload.line_items,
    TOTAL: payload.total,
    CURRENCY: payload.currency,
    SHOP_DOMAIN: payload.shopDomain,
    CHECKOUT_ID: payload.checkoutId,
    STAGE: payload.stage,
  };

  return sendTransactionalEmail({
    to,
    subject: SUBJECTS[payload.stage],
    htmlContent: buildHtml(payload),
    sender: { email: senderEmail, name: senderName },
    replyTo: { email: senderEmail, name: senderName },
    templateId: templateId || undefined,
    params,
  });
}

export type { Stage, AbandonedEmailPayload };


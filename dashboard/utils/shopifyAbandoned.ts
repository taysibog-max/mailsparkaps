const ABANDONED_THRESHOLD_MINUTES = 20;
const ABANDONED_THRESHOLD_MS = ABANDONED_THRESHOLD_MINUTES * 60 * 1000;

function getTimestamp(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  return 0;
}

export function isCheckoutAbandoned(checkout: any): boolean {
  if (!checkout) return false;
  if (checkout.completed_at || checkout.completedAt) return false;
  if (!checkout.email) return false;

  const updatedAt =
    getTimestamp(checkout.updated_at) ||
    getTimestamp(checkout.updatedAt) ||
    getTimestamp(checkout.abandoned_at) ||
    getTimestamp(checkout.created_at);

  if (!updatedAt) return false;

  return Date.now() - updatedAt >= ABANDONED_THRESHOLD_MS;
}

type EmailPayload = {
  email: string | null;
  checkout_url: string;
  line_items: string;
  total: string;
  currency: string;
  shopDomain: string;
  checkoutId: string;
};

export function getAbandonedCheckoutEmailPayload(checkout: any, shopDomain = ''): EmailPayload {
  const items = Array.isArray(checkout?.line_items) ? checkout.line_items : [];
  const summary = items
    .slice(0, 5)
    .map((item: any) => {
      const qty = item?.quantity ?? 1;
      const title = item?.title || item?.name || 'Item';
      return `${qty} x ${title}`;
    })
    .join(', ');

  const checkoutUrl =
    checkout?.abandoned_checkout_url ||
    checkout?.web_url ||
    checkout?.checkout_url ||
    checkout?.url ||
    '';

  return {
    email: checkout?.email || null,
    checkout_url: checkoutUrl,
    line_items: summary,
    total: String(checkout?.total_price ?? checkout?.total_line_items_price ?? '0.00'),
    currency: checkout?.currency || 'USD',
    shopDomain: checkout?.shopDomain || checkout?.shop_domain || shopDomain,
    checkoutId: String(checkout?.id || checkout?.checkout_id || checkout?.token || ''),
  };
}

export { ABANDONED_THRESHOLD_MINUTES };


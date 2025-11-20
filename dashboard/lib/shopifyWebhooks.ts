// Minimal helper to register Shopify webhooks.
// Note: Call this from your orchestration after OAuth if/when needed.

export const SHOPIFY_WEBHOOK_TOPICS = [
  'checkouts/create',
  'checkouts/update',
  'carts/update',
  'orders/create',
  'customers/create',
] as const;

export async function registerShopifyWebhooks(shopDomain: string, accessToken: string, targetBaseUrl: string): Promise<void> {
  const address = `${targetBaseUrl.replace(/\/$/, '')}/api/webhooks/shopify`;
  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    try {
      await fetch(`https://${shopDomain}/admin/api/2024-07/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
      });
    } catch {
      // ignore individual failures
    }
  }
}



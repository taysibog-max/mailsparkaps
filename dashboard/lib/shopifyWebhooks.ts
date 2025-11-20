// Minimal helper to register Shopify webhooks.
// Note: Call this from your orchestration after OAuth if/when needed.

export const SHOPIFY_WEBHOOK_TOPICS = [
  'checkouts/create',
  'checkouts/update',
  'orders/create',
] as const;

type Topic = (typeof SHOPIFY_WEBHOOK_TOPICS)[number];

function topicToPath(topic: Topic): string {
  return `/api/shopify/webhooks/${topic.replace('/', '_')}`;
}

export async function registerShopifyWebhooks(
  shopDomain: string,
  accessToken: string,
  targetBaseUrl: string
): Promise<void> {
  const base = targetBaseUrl.replace(/\/$/, '');

  // Fetch existing webhooks (for idempotency)
  let existing: Array<{ id: number; topic: string; address: string }> = [];
  try {
    const r = await fetch(`https://${shopDomain}/admin/api/2024-07/webhooks.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    });
    const d = await r.json().catch(() => ({}));
    existing = Array.isArray(d?.webhooks) ? d.webhooks : [];
  } catch {
    existing = [];
  }

  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    const desiredAddress = `${base}${topicToPath(topic)}`;
    const found = existing.find(w => String(w.topic) === topic);

    // If exists and address matches, skip
    if (found && String(found.address || '') === desiredAddress) continue;

    try {
      if (!found) {
        // Create
        await fetch(`https://${shopDomain}/admin/api/2024-07/webhooks.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
          body: JSON.stringify({ webhook: { topic, address: desiredAddress, format: 'json' } }),
        });
      } else {
        // Update address to our handler
        await fetch(`https://${shopDomain}/admin/api/2024-07/webhooks/${found.id}.json`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
          body: JSON.stringify({ webhook: { id: found.id, topic, address: desiredAddress, format: 'json' } }),
        });
      }
    } catch {
      // Ignore per-topic failures to avoid breaking flow
    }
  }
}



import { sanitizeShopDomain } from '../pixelTypes';

export async function verifyManualToken(domain: string, token: string): Promise<boolean> {
  const shopDomain = (domain || '').trim().toLowerCase();
  const normalized = sanitizeShopDomain(shopDomain);
  if (!normalized || !normalized.endsWith('.myshopify.com')) {
    return false;
  }

  try {
    const response = await fetch(`https://${normalized}/admin/api/2024-01/shop.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
    });
    return response.status === 200;
  } catch {
    return false;
  }
}



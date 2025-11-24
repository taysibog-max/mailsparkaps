import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    error:
      'This endpoint has been replaced. Please use the Connect Store button in the dashboard to start Shopify authentication.',
  });
}


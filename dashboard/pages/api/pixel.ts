import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(501).json({ error: 'MailSpark Pixel API not yet implemented' });
}


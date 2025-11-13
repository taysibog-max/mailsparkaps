import { adminAuth } from '../../../lib/firebaseAdmin';
import { getCampaigns, getAccount } from '../../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await adminAuth.verifyIdToken(token);

    // Get campaigns and account info from Brevo
    const [campaignsData, accountData] = await Promise.all([
      getCampaigns({ limit: 50 }).catch(() => ({ campaigns: [], count: 0 })),
      getAccount().catch(() => null),
    ]);

    res.status(200).json({
      success: true,
      campaigns: campaignsData.campaigns || [],
      totalCampaigns: campaignsData.count || 0,
      account: accountData,
    });
  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({
      error: 'Failed to get overview',
      details: error.message,
    });
  }
}

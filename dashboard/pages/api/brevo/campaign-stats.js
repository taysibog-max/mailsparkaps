import { adminAuth } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    await adminAuth.verifyIdToken(token);

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Campaign ID is required' });
    }

    // Fetch campaign statistics from Brevo
    const response = await fetch(
      `https://api.brevo.com/v3/emailCampaigns/${id}/statistics`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: errorData.message || 'Failed to fetch campaign statistics' 
      });
    }

    const data = await response.json();

    // Extract key statistics
    const stats = {
      sent: data.globalStats?.uniqueSent || 0,
      opens: data.globalStats?.uniqueOpens || 0,
      clicks: data.globalStats?.uniqueClicks || 0,
      unsubscribed: data.globalStats?.unsubscriptions || 0,
      bounced: data.globalStats?.hardBounces + data.globalStats?.softBounces || 0,
      openRate: data.globalStats?.openRate || 0,
      clickRate: data.globalStats?.clickRate || 0,
    };

    res.status(200).json({ stats, fullData: data });
  } catch (error) {
    console.error('Campaign stats error:', error);
    res.status(500).json({ error: error.message });
  }
}


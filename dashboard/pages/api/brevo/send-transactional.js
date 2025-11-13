import { adminAuth } from '../../../lib/firebaseAdmin';
import brevo from '../../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify user authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { to, subject, htmlContent, sender, templateId, params } = req.body;

    if (!to || !subject || (!htmlContent && !templateId)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Send transactional email via Brevo
    const result = await brevo.sendTransactionalEmail({
      to: Array.isArray(to) ? to : [{ email: to }],
      subject,
      htmlContent,
      sender: sender || { name: 'Support', email: 'noreply@example.com' },
      templateId,
      params: params || {},
    });

    return res.status(200).json({ 
      success: true, 
      messageId: result.messageId 
    });
  } catch (error) {
    console.error('Send transactional email error:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
}



import { adminAuth } from '../../lib/firebaseAdmin';
import { sendTransactionalEmail } from '../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const {
      to,
      subject,
      htmlContent,
      html, // Backward compatibility
      senderName = 'AutoMailer',
      senderEmail = 'noreply@automailer.com',
      replyTo,
      templateId,
      params = {},
    } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email (to) is required' });
    }

    const content = htmlContent || html;

    if (!templateId && (!subject || !content)) {
      return res.status(400).json({
        error: 'Either templateId or both subject and htmlContent are required',
      });
    }

    // Send email via Brevo
    const result = await sendTransactionalEmail({
      to,
      subject,
      htmlContent: content,
      sender: { name: senderName, email: senderEmail },
      replyTo: replyTo || senderEmail,
      templateId,
      params,
    });

    console.log(`✅ Email sent to ${to} by user ${uid}`);

    res.status(200).json({
      success: true,
      ok: true, // Backward compatibility
      message: 'Email sent successfully',
      messageId: result.messageId,
      to,
      subject,
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
    });
  }
}

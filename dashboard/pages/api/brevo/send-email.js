/**
 * Brevo Email Sending Endpoint
 * POST /api/brevo/send-email
 * 
 * Body: { to, subject, htmlContent, senderName?, senderEmail? }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, htmlContent, senderName, senderEmail } = req.body;

    // Validation
    if (!to || !subject || !htmlContent) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, htmlContent' 
      });
    }

    if (!process.env.BREVO_API_KEY) {
      console.error('[Brevo] BREVO_API_KEY not configured');
      return res.status(500).json({ error: 'Brevo API key not configured' });
    }

    console.log('[Brevo] Sending email to:', to);

    // Send email via Brevo API
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: senderName || 'Your Store',
          email: senderEmail || process.env.SENDER_EMAIL || 'noreply@yourdomain.com',
        },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Brevo] Error:', data);
      return res.status(response.status).json({
        error: 'Failed to send email via Brevo',
        details: data,
      });
    }

    console.log('[Brevo] ✅ Email sent successfully. Message ID:', data.messageId);

    return res.status(200).json({
      success: true,
      messageId: data.messageId,
      message: 'Email sent successfully',
    });

  } catch (error) {
    console.error('[Brevo] Send email error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}








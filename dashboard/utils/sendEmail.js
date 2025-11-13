import { sendEmail as brevoSend } from '../lib/brevo';

export async function sendEmail({ to, subject, html }){
  if (!to) throw new Error('Missing recipient');
  const safeSubject = subject || 'Notification';
  const safeHtml = html || '<p>Hello from Automailer</p>';
  return await brevoSend({ to, subject: safeSubject, html: safeHtml });
}




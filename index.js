'use strict';

const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Initialize Firebase and start cart monitoring scheduler
const { initializeFirebase } = require('./utils/firebase');
const { startCartScheduler } = require('./utils/cartScheduler');

initializeFirebase();
startCartScheduler();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Expose runtime config to the static site (e.g., Next dashboard origin)
app.get('/runtime-config.js', (_req, res) => {
  const cfg = {
    DASHBOARD_ORIGIN: process.env.NEXT_DASHBOARD_ORIGIN || process.env.DASHBOARD_ORIGIN || 'http://localhost:3000',
  };
  res.setHeader('Content-Type', 'application/javascript');
  res.send('window.RUNTIME=' + JSON.stringify(cfg) + ';');
});

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  fromEmail: process.env.FROM_EMAIL,
};

let transporter = null;

function initializeTransporter() {
  if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
    console.warn('[automailer] SMTP environment variables are not fully set. Email sending disabled until configured.');
    transporter = null;
    return;
  }
  transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });
  transporter.verify().then(() => {
    console.log('[automailer] SMTP transporter is ready.');
  }).catch((err) => {
    console.error('[automailer] SMTP verification failed:', err.message);
  });
}

initializeTransporter();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'automailer' });
});

// Webhook routes for abandoned cart tracking
const webhookRoutes = require('./routes/webhooks');
app.use('/api/webhooks', webhookRoutes);

// Manual cart check endpoint (for testing)
const { manualCheck } = require('./utils/cartScheduler');
app.post('/api/test/check-carts', async (req, res) => {
  try {
    await manualCheck();
    res.json({ success: true, message: 'Manual abandoned cart check completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Map clean routes to static pages
app.get(['/pricing', '/features', '/faq', '/signin', '/signup', '/settings'], (req, res) => {
  const page = req.path.replace('/', '') || 'index';
  res.sendFile(path.join(__dirname, 'public', `${page}.html`));
});

// For any /dashboard path, prefer redirecting to Next.js dashboard origin if configured
app.get(/^\/dashboard(\/.*)?$/, (req, res) => {
  const origin = process.env.NEXT_DASHBOARD_ORIGIN || process.env.DASHBOARD_ORIGIN || 'http://localhost:3000';
  if (origin) {
    const dest = origin.replace(/\/$/, '') + req.path;
    return res.redirect(302, dest);
  }
  // Fallback to static dashboard if no origin
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/api/send', async (req, res) => {
  if (!transporter) {
    return res.status(500).json({ ok: false, error: 'Email sending is not configured on the server.' });
  }

  const { to, subject, text, html } = req.body || {};

  if (!to || typeof to !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing or invalid "to" field.' });
  }
  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing or invalid "subject" field.' });
  }
  if ((!text || typeof text !== 'string') && (!html || typeof html !== 'string')) {
    return res.status(400).json({ ok: false, error: 'Provide either "text" or "html" content.' });
  }

  const from = smtpConfig.fromEmail || smtpConfig.user;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
    return res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error('[automailer] sendMail error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send email.' });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, () => {
  console.log(`[automailer] Server listening on http://localhost:${PORT}`);
});



import { adminAuth } from '../../../lib/firebaseAdmin';

/**
 * POST /api/ai/generate
 * Body: {
 *   subjectBrief?: string,
 *   bodyBrief?: string,
 *   brandVoice?: string,
 *   product?: { name?: string, description?: string, price?: string },
 *   audience?: string,
 *   language?: string, // e.g. 'bs' | 'en'
 *   style?: string, // e.g. 'conversational', 'professional', 'fun'
 * }
 * Returns: { subject: string, html: string, text: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authz = req.headers['authorization'] || '';
    const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    let uid = null;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded?.uid || null;
    } catch (_) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const openaiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    const {
      subjectBrief = '',
      bodyBrief = '',
      brandVoice = '',
      product = {},
      audience = '',
      language = 'bs',
      style = 'conversational'
    } = req.body || {};

    const sys = [
      'You are an expert email copywriter focused on ecommerce campaigns.',
      'Return concise JSON only with keys: subject, html, text. Do not include any other text.',
      `Write in language code: ${language}. Use ${style} tone.`,
      'The HTML should be clean, inline-styled minimal, and mobile-friendly.',
    ].join(' ');

    const user = {
      role: 'user',
      content: [
        `Brand voice: ${brandVoice || 'neutral brand voice.'}`,
        `Audience: ${audience || 'general audience.'}`,
        `Subject brief: ${subjectBrief || 'n/a'}`,
        `Body brief: ${bodyBrief || 'n/a'}`,
        `Product: ${JSON.stringify(product || {})}`,
        'Constraints: subject <= 60 chars; plain text should be under 120 words.',
      ].join('\n')
    };

    const payload = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        user,
      ],
      temperature: 0.8,
      max_tokens: 800,
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errTxt = await resp.text().catch(()=> '');
      return res.status(500).json({ error: `OpenAI error: ${errTxt || resp.statusText}` });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';

    let parsed = null;
    try { parsed = JSON.parse(content); } catch (_) {}
    if (!parsed || typeof parsed !== 'object') {
      // Fallback: wrap raw content as text
      return res.status(200).json({ ok: true, uid, subject: 'Generated Subject', html: `<p>${escapeHtml(content)}</p>`, text: String(content).replace(/<[^>]+>/g, '') });
    }

    const subject = String(parsed.subject || '').trim() || 'Generated Subject';
    const html = String(parsed.html || '').trim() || `<p>${escapeHtml(parsed.text || '')}</p>`;
    const text = String(parsed.text || '').trim() || htmlToText(html);

    return res.status(200).json({ ok: true, uid, subject, html, text });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}

function htmlToText(html) {
  try { return String(html || '').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(); } catch (_) { return ''; }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}



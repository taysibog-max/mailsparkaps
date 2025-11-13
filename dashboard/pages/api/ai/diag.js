export default async function handler(req, res) {
  try {
    const key = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
    const masked = key ? key.slice(0, 7) + '...' + key.slice(-4) : null;
    return res.status(200).json({
      ok: true,
      hasKey: Boolean(key),
      keyPreview: masked,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      nodeEnv: process.env.NODE_ENV || 'development',
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}





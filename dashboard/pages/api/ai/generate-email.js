import { generateEmailContent } from '../../../lib/openai';
import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Extract request data
    const { campaignType, customerData, saveToCampaign } = req.body;

    if (!campaignType) {
      return res.status(400).json({ error: 'Campaign type is required' });
    }

    console.log(`[AI] Generating email for campaign: ${campaignType}`);

    // Generate email content using OpenAI
    const emailContent = await generateEmailContent(campaignType, customerData || {});

    // Optionally save to Firebase campaign
    if (saveToCampaign) {
      try {
        const db = adminDb();
        const campaignRef = db.ref(`users/${uid}/campaigns/${campaignType}`);
        
        await campaignRef.update({
          subject: emailContent.subject,
          body: emailContent.body,
          generatedAt: emailContent.generatedAt,
          model: emailContent.model,
          status: 'draft',
          updatedAt: Date.now(),
        });

        console.log(`[AI] Email content saved to Firebase for user ${uid}, campaign ${campaignType}`);
      } catch (saveError) {
        console.error('[AI] Error saving to Firebase:', saveError);
        // Continue even if save fails
      }
    }

    res.status(200).json({
      success: true,
      ...emailContent,
    });

  } catch (error) {
    console.error('[AI] Error in generate-email endpoint:', error);
    
    // Handle specific OpenAI errors
    if (error.message.includes('OPENAI_API_KEY')) {
      return res.status(500).json({ 
        error: 'OpenAI API key nije konfigurisan',
        details: 'Dodajte OPENAI_API_KEY u .env file'
      });
    }

    if (error.message.includes('quota')) {
      return res.status(429).json({ 
        error: 'OpenAI API limit dostignut',
        details: 'Pokušajte ponovo kasnije'
      });
    }

    res.status(500).json({
      error: 'AI generisanje nije uspjelo',
      details: error.message,
    });
  }
}









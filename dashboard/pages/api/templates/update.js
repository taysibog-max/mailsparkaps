import { adminAuth } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
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

    const { id, name, subject, htmlContent } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    console.log('[Template Update] Updating template:', id, 'for user:', uid);

    // Initialize Firebase Realtime Database
    const { adminDatabase } = await import('../../../lib/firebaseAdmin');
    const templateRef = adminDatabase.ref(`users/${uid}/email_templates/${id}`);

    // Check if template exists
    const snapshot = await templateRef.once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Prepare update object
    const updates = {
      updatedAt: Date.now(),
    };

    if (name !== undefined) updates.name = name;
    if (subject !== undefined) updates.subject = subject;
    if (htmlContent !== undefined) {
      updates.htmlContent = htmlContent;
      updates.body = htmlContent; // For backward compatibility
    }

    // Update template
    await templateRef.update(updates);

    console.log('[Template Update] ✅ Template updated successfully');

    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
    });

  } catch (error) {
    console.error('[Template Update] ❌ Error:', error);
    res.status(500).json({
      error: 'Failed to update template',
      details: error.message,
    });
  }
}


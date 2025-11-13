import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';
import { deleteCampaign as brevoDeleteCampaign } from '../../../lib/brevo';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const { campaignId } = req.query;

    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID is required' });
    }

    console.log('[Campaign Delete] Deleting campaign:', campaignId, 'for user:', uid);

    const campaignRef = adminDatabase.ref(`users/${uid}/campaigns/${campaignId}`);
    const draftRef = adminDatabase.ref(`users/${uid}/campaigns_drafts/${campaignId}`);
    const [snapshot, draftSnapshot] = await Promise.all([
      campaignRef.once('value'),
      draftRef.once('value')
    ]);

    // Determine Brevo ID (fallback na parametar)
    const campaignData = snapshot.exists() ? (snapshot.val() || {}) : (draftSnapshot.exists() ? (draftSnapshot.val() || {}) : {});
    const brevoId = campaignData.brevoId || campaignData.id || campaignId;

    // Pokušaj obrisati na Brevo (ako je moguće)
    let brevoDeleted = false;
    try {
      if (brevoId) {
        await brevoDeleteCampaign(brevoId);
        brevoDeleted = true;
        console.log('[Campaign Delete] 🗑️ Deleted from Brevo:', brevoId);
      }
    } catch (brevoErr) {
      console.warn('[Campaign Delete] Brevo delete warning:', brevoErr.message);
      // Ako Brevo padne, nastavi sa lokalnim brisanjem (best-effort)
    }

    // Obriši lokalni zapis ako postoji
    if (snapshot.exists()) {
      await campaignRef.remove();
      console.log('[Campaign Delete] 🗑️ Deleted from Firebase RTDB (campaigns)');
    }
    if (draftSnapshot.exists()) {
      await draftRef.remove();
      console.log('[Campaign Delete] 🗑️ Deleted from Firebase RTDB (campaigns_drafts)');
    }

    // Purge abandoned carts for this user when campaign is deleted
    try {
      await adminDatabase.ref(`events/${uid}/cart_abandoned`).remove();
      console.log('[Campaign Delete] Cleared events cart_abandoned for user', uid);
    } catch (_) {}
    try {
      await adminDatabase.ref(`users/${uid}/abandoned_carts`).remove();
      console.log('[Campaign Delete] Cleared users/${uid}/abandoned_carts for user', uid);
    } catch (_) {}

    // Čak i ako nije nađeno ni na jednoj strani, tretiraj kao uspjeh (idempotentno brisanje)
    console.log('[Campaign Delete] ✅ Delete completed', {
      brevoDeleted,
      removedLocal: snapshot.exists() || draftSnapshot.exists(),
    });

    res.status(200).json({
      success: true,
      message: 'Campaign delete completed',
      brevoDeleted,
      removedFrom: {
        campaigns: snapshot.exists(),
        campaigns_drafts: draftSnapshot.exists(),
      },
    });

  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({
      error: 'Failed to delete campaign',
      details: error.message,
    });
  }
}


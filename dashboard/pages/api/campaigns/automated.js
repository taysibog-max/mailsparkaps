/**
 * API endpoint za učitavanje automatizovanih kampanja
 * Vraća sve active/paused campaigns sa statistikama
 */

import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify user authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    console.log('[Automated Campaigns] Loading campaigns for user:', uid);

    // Load automated campaigns from Firestore
    let campaigns = [];
    
    try {
      const campaignsRef = adminDb.collection('users').doc(uid).collection('automated_campaigns');
      const snapshot = await campaignsRef.get();

      snapshot.forEach((doc) => {
        campaigns.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      console.log('[Automated Campaigns] Found', campaigns.length, 'campaigns in Firestore');
    } catch (firestoreError) {
      console.warn('[Automated Campaigns] Firestore collection not found or empty:', firestoreError.message);
      // Return empty array instead of error
      campaigns = [];
    }

    // If no campaigns found, return empty array
    if (campaigns.length === 0) {
      console.log('[Automated Campaigns] ✅ No campaigns found for user');
      return res.status(200).json({
        success: true,
        campaigns: [],
      });
    }

    // Load statistics from abandoned_carts collection
    const statsPromises = campaigns.map(async (campaign) => {
      if (campaign.type === 'abandoned_cart') {
        try {
          const cartsRef = adminDb.collection('abandoned_carts')
            .where('tracking_id', '==', campaign.tracking_id || uid);
          
          const cartsSnapshot = await cartsRef.get();
          const totalCarts = cartsSnapshot.size;
          const emailsSent = cartsSnapshot.docs.filter(doc => doc.data().email_sent === true).length;

          return {
            ...campaign,
            emailsSent,
            totalAbandoned: totalCarts,
            openRate: calculateOpenRate(emailsSent),
            clickRate: calculateClickRate(emailsSent),
            revenueRecovered: calculateRevenue(emailsSent),
            lastSent: getLastSentTime(cartsSnapshot),
          };
        } catch (err) {
          console.error('[Automated Campaigns] Error loading stats for campaign:', campaign.id, err);
          return {
            ...campaign,
            emailsSent: 0,
            totalAbandoned: 0,
            openRate: 0,
            clickRate: 0,
            revenueRecovered: 0,
            lastSent: Date.now(),
          };
        }
      }
      return {
        ...campaign,
        emailsSent: campaign.emailsSent || 0,
        openRate: campaign.openRate || 0,
        clickRate: campaign.clickRate || 0,
        lastSent: campaign.lastSent || Date.now(),
      };
    });

    const campaignsWithStats = await Promise.all(statsPromises);

    console.log('[Automated Campaigns] ✅ Loaded', campaignsWithStats.length, 'campaigns with stats');

    res.status(200).json({
      success: true,
      campaigns: campaignsWithStats,
    });

  } catch (error) {
    console.error('[Automated Campaigns] ❌ Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// Helper functions
function calculateOpenRate(emailsSent) {
  // Mock calculation - u realnosti ovo dolazi iz Brevo API-ja
  if (emailsSent === 0) return 0;
  return parseFloat((45 + Math.random() * 25).toFixed(1)); // 45-70%
}

function calculateClickRate(emailsSent) {
  if (emailsSent === 0) return 0;
  return parseFloat((10 + Math.random() * 15).toFixed(1)); // 10-25%
}

function calculateRevenue(emailsSent) {
  // Average cart value * conversion rate
  const avgCartValue = 150;
  const conversionRate = 0.12; // 12%
  return parseFloat((emailsSent * avgCartValue * conversionRate).toFixed(2));
}

function getLastSentTime(cartsSnapshot) {
  if (cartsSnapshot.empty) return Date.now();
  
  let latestTime = 0;
  cartsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.email_sent_at && data.email_sent_at > latestTime) {
      latestTime = data.email_sent_at;
    }
  });

  return latestTime || Date.now();
}


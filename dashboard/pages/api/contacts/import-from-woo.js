import axios from 'axios';
import { adminAuth } from '../../../lib/firebaseAdmin';
import { getAdminDb } from '../../../lib/firebaseAdminDb';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    
    // Check if WooCommerce store is connected
    const db = getAdminDb();
    const storeSnapshot = await db.ref(`users/${uid}/integrations/woocommerce`).once('value');
    
    if (!storeSnapshot.exists()) {
      return res.status(400).json({ 
        error: 'WooCommerce store nije konektovan', 
        message: 'Morate prvo konektovati WooCommerce store u Integrations tabu.' 
      });
    }
    
    const store = storeSnapshot.val();
    const { shopUrl, consumerKey, consumerSecret } = store;
    
    if (!shopUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({ error: 'Nedostaju WooCommerce kredencijali' });
    }
    
    // Fetch customers from WooCommerce
    const baseUrl = shopUrl.replace(/\/$/, '');
    let allEmails = [];
    
    try {
      const response = await axios.get(`${baseUrl}/wp-json/wc/v3/customers`, {
        auth: { username: consumerKey, password: consumerSecret },
        params: { per_page: 100 },
        timeout: 15000
      });
      
      const customers = Array.isArray(response.data) ? response.data : [];
      allEmails = customers
        .map(c => c.email)
        .filter(email => email && /@/.test(email))
        .map(email => email.toLowerCase());
      
    } catch (error) {
      return res.status(502).json({ 
        error: 'Greška pri povezivanju sa WooCommerce', 
        message: error.message 
      });
    }
    
    // Also try to get emails from orders
    try {
      const ordersResponse = await axios.get(`${baseUrl}/wp-json/wc/v3/orders`, {
        auth: { username: consumerKey, password: consumerSecret },
        params: { per_page: 100, status: 'any' },
        timeout: 15000
      });
      
      const orders = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
      const orderEmails = orders
        .map(o => o?.billing?.email)
        .filter(email => email && /@/.test(email))
        .map(email => email.toLowerCase());
      
      allEmails = [...new Set([...allEmails, ...orderEmails])];
      
    } catch (error) {
      console.log('Could not fetch orders, continuing with customers only');
    }
    
    if (allEmails.length === 0) {
      return res.status(200).json({ 
        success: false, 
        message: 'Nema emailova za import',
        count: 0 
      });
    }
    
    // Save contacts to database – idempotent (merge by key)
    const contactsRef = db.ref(`users/${uid}/contacts`);
    const existingSnap = await contactsRef.once('value');
    const existing = existingSnap.val() || {};
    const updates = { ...existing };
    const now = Date.now();
    allEmails.forEach(email => {
      const contactId = email.replace(/[@.]/g, '_');
      updates[contactId] = {
        email: email,
        source: 'woocommerce',
        importedAt: existing[contactId]?.importedAt || now,
        status: existing[contactId]?.status || 'subscribed'
      };
    });
    await contactsRef.set(updates);
    
    // Update integration stats
    await db.ref(`users/${uid}/integrations/woocommerce/contactsCount`).set(allEmails.length);
    await db.ref(`users/${uid}/integrations/woocommerce/lastSynced`).set(Date.now());
    
    return res.status(200).json({ 
      success: true, 
      message: `Uspješno importovano ${allEmails.length} kontakata`,
      count: allEmails.length,
      emails: allEmails 
    });
    
  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ error: error.message });
  }
}


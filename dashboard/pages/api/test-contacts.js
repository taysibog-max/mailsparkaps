import { adminDb as firestore } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For testing purposes, get all contacts from all users
    const usersRef = firestore.collection('users');
    const usersSnapshot = await usersRef.get();
    
    const allContacts = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const contactsRef = userDoc.ref.collection('contacts');
      const contactsSnapshot = await contactsRef.get();
      
      contactsSnapshot.forEach(contactDoc => {
        allContacts.push({
          userId,
          ...contactDoc.data(),
          id: contactDoc.id
        });
      });
    }
    
    // Sort by email
    allContacts.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    
    res.status(200).json({ 
      total: allContacts.length,
      contacts: allContacts 
    });

  } catch (error) {
    console.error('Test contacts error:', error);
    
    // Fallback: return mock data if Firebase is not configured
    if (error.message.includes('NOT_FOUND') || error.message.includes('Firebase')) {
      const mockContacts = [
        { userId: 'dev-user', email: 'ajdh@gmail.com', source: 'woocommerce', createdAt: new Date().toISOString() },
        { userId: 'dev-user', email: 'alminru@gmail.com', source: 'woocommerce', createdAt: new Date().toISOString() }
      ];
      
      res.status(200).json({ 
        total: mockContacts.length,
        contacts: mockContacts,
        note: 'Using mock data - Firebase not configured'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch contacts',
        details: error.message 
      });
    }
  }
}

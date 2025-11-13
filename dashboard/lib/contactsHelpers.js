/**
 * Contacts Helper Functions
 * For automatic contact extraction and management
 */

/**
 * Extract contact data from event
 * @param {object} eventData - Event data from webhook
 * @returns {object} Contact data
 */
export function extractContactFromEvent(eventData) {
  const email = eventData.customerEmail || eventData.email;
  
  if (!email) {
    return null;
  }

  // Parse name
  const fullName = eventData.customerName || '';
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    email: email.toLowerCase().trim(),
    firstName,
    lastName,
    fullName: fullName.trim() || email,
    phone: eventData.phone || eventData.customerPhone || null,
    address: eventData.shippingAddress || eventData.billingAddress || null,
    source: eventData.platform || 'unknown',
    tags: [],
  };
}

/**
 * Save or update contact in Firebase
 * @param {object} adminDatabase - Firebase Admin Database instance
 * @param {string} userId - User ID
 * @param {object} contactData - Contact data
 * @param {string} eventType - Event type (cart_abandoned, order_created, etc.)
 */
export async function saveOrUpdateContact(adminDatabase, userId, contactData, eventType) {
  if (!contactData || !contactData.email) {
    console.log('[Contacts] No valid contact data to save');
    return null;
  }

  try {
    // Use email as contact ID (sanitized)
    const contactId = contactData.email.replace(/[.#$[\]]/g, '_');
    const contactRef = adminDatabase.ref(`users/${userId}/contacts/${contactId}`);
    
    // Check if contact exists
    const snapshot = await contactRef.once('value');
    const existingContact = snapshot.val();

    const now = Date.now();

    if (existingContact) {
      // Update existing contact
      const updates = {
        lastSeen: now,
        updatedAt: now,
      };

      // Update name if provided
      if (contactData.firstName) updates.firstName = contactData.firstName;
      if (contactData.lastName) updates.lastName = contactData.lastName;
      if (contactData.fullName) updates.fullName = contactData.fullName;

      // Update phone if provided
      if (contactData.phone && !existingContact.phone) {
        updates.phone = contactData.phone;
      }

      // Update address if provided
      if (contactData.address && !existingContact.address) {
        updates.address = contactData.address;
      }

      // Update tags
      const existingTags = existingContact.tags || [];
      const eventTag = mapEventTypeToTag(eventType);
      if (eventTag && !existingTags.includes(eventTag)) {
        updates.tags = [...existingTags, eventTag];
      }

      // Update event counters
      if (eventType === 'cart_abandoned') {
        updates.cartAbandoned = (existingContact.cartAbandoned || 0) + 1;
      } else if (eventType === 'order_created') {
        updates.totalOrders = (existingContact.totalOrders || 0) + 1;
      }

      await contactRef.update(updates);
      console.log('[Contacts] ✅ Updated contact:', contactData.email);

      return { ...existingContact, ...updates };
    } else {
      // Create new contact
      const newContact = {
        email: contactData.email,
        firstName: contactData.firstName || '',
        lastName: contactData.lastName || '',
        fullName: contactData.fullName || contactData.email,
        phone: contactData.phone || null,
        address: contactData.address || null,
        source: contactData.source || 'unknown',
        tags: [mapEventTypeToTag(eventType)].filter(Boolean),
        firstSeen: now,
        lastSeen: now,
        createdAt: now,
        updatedAt: now,
        cartAbandoned: eventType === 'cart_abandoned' ? 1 : 0,
        totalOrders: eventType === 'order_created' ? 1 : 0,
        lifetimeValue: 0,
        emailsSent: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        status: 'active',
      };

      await contactRef.set(newContact);
      console.log('[Contacts] ✅ Created new contact:', contactData.email);

      return newContact;
    }
  } catch (error) {
    console.error('[Contacts] Error saving contact:', error);
    return null;
  }
}

/**
 * Map event type to contact tag
 * @param {string} eventType - Event type
 * @returns {string|null} Tag
 */
function mapEventTypeToTag(eventType) {
  const tagMap = {
    'cart_abandoned': 'abandoned_cart',
    'order_created': 'customer',
    'customer_created': 'lead',
  };
  return tagMap[eventType] || null;
}

/**
 * Update contact email statistics
 * @param {object} adminDatabase - Firebase Admin Database instance
 * @param {string} userId - User ID
 * @param {string} email - Contact email
 * @param {string} action - Action (sent, opened, clicked)
 */
export async function updateContactEmailStats(adminDatabase, userId, email, action) {
  if (!email) return;

  try {
    const contactId = email.replace(/[.#$[\]]/g, '_');
    const contactRef = adminDatabase.ref(`users/${userId}/contacts/${contactId}`);
    
    const snapshot = await contactRef.once('value');
    if (!snapshot.exists()) {
      console.log('[Contacts] Contact not found for stats update:', email);
      return;
    }

    const contact = snapshot.val();
    const updates = {
      updatedAt: Date.now(),
    };

    if (action === 'sent') {
      updates.emailsSent = (contact.emailsSent || 0) + 1;
      updates.lastEmailSent = Date.now();
    } else if (action === 'opened') {
      updates.emailsOpened = (contact.emailsOpened || 0) + 1;
      updates.lastEmailOpened = Date.now();
    } else if (action === 'clicked') {
      updates.emailsClicked = (contact.emailsClicked || 0) + 1;
      updates.lastEmailClicked = Date.now();
    }

    await contactRef.update(updates);
    console.log(`[Contacts] ✅ Updated ${action} stats for:`, email);
  } catch (error) {
    console.error('[Contacts] Error updating email stats:', error);
  }
}

/**
 * Get all contacts for a user
 * @param {object} adminDatabase - Firebase Admin Database instance
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of contacts
 */
export async function getAllContacts(adminDatabase, userId) {
  try {
    const contactsRef = adminDatabase.ref(`users/${userId}/contacts`);
    const snapshot = await contactsRef.once('value');
    
    if (!snapshot.exists()) {
      return [];
    }

    const contactsData = snapshot.val();
    const contacts = Object.keys(contactsData).map(key => ({
      id: key,
      ...contactsData[key],
    }));

    // Sort by lastSeen (most recent first)
    contacts.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    return contacts;
  } catch (error) {
    console.error('[Contacts] Error fetching contacts:', error);
    return [];
  }
}

/**
 * Get contact statistics
 * @param {Array} contacts - Array of contacts
 * @returns {object} Statistics
 */
export function getContactStats(contacts) {
  const totalContacts = contacts.length;
  const activeContacts = contacts.filter(c => c.status === 'active').length;
  const totalOrders = contacts.reduce((sum, c) => sum + (c.totalOrders || 0), 0);
  const totalAbandonedCarts = contacts.reduce((sum, c) => sum + (c.cartAbandoned || 0), 0);
  const totalEmailsSent = contacts.reduce((sum, c) => sum + (c.emailsSent || 0), 0);
  const totalEmailsOpened = contacts.reduce((sum, c) => sum + (c.emailsOpened || 0), 0);

  const openRate = totalEmailsSent > 0 ? (totalEmailsOpened / totalEmailsSent) * 100 : 0;

  return {
    totalContacts,
    activeContacts,
    totalOrders,
    totalAbandonedCarts,
    totalEmailsSent,
    totalEmailsOpened,
    openRate: openRate.toFixed(1),
  };
}








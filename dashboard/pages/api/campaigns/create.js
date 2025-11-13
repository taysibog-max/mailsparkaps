import { getFirebaseApp } from '../../../lib/firebaseClient';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { campaignName, subject, emailBody, audience = 'all', scheduleTime = null, userId } = req.body || {};
    if (!campaignName || !subject || !emailBody || !userId) return res.status(400).json({ error: 'Missing fields' });

    // Save campaign to Firestore
    const { db } = getFirebaseApp();
    const docRef = await addDoc(collection(db, 'campaigns'), {
      userId,
      campaignName,
      subject,
      emailBody,
      audience,
      scheduleTime: scheduleTime ? new Date(scheduleTime) : null,
      status: 'scheduled',
      createdAt: serverTimestamp(),
    });

    // Trigger Brevo send via our backend key: expects BREVO_API_KEY env
    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) console.warn('BREVO_API_KEY missing, skipping send');
    else {
      // Fetch contacts by audience (simplified: call our existing API)
      const contactsRes = await fetch(process.env.NEXT_PUBLIC_BASE_URL ? process.env.NEXT_PUBLIC_BASE_URL + '/api/contacts' : 'http://localhost:3000/api/contacts');
      const contacts = await contactsRes.json();
      const emails = (contacts?.contacts || []).map(c => c.email).filter(Boolean);
      // create list, push contacts, create campaign and send now
      let listId = null;
      try {
        const list = await axios.post('https://api.brevo.com/v3/contacts/lists', { name: campaignName || 'Automailer List' }, { headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' } });
        listId = list.data?.id;
      } catch (_) {}
      if (emails.length) {
        await Promise.allSettled(emails.map(e => axios.post('https://api.brevo.com/v3/contacts', { email: e, listIds: listId ? [listId] : undefined }, { headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' } })));
      }
      const campaign = await axios.post('https://api.brevo.com/v3/emailCampaigns', {
        name: campaignName || 'Automailer Campaign',
        subject,
        sender: { email: process.env.BREVO_SENDER_EMAIL || 'no-reply@automailer.app', name: 'Automailer' },
        type: 'classic',
        htmlContent: emailBody,
        recipients: listId ? { listIds: [listId] } : undefined,
      }, { headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' } });
      const id = campaign.data?.id;
      if (id) await axios.post(`https://api.brevo.com/v3/emailCampaigns/${id}/sendNow`, {}, { headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' } });
    }

    return res.status(200).json({ ok: true, id: docRef.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}



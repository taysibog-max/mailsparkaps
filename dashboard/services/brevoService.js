import brevo from '../lib/brevo';

export async function getContacts() {
  const { data } = await brevo.get('/contacts');
  return data;
}

export async function getContactDetails(email) {
  const { data } = await brevo.get(`/contacts/${encodeURIComponent(email)}`);
  return data;
}

export async function addContact(payload) {
  const { data } = await brevo.post('/contacts', payload);
  return data;
}

export async function sendEmail(payload) {
  const { data } = await brevo.post('/smtp/email', payload);
  return data;
}

export async function getCampaigns() {
  const { data } = await brevo.get('/emailCampaigns');
  return data;
}

export async function getStats() {
  const { data } = await brevo.get('/smtp/statistics/reports');
  return data;
}

export async function getTemplates() {
  const { data } = await brevo.get('/smtp/templates');
  return data;
}



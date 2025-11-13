const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_BASE_URL = 'https://api.brevo.com/v3';

/**
 * Generic fetch wrapper for Brevo API
 */
async function brevoFetch(endpoint, options = {}) {
  const url = `${BREVO_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'accept': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo API Error (${response.status}): ${errorText}`);
  }

  // Some Brevo endpoints return 204 No Content
  if (response.status === 204) {
    return { ok: true };
  }

  // Some endpoints may not return JSON
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { ok: true };
  }

  return response.json();
}

/**
 * Add or update contact in Brevo
 */
export async function addOrUpdateContact({ email, attributes = {}, listIds = [] }) {
  return brevoFetch('/contacts', {
    method: 'POST',
    body: JSON.stringify({
      email,
      attributes,
      listIds,
      updateEnabled: true,
    }),
  });
}

/**
 * Create email campaign
 */
export async function createCampaign({
  name,
  subject,
  sender,
  replyTo,
  htmlContent,
  recipients,
  scheduledAt = null,
}) {
  return brevoFetch('/emailCampaigns', {
    method: 'POST',
    body: JSON.stringify({
      name,
      subject,
      sender,
      replyTo,
      htmlContent,
      recipients,
      scheduledAt,
    }),
  });
}

/**
 * Send campaign immediately
 */
export async function sendCampaign(campaignId) {
  return brevoFetch(`/emailCampaigns/${campaignId}/sendNow`, {
    method: 'POST',
  });
}

/**
 * Delete campaign
 */
export async function deleteCampaign(campaignId) {
  return brevoFetch(`/emailCampaigns/${campaignId}`, {
    method: 'DELETE',
  });
}

/**
 * Send test email
 */
export async function sendTestEmail(campaignId, emailTo) {
  return brevoFetch(`/emailCampaigns/${campaignId}/sendTest`, {
    method: 'POST',
    body: JSON.stringify({ emailTo: [emailTo] }),
  });
}

/**
 * Get all email templates
 */
export async function getTemplates() {
  return brevoFetch('/smtp/templates');
}

/**
 * Get template by ID
 */
export async function getTemplate(templateId) {
  return brevoFetch(`/smtp/templates/${templateId}`);
}

/**
 * Send transactional email
 */
export async function sendTransactionalEmail({
  to,
  subject,
  htmlContent,
  sender,
  replyTo,
  templateId = null,
  params = {},
}) {
  const payload = {
    to: [{ email: to }],
    subject,
    htmlContent,
    sender,
    replyTo,
  };

  if (templateId) {
    payload.templateId = templateId;
    payload.params = params;
    delete payload.htmlContent;
    delete payload.subject;
  }

  return brevoFetch('/smtp/email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Track custom event (for automation workflows)
 */
export async function trackEvent({ email, event, properties = {} }) {
  return brevoFetch('/events', {
    method: 'POST',
    body: JSON.stringify({
      email,
      event,
      properties,
    }),
  });
}

/**
 * Get campaign statistics
 */
export async function getCampaignStats(campaignId) {
  return brevoFetch(`/emailCampaigns/${campaignId}`);
}

/**
 * Get all campaigns
 */
export async function getCampaigns({ limit = 50, offset = 0, status = null } = {}) {
  let endpoint = `/emailCampaigns?limit=${limit}&offset=${offset}`;
  if (status) endpoint += `&status=${status}`;
  return brevoFetch(endpoint);
}

/**
 * Create automation workflow
 */
export async function createAutomation({
  name,
  triggerEvent,
  actions,
  delay = 0,
}) {
  // Note: Brevo's automation API might be different, this is a conceptual implementation
  return brevoFetch('/automation/workflows', {
    method: 'POST',
    body: JSON.stringify({
      name,
      trigger: {
        event: triggerEvent,
      },
      actions,
      delay,
    }),
  });
}

/**
 * Get contact lists
 */
export async function getLists() {
  return brevoFetch('/contacts/lists');
}

/**
 * Create contact list
 */
export async function createList(name) {
  return brevoFetch('/contacts/lists', {
    method: 'POST',
    body: JSON.stringify({ name, folderId: 1 }),
  });
}

/**
 * Get account info
 */
export async function getAccount() {
  return brevoFetch('/account');
}

export default {
  addOrUpdateContact,
  createCampaign,
  sendCampaign,
  deleteCampaign,
  sendTestEmail,
  getTemplates,
  getTemplate,
  sendTransactionalEmail,
  trackEvent,
  getCampaignStats,
  getCampaigns,
  createAutomation,
  getLists,
  createList,
  getAccount,
};



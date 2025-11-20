/**
 * Google Cloud Tasks helper
 * Schedules a delayed HTTP call to our Next.js API routes.
 */
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

function readServiceAccountJson() {
  try {
    if (process.env.GCP_SA_JSON) {
      return JSON.parse(process.env.GCP_SA_JSON);
    }
  } catch (_) {}
  try {
    const p = path.join(process.cwd(), 'secrets', 'gcp-tasks-sa.json');
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch (_) {}
  return null;
}

function getBaseUrl() {
  // Prefer explicit base for tasks (public prod domain)
  if (process.env.TASK_TARGET_BASE) return process.env.TASK_TARGET_BASE;
  if (process.env.INTERNAL_API_BASE_URL) return process.env.INTERNAL_API_BASE_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return '';
}

export function isCloudTasksConfigured() {
  const sa = readServiceAccountJson();
  const projectId = process.env.GCP_PROJECT_ID || sa?.project_id;
  const location = process.env.CLOUD_TASKS_LOCATION || '';
  const queue = process.env.CLOUD_TASKS_QUEUE || '';
  return Boolean(sa && projectId && location && queue && getBaseUrl());
}

/**
 * Enqueue HTTP task to POST /api/automation/trigger with delaySeconds
 */
export async function enqueueAutomationTrigger({ userId, eventId, eventData, delaySeconds = 60 }) {
  const sa = readServiceAccountJson();
  if (!sa) throw new Error('Missing GCP service account JSON');
  const projectId = process.env.GCP_PROJECT_ID || sa.project_id;
  const location = process.env.CLOUD_TASKS_LOCATION;
  const queue = process.env.CLOUD_TASKS_QUEUE;
  const baseUrl = getBaseUrl();
  if (!projectId || !location || !queue || !baseUrl) {
    throw new Error('Cloud Tasks not configured (project/location/queue/baseUrl)');
  }

  // Get OAuth2 access token via JWT assertion
  const nowSec = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' }
  );
  const oauthResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }).toString(),
  });
  const oauthData = await oauthResp.json().catch(() => ({}));
  const accessToken = oauthData?.access_token;
  if (!accessToken) {
    throw new Error(`Failed to obtain access token: ${oauthData?.error || 'unknown_error'}`);
  }

  const parent = `projects/${projectId}/locations/${location}/queues/${queue}`;
  const targetUrl = `${baseUrl}/api/automation/trigger`;
  const body = {
    userId,
    eventId,
    eventType: 'cart_abandoned',
    eventData,
  };
  const headers = {
    'Content-Type': 'application/json',
  };
  if (process.env.CRON_SECRET) {
    headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`;
  }

  const taskPayload = {
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: targetUrl,
        headers,
        body: Buffer.from(JSON.stringify(body)).toString('base64'),
      },
      scheduleTime: {
        seconds: Math.floor((Date.now() + delaySeconds * 1000) / 1000),
      },
    },
  };

  const resp = await fetch(`https://cloudtasks.googleapis.com/v2/${parent}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(taskPayload),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Cloud Tasks create failed: ${resp.status} ${txt}`);
  }
}

 

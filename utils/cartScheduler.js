'use strict';

const cron = require('node-cron');

let scheduledTask = null;

function startCartScheduler() {
  // If already scheduled, skip
  if (scheduledTask) return scheduledTask;
  // Run every 10 minutes by default
  scheduledTask = cron.schedule('*/10 * * * *', async () => {
    try {
      await manualCheck();
    } catch (err) {
      console.error('[cartScheduler] periodic run failed:', err.message);
    }
  }, { scheduled: true });
  console.log('[cartScheduler] Scheduler started (every 10 minutes).');
  return scheduledTask;
}

async function manualCheck() {
  // Placeholder logic – integrate real abandoned cart checks here.
  // Keeping this lightweight so the HTTP server can run without extra deps.
  console.log('[cartScheduler] manualCheck executed');
  return { ok: true };
}

module.exports = { startCartScheduler, manualCheck };




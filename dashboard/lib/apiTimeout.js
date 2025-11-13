/**
 * API Timeout Manager
 * Dodaje timeout za API pozive i fallback logiku
 */

export function withTimeout(promise, timeoutMs = 10000, fallbackValue = null) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`API timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]).catch(error => {
    console.warn('API call timed out:', error.message);
    return fallbackValue;
  });
}

export function createTimeoutApiCall(apiCall, timeoutMs = 10000, fallbackValue = null) {
  return (...args) => withTimeout(apiCall(...args), timeoutMs, fallbackValue);
}

// Optimizovani API pozivi sa timeout-om
export const optimizedApiGet = createTimeoutApiCall(
  (url) => fetch(url).then(res => res.json()),
  8000, // 8 sekundi timeout
  null
);

export const optimizedApiPost = createTimeoutApiCall(
  (url, data) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()),
  15000, // 15 sekundi timeout za POST
  null
);

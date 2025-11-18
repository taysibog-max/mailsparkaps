// Provide runtime config for static pages when hosted on Next/Vercel
// Ensures links to dashboard origin work in static HTML
(function () {
  try {
    var origin = (typeof window !== 'undefined' && window.location && window.location.origin) || '';
    window.RUNTIME = Object.assign({}, window.RUNTIME || {}, {
      DASHBOARD_ORIGIN: origin
    });
  } catch (_) {}
})();



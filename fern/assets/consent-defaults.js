/**
 * Google Consent Mode defaults — sets all tracking categories to 'denied'
 * before GTM loads, then replays the user's saved choice from `cc_cookie`
 * for returning visitors.
 *
 * Loaded via `js:` with `strategy: beforeInteractive` in docs.yml so it runs
 * before Fern's GTM tag, which is required for GA4 to honor the defaults.
 */
(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });

  var match = document.cookie.match(/(?:^|;)\s*cc_cookie\s*=\s*([^;]+)/);
  if (!match) return;
  try {
    var prefs = JSON.parse(decodeURIComponent(match[1]));
    var cats = prefs.categories || [];
    var analyticsGranted = cats.indexOf('analytics') > -1;
    var marketingGranted = cats.indexOf('marketing') > -1;
    gtag('consent', 'update', {
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      ad_storage: marketingGranted ? 'granted' : 'denied',
      ad_user_data: marketingGranted ? 'granted' : 'denied',
      ad_personalization: marketingGranted ? 'granted' : 'denied',
    });
  } catch (e) {
    /* ignore malformed cookie */
  }
})();

/**
 * Cookie consent banner for docs.paradex.trade.
 *
 * Loads Orest Bida's vanilla-cookieconsent v3 from jsDelivr and wires its
 * onConsent/onChange callbacks to Google Consent Mode signals so GTM tags
 * only fire after the user makes an explicit choice.
 *
 * Skin matches docs.paradex.trade styling (Paradex tokens from styles.css)
 * and follows Fern's active theme via the `.light` class on <html>.
 */
(function () {
  // vanilla-cookieconsent is loaded ahead of this file by Fern (see the
  // `js:` array in docs.yml). The bundle file is generated from the pinned
  // npm package by scripts/sync-vendor-assets.js at install time — it
  // exposes window.CookieConsent and injects the library's base CSS.
  // Loading via the package manager instead of a runtime CDN fetch removes
  // the supply-chain exposure of jsDelivr / mutable GitHub tags.

  // Inject the Paradex skin
  var style = document.createElement('style');
  style.textContent = [
    '#cc-main {',
    '  --cc-font-family: inherit;',
    '  --cc-font-size: 0.8125rem;',
    '  --cc-bg: var(--paradex-card-bg, #16191C);',
    '  --cc-primary-color: #ffffff;',
    '  --cc-secondary-color: rgba(255, 255, 255, 0.65);',
    '  --cc-border-radius-modal: 8px;',
    '  --cc-border-radius-btn: 7px;',
    '  --cc-modal-border-radius: 8px;',
    '  --cc-modal-padding: 0.875rem;',
    '  --cc-modal-min-width: 0;',
    '  --cc-z-index: 2147483645;',
    '  --cc-btn-primary-bg: transparent;',
    '  --cc-btn-primary-color: var(--paradex-accent, #1BC1CF);',
    '  --cc-btn-primary-border-color: var(--paradex-accent, #1BC1CF);',
    '  --cc-btn-primary-hover-bg: transparent;',
    '  --cc-btn-primary-hover-color: var(--paradex-accent, #1BC1CF);',
    '  --cc-btn-primary-hover-border-color: var(--paradex-accent, #1BC1CF);',
    '  --cc-btn-secondary-bg: transparent;',
    '  --cc-btn-secondary-color: var(--paradex-accent, #1BC1CF);',
    '  --cc-btn-secondary-border-color: var(--paradex-accent, #1BC1CF);',
    '  --cc-btn-secondary-hover-bg: transparent;',
    '  --cc-btn-secondary-hover-color: var(--paradex-accent, #1BC1CF);',
    '  --cc-btn-secondary-hover-border-color: var(--paradex-accent, #1BC1CF);',
    '  --cc-separator-border-color: rgba(255, 255, 255, 0.15);',
    '  --cc-overlay-bg: rgb(0 0 0 / 60%);',
    '}',
    /* Light mode — Fern uses `.light` on <html> */
    'html.light #cc-main {',
    '  --cc-bg: #ffffff;',
    '  --cc-primary-color: #16191C;',
    '  --cc-secondary-color: rgba(22, 25, 28, 0.65);',
    '  --cc-separator-border-color: rgba(0, 0, 0, 0.12);',
    '}',
    '#cc-main .cm--box {',
    '  width: 280px;',
    '  max-width: 280px;',
    '  min-width: 0;',
    '  font-size: 0.8125rem;',
    '  border: 1px solid var(--cc-separator-border-color);',
    '  box-shadow: 0 8px 24px rgb(0 0 0 / 35%);',
    '}',
    '#cc-main .cm__title { font-size: 0.8125rem; font-weight: 500; line-height: 1.2; }',
    '#cc-main .cm__desc { font-size: 0.75rem; line-height: 1.35; color: var(--cc-secondary-color); }',
    '#cc-main .cm__btns { display: flex; flex-direction: row; flex-wrap: wrap; gap: 6px; padding-top: 1rem; }',
    '#cc-main .cm__btn-group { display: flex; flex-direction: row; flex-wrap: nowrap; gap: 12px; flex: 1 1 100%; }',
    '#cc-main .cm__btn-group .cm__btn { flex: 1 1 0; }',
    '#cc-main .cm__btn+.cm__btn, #cc-main .cm__btn-group+.cm__btn-group { margin-top: 0; }',
    '#cc-main .cm__btn, #cc-main .pm__btn {',
    '  height: 32px; min-height: 32px; padding: 0 10px;',
    '  font-size: 0.7rem; font-weight: 400; line-height: 1;',
    '  border-radius: 6px; border-width: 1px; border-style: solid;',
    '}',
    /* Close (x) button — strip outline, keep low-key dismiss color */
    '#cc-main .pm__close-btn, #cc-main .cm__close-btn,',
    '#cc-main [data-role="close"], #cc-main button[aria-label="Close"] {',
    '  border: none; background: transparent; color: #8a8f94;',
    '}',
    '#cc-main .pm__close-btn svg, #cc-main .cm__close-btn svg,',
    '#cc-main [data-role="close"] svg {',
    '  color: currentcolor; fill: currentcolor; stroke: currentcolor;',
    '}',
    '#cc-main .pm__close-btn:hover, #cc-main .cm__close-btn:hover,',
    '#cc-main [data-role="close"]:hover, #cc-main button[aria-label="Close"]:hover {',
    '  color: currentcolor; fill: currentcolor; stroke: currentcolor;',
    '}',
    /* Suppress focus/active outline on every interactive element in the modal. */
    '#cc-main button:focus, #cc-main button:focus-visible,',
    '#cc-main button:active, #cc-main a:focus, #cc-main a:focus-visible {',
    '  outline: none; box-shadow: none;',
    '}',
    /* "Manage preferences" — low-key link, separate row */
    '#cc-main .cm__btn--secondary[data-role="show"], #cc-main .cm__btn[data-role="show"] {',
    '  flex: 1 1 100%; background: transparent; border: none;',
    '  height: 24px; padding: 0; font-size: 0.7rem;',
    '  color: var(--cc-secondary-color); text-decoration: underline;',
    '}',
    /* Preferences modal */
    '#cc-main .pm--box { max-width: 560px; font-size: 0.8125rem; border: 1px solid var(--cc-separator-border-color); }',
    '#cc-main .pm__title { font-size: 0.875rem; font-weight: 500; }',
    '#cc-main .pm__section-title, #cc-main .pm__section-desc { font-size: 0.75rem; }',
    '#cc-main .pm__section-desc { color: var(--cc-secondary-color); }',
    '#cc-main .pm__btns { gap: 6px; }',
    '#cc-main .pm__section--expandable .pm__section-title { padding-right: 4rem; }',
    '#cc-main .pm__btn-group { gap: 6px; }',
  ].join('\n');
  document.head.append(style);

  // Mirror Fern's `.light` class onto the library's `cc--darkmode` flag.
  function syncTheme() {
    var isLight = document.documentElement.classList.contains('light');
    document.documentElement.classList.toggle('cc--darkmode', !isLight);
  }
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  // The vendor JS is registered before this file in docs.yml `js:` so the
  // library global is available synchronously. If Fern delays our script
  // for any reason and the global isn't ready yet, retry once on next tick.
  if (window.CookieConsent) {
    init();
  } else {
    setTimeout(init, 0);
  }

  function pushConsentUpdate() {
    if (!window.CookieConsent) return;
    var analyticsGranted = window.CookieConsent.acceptedCategory('analytics');
    var marketingGranted = window.CookieConsent.acceptedCategory('marketing');
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('consent', 'update', {
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      ad_storage: marketingGranted ? 'granted' : 'denied',
      ad_user_data: marketingGranted ? 'granted' : 'denied',
      ad_personalization: marketingGranted ? 'granted' : 'denied',
    });
    window.dataLayer.push({ event: 'consent_update' });
  }

  function init() {
    if (!window.CookieConsent) return;
    window.CookieConsent.run({
      cookie: { name: 'cc_cookie', expiresAfterDays: 365 },
      guiOptions: {
        consentModal: { layout: 'box', position: 'bottom right' },
        preferencesModal: { layout: 'box' },
      },
      onConsent: pushConsentUpdate,
      onChange: pushConsentUpdate,
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: {},
        marketing: {},
      },
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              title: 'We use cookies',
              description:
                'We use cookies to understand how you use Paradex so we can improve it. ' +
                'See our <a href="https://www.paradex.trade/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a> for details.',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Reject all',
              showPreferencesBtn: 'Manage preferences',
            },
            preferencesModal: {
              title: 'Cookie preferences',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Reject all',
              savePreferencesBtn: 'Save preferences',
              closeIconLabel: 'Close',
              sections: [
                {
                  title: 'Strictly necessary',
                  description: 'Required for the site to function. Cannot be turned off.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Performance',
                  description: 'Allow us to count visits and understand navigation. Activated only with your consent.',
                  linkedCategory: 'analytics',
                },
                {
                  title: 'Targeting',
                  description: 'Used by advertising partners to deliver relevant content. Activated only with your consent.',
                  linkedCategory: 'marketing',
                },
              ],
            },
          },
        },
      },
    });
  }
})();

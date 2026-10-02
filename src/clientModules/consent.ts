/**
 * Cookie consent banner for docs.paradex.trade.
 *
 * Uses Orest Bida's vanilla-cookieconsent (pinned in package.json and bundled
 * by webpack, so nothing loads from a CDN) and wires its onConsent/onChange
 * callbacks to Google Consent Mode, so GTM tags only fire after the user
 * makes an explicit choice. The defaults themselves are set before GTM loads
 * by src/head/consent-defaults.js.
 *
 * The skin matches the Paradex tokens in src/css/custom.css and follows the
 * Docusaurus color mode (`data-theme` on <html>).
 */
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

const SKIN = [

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
    /* Light mode — Docusaurus sets data-theme="light" on <html> */
    'html[data-theme="light"] #cc-main {',
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

function pushConsentUpdate() {
  const analyticsGranted = CookieConsent.acceptedCategory('analytics');
  const marketingGranted = CookieConsent.acceptedCategory('marketing');
  window.dataLayer = window.dataLayer || [];
  // gtag() pushes the `arguments` object, which GTM requires.
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  }
  gtag('consent', 'update', {
    analytics_storage: analyticsGranted ? 'granted' : 'denied',
    ad_storage: marketingGranted ? 'granted' : 'denied',
    ad_user_data: marketingGranted ? 'granted' : 'denied',
    ad_personalization: marketingGranted ? 'granted' : 'denied',
  });
  window.dataLayer.push({event: 'consent_update'});
}

// The library drives its UI through classes on <html> (`show--consent`,
// `show--preferences`, `cc--anim`, `cc--darkmode`). Docusaurus rewrites
// <html class> on hydration and navigation, so restore them when it does.
const openModals = new Set<string>();
let started = false;

function restoreClasses() {
  const html = document.documentElement;
  const wanted: Record<string, boolean> = {
    'cc--darkmode': html.getAttribute('data-theme') !== 'light',
    'cc--anim': started,
    'show--consent': openModals.has('consentModal'),
    'show--preferences': openModals.has('preferencesModal'),
  };
  for (const [name, on] of Object.entries(wanted)) {
    if (html.classList.contains(name) !== on) html.classList.toggle(name, on);
  }
}

if (ExecutionEnvironment.canUseDOM) {
  const style = document.createElement('style');
  style.setAttribute('data-paradex', 'cookieconsent-skin');
  style.textContent = SKIN;
  document.head.append(style);

  restoreClasses();
  new MutationObserver(restoreClasses).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class'],
  });

  const start = () => {
    const update = () => pushConsentUpdate();
    started = true;
    void CookieConsent.run({
      onModalShow: ({modalName}) => {
        openModals.add(modalName);
        restoreClasses();
      },
      onModalHide: ({modalName}) => {
        openModals.delete(modalName);
        restoreClasses();
      },
      cookie: { name: 'cc_cookie', expiresAfterDays: 365 },
      guiOptions: {
        consentModal: { layout: 'box', position: 'bottom right' },
        preferencesModal: { layout: 'box' },
      },
      onConsent: update,
      onChange: update,
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
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once: true});
  } else {
    start();
  }
}

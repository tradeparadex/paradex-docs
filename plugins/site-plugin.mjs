// Local Docusaurus plugin for site-wide behaviour that used to come from
// Fern's docs.yml:
//   - analytics: Google Consent Mode defaults, Google Tag Manager, PostHog
//     and the Meta pixel, injected in the same order Fern loaded them;
//   - redirect rules for the 404 page's client-side fallback;
//   - post-build artifacts: `_redirects`, the raw OpenAPI/AsyncAPI specs,
//     llms.txt / llms-full.txt and a Markdown copy of every page.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';

import {toNetlifyRedirects} from './redirects.mjs';
import {writeLlmsFiles} from './llms.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const headScript = (name) => fs.readFileSync(path.join(here, '..', 'src', 'head', name), 'utf8');

export const ANALYTICS = {
  gtmContainerId: 'GTM-W68Q2TWZ',
  posthog: {
    apiKey: 'phc_PHIavFH8sn5Wzxmqcro0n6zQ3rguK7VPTYCzxMJ8eG8',
    apiHost: 'https://eu.i.posthog.com',
  },
};

function gtmSnippet(id) {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(id)});`;
}

function posthogSnippet({apiKey, apiHost}) {
  // Official PostHog loader snippet.
  return `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(apiKey)},{api_host:${JSON.stringify(apiHost)},capture_pageview:'history_change'});`;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Front matter `subtitle`, for the next-page card (rendered as on the page). */
function rawSubtitle(file) {
  const match = FRONT_MATTER.exec(fs.readFileSync(file, 'utf8'));
  if (!match) return undefined;
  let subtitle;
  try {
    subtitle = yaml.load(match[1])?.subtitle;
  } catch {
    return undefined;
  }
  if (typeof subtitle !== 'string' || !subtitle.trim()) return undefined;
  return subtitle.trim();
}

/**
 * Fern sent twitter:title and twitter:description alongside the Open Graph
 * tags. Copy each page's og:title/og:description into them.
 */
function addTwitterTags(outDir) {
  const OG = /<meta\b[^>]*\bproperty=(["']?)og:(title|description)\1[^>]*>/g;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.html')) {
        const html = fs.readFileSync(file, 'utf8');
        if (html.includes('twitter:title')) continue;
        const out = html.replace(OG, (tag) => `${tag}${tag.replace(/\bproperty=(["']?)og:/, 'name=$1twitter:')}`);
        if (out !== html) fs.writeFileSync(file, out);
      }
    }
  };
  walk(outDir);
}

function lazyOnload(code) {
  return `window.addEventListener('load',function(){(window.requestIdleCallback||function(f){setTimeout(f,1)})(function(){${code}})});`;
}

export default function sitePlugin(context, {site}) {
  return {
    name: 'paradex-site',

    getPathsToWatch() {
      return [
        path.join(site.contentDir, 'navigation.yml'),
        path.join(site.contentDir, 'redirects.yml'),
        path.join(site.contentDir, 'apis', '**', '*'),
      ];
    },

    async contentLoaded({actions}) {
      // A real route per old URL, so links to old URLs pass the build's
      // broken-link check and redirect like Fern's server did.
      for (const {from, to} of site.clientRedirects) {
        actions.addRoute({
          path: from,
          exact: true,
          component: '@site/src/components/RedirectPage.tsx',
          props: {to},
        });
      }
      // Page subtitles by URL, for the "next page" card in each page footer.
      const subtitles = {};
      for (const [file, page] of site.pages) {
        const subtitle = fs.existsSync(file) ? rawSubtitle(file) : undefined;
        if (subtitle) subtitles[page.url] = subtitle;
      }
      actions.setGlobalData({
        subtitles,
        redirectRules: site.redirectRules,
        implicitRedirects: Object.fromEntries(site.implicitRedirects),
        tabs: site.tabs,
        changelogUrl: site.changelog.url,
      });
    },

    injectHtmlTags() {
      return {
        headTags: [
          // Consent Mode defaults must run before GTM loads.
          {tagName: 'script', innerHTML: headScript('consent-defaults.js')},
          {tagName: 'script', innerHTML: gtmSnippet(ANALYTICS.gtmContainerId)},
          {tagName: 'script', innerHTML: posthogSnippet(ANALYTICS.posthog)},
          {tagName: 'script', innerHTML: lazyOnload(headScript('meta-pixel.js'))},
        ],
        preBodyTags: [
          `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${ANALYTICS.gtmContainerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
        ],
      };
    },

    async postBuild({outDir}) {
      addTwitterTags(outDir);
      fs.writeFileSync(
        path.join(outDir, '_redirects'),
        toNetlifyRedirects(site.redirectRules, site.implicitRedirects) +
          // Fern's changelog feed lived at <changelog>.rss.
          `${site.changelog.url}.rss ${site.changelog.url}/rss.xml 200\n`,
      );

      // Raw specs, as Fern served them.
      const writeSpec = (file, document) => {
        fs.mkdirSync(path.dirname(path.join(outDir, file)), {recursive: true});
        fs.writeFileSync(path.join(outDir, `${file}.json`), JSON.stringify(document, null, 2));
        fs.writeFileSync(path.join(outDir, `${file}.yaml`), yaml.dump(document, {noRefs: true, lineWidth: -1}));
      };
      const rest = site.api.specs.get('prod_rest');
      if (rest) writeSpec('openapi', rest.document);
      // Fern also exported each REST API under its navigation title.
      if (rest) writeSpec('openapi/rest-endpoints', rest.document);
      const testnet = site.api.specs.get('testnet_rest');
      if (testnet) writeSpec('openapi/rest-endpoints-2', testnet.document);
      const ws = site.api.specs.get('prod_ws');
      if (ws) {
        fs.writeFileSync(path.join(outDir, 'asyncapi.json'), JSON.stringify(ws.document, null, 2));
        fs.writeFileSync(path.join(outDir, 'asyncapi.yaml'), yaml.dump(ws.document, {noRefs: true, lineWidth: -1}));
      }

      await writeLlmsFiles({site, outDir, siteUrl: context.siteConfig.url});
    },
  };
}

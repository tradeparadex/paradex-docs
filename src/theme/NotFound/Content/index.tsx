// 404 page. Before showing "Page not found", apply the redirect rules from
// docs/redirects.yml in the browser: static hosting cannot evaluate
// `:slug*` patterns, so any old URL that was not expanded at build time is
// redirected here.
//
// Then, as on Fern: a warning icon, "Sorry, we couldn't find that page" and
// up to three similar pages, which the edge layer ranks from the search
// index (GET /_similar-pages, edge/core.mjs), so the index never ships to
// the browser.

import React, {useEffect, useState, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import {usePluginData} from '@docusaurus/useGlobalData';
import Heading from '@theme/Heading';
import type {Props} from '@theme/NotFound/Content';
import styles from './styles.module.css';

type Rule = {source: string; destination: string};
type SiteData = {redirectRules: Rule[]; implicitRedirects: Record<string, string>};
type Suggestion = {title: string; href: string; subtitle?: string};

const WILDCARD = /\/:slug\*$/;

function match(rules: Rule[], pathname: string): string | undefined {
  const clean = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  for (const {source, destination} of rules) {
    if (WILDCARD.test(source)) {
      const prefix = source.replace(WILDCARD, '');
      if (clean === prefix || clean.startsWith(`${prefix}/`)) {
        const rest = clean.slice(prefix.length).replace(/^\//, '');
        return destination.replace(WILDCARD, rest ? `/${rest}` : '');
      }
    } else if (clean === source) {
      return destination;
    }
  }
  return undefined;
}

async function fetchSuggestions(pathname: string): Promise<Suggestion[]> {
  try {
    const res = await fetch(`/_similar-pages?path=${encodeURIComponent(pathname)}`);
    // Without the edge layer (`docusaurus start`), this URL is a 404 page.
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as Suggestion[]).filter((s) => typeof s?.title === 'string' && typeof s?.href === 'string') : [];
  } catch {
    return [];
  }
}

/** Font Awesome's triangle-exclamation, drawn as Fern's 404 page drew it. */
function WarningIcon(): ReactNode {
  return (
    <svg className={styles.icon} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="not-found-border" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--grayscale-a6)" />
          <stop offset="100%" stopColor="var(--grayscale-a11)" />
        </linearGradient>
      </defs>
      <path
        stroke="url(#not-found-border)"
        strokeWidth={4}
        d="M256 0c14.7 0 28.2 8.1 35.2 21l216 400c6.7 12.4 6.4 27.4-.8 39.5S486.1 480 472 480L40 480c-14.1 0-27.2-7.4-34.4-19.5s-7.5-27.1-.8-39.5l216-400c7-12.9 20.5-21 35.2-21zm0 352a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm0-192c-18.2 0-32.7 15.5-31.4 33.7l7.4 104c.9 12.5 11.4 22.3 23.9 22.3 12.6 0 23-9.7 23.9-22.3l7.4-104c1.3-18.2-13.1-33.7-31.4-33.7z"
      />
    </svg>
  );
}

function NotFoundPage({className}: Props): ReactNode {
  const {redirectRules, implicitRedirects} = usePluginData('paradex-site') as SiteData;
  const [checked, setChecked] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | undefined>();

  useEffect(() => {
    const {pathname, search, hash} = window.location;
    let target = match(redirectRules, pathname);
    // Follow chains (old URL -> renamed section -> its first page).
    for (let i = 0; target && i < 5; i++) {
      const [path] = target.split('#');
      const next = match(redirectRules, path) ?? implicitRedirects[path];
      if (!next || next === target) break;
      target = next;
    }
    target = target ?? implicitRedirects[pathname.replace(/\/+$/, '')];
    if (target && target !== pathname) {
      window.location.replace(target + (target.includes('#') ? '' : search + hash));
      return undefined;
    }
    setChecked(true);
    // Fern reported every 404 to the site's PostHog as `not_found`.
    window.posthog?.capture?.('not_found', {pathname, url: window.location.href});
    if (pathname === '/') {
      setSuggestions([]);
      return undefined;
    }
    let active = true;
    fetchSuggestions(pathname).then((found) => active && setSuggestions(found));
    return () => {
      active = false;
    };
  }, [redirectRules, implicitRedirects]);

  return (
    <main className={clsx(styles.page, className)} style={{visibility: checked ? 'visible' : 'hidden'}}>
      <WarningIcon />
      <div className={styles.text}>
        <Heading as="h1" className={styles.title}>
          Sorry, we couldn't find that page
        </Heading>
        <p className={styles.subtitle}>We've been notified so we can fix this for next time.</p>
      </div>
      {checked && suggestions === undefined && <div className={styles.finding}>Finding similar pages...</div>}
      {suggestions && suggestions.length > 0 && (
        <div className={styles.suggestions}>
          <p className={styles.lookingFor}>Were you looking for one of these?</p>
          <div className={styles.list}>
            {suggestions.map((s) => (
              <Link key={s.href} to={s.href} className={styles.card}>
                <span className={styles.cardTitle}>{s.title}</span>
                {s.subtitle && <span className={styles.cardSubtitle}>{s.subtitle}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export default function NotFoundContent(props: Props): ReactNode {
  // Going from one unknown URL to another keeps this route mounted: start
  // over (redirect check, suggestions) for each.
  const {pathname} = useLocation();
  return <NotFoundPage key={pathname} {...props} />;
}

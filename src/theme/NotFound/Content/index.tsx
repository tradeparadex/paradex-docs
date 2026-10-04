// 404 page. Before showing "Page not found", apply the redirect rules from
// docs/redirects.yml in the browser: static hosting cannot evaluate
// `:slug*` patterns, so any old URL that was not expanded at build time is
// redirected here.

import React, {useEffect, useState, type ReactNode} from 'react';
import clsx from 'clsx';
import Translate from '@docusaurus/Translate';
import {usePluginData} from '@docusaurus/useGlobalData';
import Heading from '@theme/Heading';
import type {Props} from '@theme/NotFound/Content';

type Rule = {source: string; destination: string};
type SiteData = {redirectRules: Rule[]; implicitRedirects: Record<string, string>};

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

export default function NotFoundContent({className}: Props): ReactNode {
  const {redirectRules, implicitRedirects} = usePluginData('paradex-site') as SiteData;
  const [checked, setChecked] = useState(false);

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
      return;
    }
    setChecked(true);
  }, [redirectRules, implicitRedirects]);

  return (
    <main className={clsx('container margin-vert--xl', className)} style={{visibility: checked ? 'visible' : 'hidden'}}>
      <div className="row">
        <div className="col col--6 col--offset-3">
          <Heading as="h1" className="hero__title">
            <Translate id="theme.NotFound.title" description="The title of the 404 page">
              Page Not Found
            </Translate>
          </Heading>
          <p>We could not find what you were looking for.</p>
          <p>
            Try the search above, or go to the <a href="/home">home page</a>.
          </p>
        </div>
      </div>
    </main>
  );
}

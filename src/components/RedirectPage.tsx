// A page that only redirects. One is generated for every old URL (see
// plugins/redirects.mjs). The inline script runs before anything renders
// and keeps the query string and #hash, like an HTTP redirect would.

import React from 'react';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function RedirectPage({to}: {to: string}): React.JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const hasHash = to.includes('#');
  const script = `location.replace(${JSON.stringify(to)}${hasHash ? '' : '+location.search+location.hash'});`;
  return (
    <>
      <Head>
        <title>Redirecting…</title>
        <meta name="robots" content="noindex" />
        <link rel="canonical" href={siteConfig.url + to} />
        <script>{script}</script>
        <noscript>{`<meta http-equiv="refresh" content="0; url=${to}">`}</noscript>
      </Head>
      <main className="container margin-vert--xl">
        <p>
          This page has moved to <a href={to}>{to}</a>.
        </p>
      </main>
    </>
  );
}

// Points a page's canonical link and og:url at another URL of the site. The
// API generator adds it to testnet endpoint pages, whose canonical URL is the
// production twin's, as on Fern (plugins/api-reference/generate.mjs). Head
// tags rendered here replace the ones Docusaurus sets for the page itself.

import React from 'react';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function CanonicalUrl({url}: {url: string}): React.JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const href = siteConfig.url + url;
  return (
    <Head>
      <link rel="canonical" href={href} />
      <meta property="og:url" content={href} />
    </Head>
  );
}

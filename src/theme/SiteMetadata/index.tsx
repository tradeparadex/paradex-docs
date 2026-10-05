// Docusaurus's SiteMetadata without its hreflang alternates (en, x-default).
// They always point at the page's own URL, and a page cannot replace them
// (react-helmet keys alternate links by href), so on the testnet endpoint
// pages, whose canonical URL is their production twin's (CanonicalUrl), they
// contradicted the canonical link. The site has one language, and Fern sent
// no hreflang. Everything else is as upstream.

import React, {type ReactNode} from 'react';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {PageMetadata, useThemeConfig} from '@docusaurus/theme-common';
import {DEFAULT_SEARCH_TAG} from '@docusaurus/theme-common/internal';
import {useLocation} from '@docusaurus/router';
import {applyTrailingSlash} from '@docusaurus/utils-common';
import SearchMetadata from '@theme/SearchMetadata';

export default function SiteMetadata(): ReactNode {
  const {
    siteConfig: {url: siteUrl, baseUrl, trailingSlash},
    i18n: {currentLocale, localeConfigs},
  } = useDocusaurusContext();
  const {metadata, image: defaultImage} = useThemeConfig();
  const {pathname} = useLocation();
  const canonicalUrl = siteUrl + applyTrailingSlash(useBaseUrl(pathname), {trailingSlash, baseUrl});
  // Open Graph locales use underscores where HTML lang (BCP 47) uses dashes.
  const ogLocale = localeConfigs[currentLocale]!.htmlLang.replace('-', '_');

  return (
    <>
      <Head>
        <meta name="twitter:card" content="summary_large_image" />
        {/* Lets the keyboard focus class apply in the server-rendered HTML. */}
        <body />
      </Head>

      {defaultImage && <PageMetadata image={defaultImage} />}

      <Head>
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
      </Head>

      <Head>
        <meta property="og:locale" content={ogLocale} />
      </Head>

      <SearchMetadata tag={DEFAULT_SEARCH_TAG} locale={currentLocale} />

      {/* A Head of its own, so these replace the defaults above. */}
      <Head>
        {metadata.map((metadatum, i) => (
          <meta key={i} {...metadatum} />
        ))}
      </Head>
    </>
  );
}

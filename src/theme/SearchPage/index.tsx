// /search: the local search plugin's full results page, reached from "See all
// results" in the search dialog. Fern had no such page. The wrapper styles it
// like the rest of the site (./styles.css, scoped by the `search-page` class
// on <html>) and keeps it out of search engines and sitemap.xml: the plugin's
// own robots tag uses `property=`, which neither honours.

import React, {type ReactNode} from 'react';
import Head from '@docusaurus/Head';
import {HtmlClassNameProvider} from '@docusaurus/theme-common';
import SearchPage from '@theme-original/SearchPage';
import './styles.css';

export default function SearchPageWrapper(): ReactNode {
  return (
    <HtmlClassNameProvider className="search-page">
      <Head>
        <meta name="robots" content="noindex, follow" />
      </Head>
      <SearchPage />
    </HtmlClassNameProvider>
  );
}

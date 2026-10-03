// A changelog entry: Fern's previous (newer) / next (older) bar. The newest
// entry's "Previous" goes back to the changelog itself, as on Fern.

import React, {type ReactNode} from 'react';
import {usePluginData} from '@docusaurus/useGlobalData';
import type {Props} from '@theme/BlogPostPaginator';
import Pagination from '@site/src/components/page/Pagination';

export default function BlogPostPaginator({nextItem, prevItem}: Props): ReactNode {
  const {changelogUrl} = usePluginData('paradex-site') as {changelogUrl: string};
  return <Pagination previous={prevItem ?? {title: 'Changelog', permalink: changelogUrl}} next={nextItem} />;
}

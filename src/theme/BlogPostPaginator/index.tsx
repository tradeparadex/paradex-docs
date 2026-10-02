// A changelog entry: Fern's previous (newer) / next (older) bar.

import React, {type ReactNode} from 'react';
import type {Props} from '@theme/BlogPostPaginator';
import Pagination from '@site/src/components/page/Pagination';

export default function BlogPostPaginator({nextItem, prevItem}: Props): ReactNode {
  return <Pagination previous={prevItem} next={nextItem} />;
}

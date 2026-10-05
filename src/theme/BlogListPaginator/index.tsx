// Changelog index pages: Fern's previous/next bar ("Older posts").

import React, {type ReactNode} from 'react';
import type {Props} from '@theme/BlogListPaginator';
import Pagination from '@site/src/components/page/Pagination';

export default function BlogListPaginator({metadata}: Props): ReactNode {
  const {previousPage, nextPage} = metadata;
  return (
    <Pagination
      previous={previousPage ? {title: 'Newer posts', permalink: previousPage} : undefined}
      next={nextPage ? {title: 'Older posts', permalink: nextPage} : undefined}
    />
  );
}

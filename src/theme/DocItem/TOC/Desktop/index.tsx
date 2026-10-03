import React, {type ReactNode} from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import OnThisPage from '@site/src/components/page/OnThisPage';

export default function DocItemTOCDesktop(): ReactNode {
  const {toc, frontMatter} = useDoc();
  return (
    <OnThisPage
      toc={toc}
      // Level 1 too: Fern listed `#` headings in the content.
      minHeadingLevel={frontMatter.toc_min_heading_level ?? 1}
      maxHeadingLevel={frontMatter.toc_max_heading_level}
    />
  );
}

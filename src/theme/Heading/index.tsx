// Keep anchors on `#` headings inside page content. Fern gave them ids and
// pages link to them (e.g. /risk/cross-margin-requirement#leverage); the
// stock Docusaurus heading drops the id on h1.

import React, {type ReactNode} from 'react';
import Heading from '@theme-original/Heading';
import type {Props} from '@theme/Heading';

export default function HeadingWrapper(props: Props): ReactNode {
  if (props.as === 'h1' && props.id) {
    const {as: As, id, className, children, ...rest} = props;
    return (
      <As {...rest} id={id} className={['anchor', className].filter(Boolean).join(' ')}>
        {children}
        <a href={`#${id}`} className="hash-link" aria-label={`Direct link to ${id}`} title={`Direct link to ${id}`}>
          &#8203;
        </a>
      </As>
    );
  }
  return <Heading {...props} />;
}

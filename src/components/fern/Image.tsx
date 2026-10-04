// Content images enlarge in a dialog when clicked, with the zoom library Fern
// uses. MDX renders Markdown images and raw <img> tags (see remarkFernJsx)
// through this, inside <Frame>, <Steps> and <Tabs> too.

import React from 'react';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

export default function Image(props: React.ComponentProps<'img'>): React.JSX.Element {
  // A <span> wrapper, as on Fern: a Markdown image sits inside a <p>. Like
  // Fern, the zoomed image fills the window even past its natural size,
  // which the library only does when it is given a zoom image.
  return (
    <Zoom wrapElement="span" zoomImg={{src: props.src}}>
      <img {...props} />
    </Zoom>
  );
}

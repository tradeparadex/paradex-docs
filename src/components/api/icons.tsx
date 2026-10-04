// Line icons used by the API reference (Lucide shapes, as on Fern).

import React from 'react';

type Props = {className?: string; strokeWidth?: number};

function Svg({children, className, strokeWidth = 2}: Props & {children: React.ReactNode}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false">
      {children}
    </svg>
  );
}

export const CopyIcon = (p: Props) => (
  <Svg {...p}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Svg>
);

export const CheckIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

/** Four arrows out to the corners (Fern's "Expand code"). */
export const MaximizeIcon = (p: Props) => (
  <Svg {...p}>
    <path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8" />
    <path d="M3 16.2V21m0 0h4.8M3 21l6-6" />
    <path d="M21 7.8V3m0 0h-4.8M21 3l-6 6" />
    <path d="M3 7.8V3m0 0h4.8M3 3l6 6" />
  </Svg>
);

/** Two chain links (Fern's deep-link button). */
export const LinkIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
    <path d="M8 12h8" />
  </Svg>
);

export const CloseIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
);

export const ChevronDownIcon = (p: Props) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const PlusIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </Svg>
);

export const MinusIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const SearchIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
);

export const ArrowUpIcon = (p: Props) => (
  <Svg {...p}>
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </Svg>
);

export const ArrowDownIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </Svg>
);

export const ArrowUpRightIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </Svg>
);

export const WifiIcon = (p: Props) => (
  <Svg strokeWidth={1.5} {...p}>
    <path d="M12 20h.01" />
    <path d="M2 8.82a15 15 0 0 1 20 0" />
    <path d="M5 12.859a10 10 0 0 1 14 0" />
    <path d="M8.5 16.429a5 5 0 0 1 7 0" />
  </Svg>
);

/** Fern's "Connect" icon: a dot sending waves to the right. */
export const BroadcastIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h.01" />
    <path d="M9 8.5a5 5 0 0 1 0 7" />
    <path d="M12.5 6a9 9 0 0 1 0 12" />
    <path d="M16 3.5a13 13 0 0 1 0 17" />
  </Svg>
);

export const PlayIcon = (p: Props) => (
  <Svg {...p}>
    <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" />
  </Svg>
);

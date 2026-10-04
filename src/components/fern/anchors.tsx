// Page-scoped anchor ids for tab, accordion and step titles. Fern made these
// linkable (#closing-hours, #closing-hours-1, ...), de-duplicating repeated
// titles with a numeric suffix; existing links rely on those ids. Also the
// copy-on-click behaviour of Fern's heading link buttons and step badges.

import React, {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {slugifyHeading} from './utils';

const AnchorRegistry = createContext<Map<string, number> | null>(null);

export function AnchorIdProvider({seed = [], children}: {seed?: string[]; children: ReactNode}): React.JSX.Element {
  const [registry] = useState(() => new Map(seed.map((id) => [id, 1])));
  return <AnchorRegistry.Provider value={registry}>{children}</AnchorRegistry.Provider>;
}

/** Stable, unique anchor id for a title (claimed once per mount). */
export function useAnchorId(title: ReactNode): string | undefined {
  const registry = useContext(AnchorRegistry);
  const [id] = useState(() => {
    if (typeof title !== 'string') return undefined;
    const base = slugifyHeading(title);
    if (!base || !registry) return base || undefined;
    const count = registry.get(base) ?? 0;
    registry.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  });
  return id;
}

/** The id a URL hash names; a malformed escape (#100%) is kept as is instead of throwing. */
export function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

/** Calls `onMatch` when the URL hash targets `id` (on load and on change). */
export function useHashTarget(id: string | undefined, onMatch: () => void): void {
  useEffect(() => {
    if (!id) return undefined;
    const check = () => {
      if (decodeHash(window.location.hash) === id) {
        onMatch();
        window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({block: 'start'}));
      }
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}

/** A plain left click; modified clicks open a link as usual. */
export function isPlainClick(event: React.MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Fern's section links (heading link buttons, step badges): a click puts
 * `#id` in the address bar, replacing the history entry and without
 * scrolling, and copies the section's URL. `copied` stays true for two
 * seconds, while the button shows a tick.
 */
export function useCopyLink(id: string | undefined): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = () => {
    if (!id) return;
    const {origin, pathname, search} = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${search}#${id}`);
    const done = () => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(`${origin}${pathname}#${id}`).then(done, done);
    else done();
  };
  return [copied, copy];
}

// Page-scoped anchor ids for tab, accordion and step titles. Fern made these
// linkable (#closing-hours, #closing-hours-1, ...), de-duplicating repeated
// titles with a numeric suffix; existing links rely on those ids.

import React, {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
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

/** Calls `onMatch` when the URL hash targets `id` (on load and on change). */
export function useHashTarget(id: string | undefined, onMatch: () => void): void {
  useEffect(() => {
    if (!id) return undefined;
    const check = () => {
      if (decodeURIComponent(window.location.hash.slice(1)) === id) {
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

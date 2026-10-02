// Fern's code blocks scroll inside a Radix ScrollArea: the native scrollbars
// are hidden and thin rounded bars fade in over the code while the pointer is
// on the block. This reproduces that on a plain overflow container (the
// native bars are hidden in src/css/code.css).

import React, {useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject} from 'react';
import clsx from 'clsx';

type Axis = 'x' | 'y';
const AXES: Axis[] = ['x', 'y'];
const MIN_THUMB = 18;
const HIDE_DELAY = 600;

type Metrics = {client: number; scroll: number; offset: number; track: number};

function metrics(el: HTMLElement, track: HTMLElement, axis: Axis): Metrics {
  return axis === 'x'
    ? {client: el.clientWidth, scroll: el.scrollWidth, offset: el.scrollLeft, track: track.clientWidth}
    : {client: el.clientHeight, scroll: el.scrollHeight, offset: el.scrollTop, track: track.clientHeight};
}

function thumbSize(m: Metrics): number {
  return Math.max(MIN_THUMB, (m.track * m.client) / Math.max(1, m.scroll));
}

export default function OverlayScrollbars({
  viewport,
  root,
}: {
  viewport: RefObject<HTMLElement | null>;
  root: RefObject<HTMLElement | null>;
}): React.JSX.Element {
  const [overflow, setOverflow] = useState({x: false, y: false});
  const [visible, setVisible] = useState(false);
  const xTrack = useRef<HTMLDivElement>(null);
  const yTrack = useRef<HTMLDivElement>(null);
  const xThumb = useRef<HTMLDivElement>(null);
  const yThumb = useRef<HTMLDivElement>(null);
  const tracks = {x: xTrack, y: yTrack};
  const thumbs = {x: xThumb, y: yThumb};

  const position = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    for (const axis of AXES) {
      const track = (axis === 'x' ? xTrack : yTrack).current;
      const thumb = (axis === 'x' ? xThumb : yThumb).current;
      if (!track || !thumb) continue;
      const m = metrics(el, track, axis);
      const size = thumbSize(m);
      const max = Math.max(1, m.scroll - m.client);
      const pos = (m.track - size) * Math.min(1, Math.max(0, m.offset / max));
      thumb.style[axis === 'x' ? 'width' : 'height'] = `${size}px`;
      thumb.style.transform = axis === 'x' ? `translate3d(${pos}px,0,0)` : `translate3d(0,${pos}px,0)`;
    }
  }, [viewport]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return undefined;
    const update = () => {
      const x = el.scrollWidth > el.clientWidth + 1;
      const y = el.scrollHeight > el.clientHeight + 1;
      setOverflow((o) => (o.x === x && o.y === y ? o : {x, y}));
      position();
    };
    update();
    el.addEventListener('scroll', position, {passive: true});
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', position);
      observer?.disconnect();
    };
  }, [viewport, position]);

  // Show while the pointer is over the block, as Radix's type="hover".
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    let timer: number | undefined;
    const enter = () => {
      window.clearTimeout(timer);
      setVisible(true);
    };
    const leave = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), HIDE_DELAY);
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    };
  }, [root]);

  useEffect(position, [overflow, visible, position]);

  const onPointerDown = (axis: Axis) => (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = viewport.current;
    const track = tracks[axis].current;
    const thumb = thumbs[axis].current;
    if (!el || !track || !thumb || event.button !== 0) return;
    event.preventDefault();
    const m = metrics(el, track, axis);
    const size = thumbSize(m);
    const ratio = (m.scroll - m.client) / Math.max(1, m.track - size);
    const coord = (e: {clientX: number; clientY: number}) => (axis === 'x' ? e.clientX : e.clientY);
    const scrollTo = (value: number) => {
      if (axis === 'x') el.scrollLeft = value;
      else el.scrollTop = value;
    };
    if (event.target !== thumb) {
      // Clicking the track centers the thumb on the pointer.
      const rect = track.getBoundingClientRect();
      const start = coord(event) - (axis === 'x' ? rect.left : rect.top) - size / 2;
      scrollTo(start * ratio);
    }
    const startCoord = coord(event);
    const startOffset = axis === 'x' ? el.scrollLeft : el.scrollTop;
    const move = (e: PointerEvent) => scrollTo(startOffset + (coord(e) - startCoord) * ratio);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <>
      {AXES.map((axis) =>
        overflow[axis] ? (
          <div
            key={axis}
            ref={tracks[axis]}
            className={clsx('fern-code__scrollbar', `fern-code__scrollbar--${axis}`, overflow.x && overflow.y && 'fern-code__scrollbar--both')}
            data-state={visible ? 'visible' : 'hidden'}
            aria-hidden="true"
            onPointerDown={onPointerDown(axis)}>
            <div ref={thumbs[axis]} className="fern-code__thumb" />
          </div>
        ) : null,
      )}
    </>
  );
}

/**
 * Keep the active sidebar entry in view after navigation, as Fern did:
 * deep pages (e.g. an instrument under Instruments Guide) would otherwise
 * open with the sidebar scrolled to the top. Only the sidebar's own scroll
 * container moves; the page itself stays at the top.
 */
import type {ClientModule} from '@docusaurus/types';

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const {overflowY} = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

const clientModule: ClientModule = {
  onRouteDidUpdate() {
    window.requestAnimationFrame(() => {
      const active = document.querySelector<HTMLElement>('.theme-doc-sidebar-menu a.menu__link[aria-current="page"]');
      const container = active && scrollParent(active);
      if (!active || !container) return;
      const box = active.getBoundingClientRect();
      const view = container.getBoundingClientRect();
      if (box.top < view.top || box.bottom > view.bottom) {
        container.scrollTop += box.top - view.top - (view.height - box.height) / 2;
      }
    });
  },
};

export default clientModule;

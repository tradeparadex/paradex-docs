/**
 * Keep the active sidebar entry in view after navigation, as Fern did:
 * deep pages (e.g. an instrument under Instruments Guide) would otherwise
 * open with the sidebar scrolled to the top.
 */
import type {ClientModule} from '@docusaurus/types';

const clientModule: ClientModule = {
  onRouteDidUpdate() {
    window.requestAnimationFrame(() => {
      const active = document.querySelector<HTMLElement>('.theme-doc-sidebar-menu .menu__link--active:not(.menu__link--sublist)');
      const container = active?.closest<HTMLElement>('nav, .menu');
      if (!active || !container) return;
      const box = active.getBoundingClientRect();
      const view = container.getBoundingClientRect();
      if (box.top < view.top || box.bottom > view.bottom) {
        active.scrollIntoView({block: 'center'});
      }
    });
  },
};

export default clientModule;

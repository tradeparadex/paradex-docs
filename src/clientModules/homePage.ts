/**
 * Home page hero marquee: cycles through words (Equities, FX, Commodities,
 * Crypto) with a vertical slide-and-fade transition, matching paradex.trade.
 * Also tags <body> with `is-home-page` on /home.
 */
import type {ClientModule} from '@docusaurus/types';

const INTERVAL = 2500;
let timerId: number | undefined;

function startCycling(items: HTMLElement[]) {
  window.clearInterval(timerId);
  let index = 0;
  items.forEach((el, i) => {
    el.style.opacity = i === 0 ? '1' : '0';
    el.style.transform = i === 0 ? 'translateY(0)' : 'translateY(100%)';
  });
  timerId = window.setInterval(() => {
    // Current item scrolls up and out.
    items[index].style.opacity = '0';
    items[index].style.transform = 'translateY(-100%)';
    index = (index + 1) % items.length;
    // Next item starts below, then scrolls up into place.
    const next = items[index];
    next.style.transition = 'none';
    next.style.transform = 'translateY(100%)';
    next.style.opacity = '0';
    void next.offsetHeight; // reflow so the reset applies before the transition
    next.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    next.style.opacity = '1';
    next.style.transform = 'translateY(0)';
  }, INTERVAL);
}

const clientModule: ClientModule = {
  onRouteDidUpdate({location}) {
    const isHome = location.pathname === '/home' || location.pathname.startsWith('/home/');
    document.body.classList.toggle('is-home-page', isHome);
    window.clearInterval(timerId);
    const items = Array.from(document.querySelectorAll<HTMLElement>('.lp-marquee-item'));
    if (items.length) startCycling(items);
  },
};

export default clientModule;

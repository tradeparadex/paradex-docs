/**
 * Adds 'is-home-page' class to body when on the /home route.
 * This enables CSS rules that hide feedback/edit/copy elements on the home page.
 */
(function () {
  function updateHomeClass() {
    var isHome = window.location.pathname === '/home' || window.location.pathname.startsWith('/home/');
    if (isHome) {
      document.body.classList.add('is-home-page');
    } else {
      document.body.classList.remove('is-home-page');
    }
  }

  // Run on initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateHomeClass);
  } else {
    updateHomeClass();
  }

  // Watch for client-side navigation (SPA route changes)
  var observer = new MutationObserver(updateHomeClass);
  observer.observe(document.body, { childList: true, subtree: true });

  // Also listen for popstate (browser back/forward)
  window.addEventListener('popstate', updateHomeClass);
})();

/**
 * Hero marquee: cycles through words (Futures, Options, Spot, Commodities)
 * with a vertical slide-and-fade transition, matching paradex.trade.
 */
(function () {
  var INTERVAL = 2500;
  var timerId = null;
  var pollId = null;

  function startCycling(items) {
    if (timerId) { clearInterval(timerId); timerId = null; }

    var index = 0;
    items.forEach(function (el, i) {
      if (i === 0) el.classList.add('active');
      else el.classList.remove('active');
    });

    timerId = setInterval(function () {
      items[index].classList.remove('active');
      index = (index + 1) % items.length;
      items[index].classList.add('active');
    }, INTERVAL);
  }

  function tryInit() {
    var items = document.querySelectorAll('.lp-marquee-item');
    if (items.length) {
      if (pollId) { clearInterval(pollId); pollId = null; }
      startCycling(items);
      return true;
    }
    return false;
  }

  // Poll until marquee elements appear (handles React/SSR hydration timing)
  function waitForMarquee() {
    if (tryInit()) return;
    if (pollId) clearInterval(pollId);
    pollId = setInterval(function () { tryInit(); }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForMarquee);
  } else {
    waitForMarquee();
  }

  // Re-init on SPA navigation when marquee re-enters the DOM
  var marqueeObserver = new MutationObserver(function () {
    var items = document.querySelectorAll('.lp-marquee-item');
    if (items.length && !document.querySelector('.lp-marquee-item.active')) {
      startCycling(items);
    }
  });
  marqueeObserver.observe(document.body, { childList: true, subtree: true });
})();

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
    // Set initial state: first item visible, others waiting below
    items.forEach(function (el, i) {
      el.style.opacity = i === 0 ? '1' : '0';
      el.style.transform = i === 0 ? 'translateY(0)' : 'translateY(100%)';
    });

    timerId = setInterval(function () {
      // Current item scrolls up and out
      items[index].style.opacity = '0';
      items[index].style.transform = 'translateY(-100%)';

      // Move to next
      index = (index + 1) % items.length;

      // Next item starts below, then scrolls up into place
      items[index].style.transition = 'none';
      items[index].style.transform = 'translateY(100%)';
      items[index].style.opacity = '0';
      // Force reflow so the reset takes effect before transition starts
      void items[index].offsetHeight;
      items[index].style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      items[index].style.opacity = '1';
      items[index].style.transform = 'translateY(0)';
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

  // Re-init on SPA navigation
  var marqueeObserver = new MutationObserver(function () {
    var items = document.querySelectorAll('.lp-marquee-item');
    if (items.length && items[0].style.opacity === '') {
      startCycling(items);
    }
  });
  marqueeObserver.observe(document.body, { childList: true, subtree: true });
})();

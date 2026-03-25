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

  function initMarquee() {
    var items = document.querySelectorAll('.lp-marquee-item');
    if (!items.length) return;

    // Clear any previous timer (SPA navigation)
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

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMarquee);
  } else {
    initMarquee();
  }

  // Re-init on SPA navigation
  var marqueeObserver = new MutationObserver(function () {
    if (document.querySelector('.lp-marquee-item') && !document.querySelector('.lp-marquee-item.active')) {
      initMarquee();
    }
  });
  marqueeObserver.observe(document.body, { childList: true, subtree: true });
})();

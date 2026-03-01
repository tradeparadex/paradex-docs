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

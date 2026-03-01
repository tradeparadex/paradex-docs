/**
 * Adds 'is-home-page' class to body when on the /home route.
 * This enables CSS rules that hide feedback/edit/copy elements on the home page.
 */
(function () {
  function updateHomeClass() {
    if (window.location.pathname === '/home' || window.location.pathname === '/home/') {
      document.body.classList.add('is-home-page');
    } else {
      document.body.classList.remove('is-home-page');
    }
  }

  // Run on initial load
  updateHomeClass();

  // Watch for client-side navigation (SPA route changes)
  const observer = new MutationObserver(updateHomeClass);
  observer.observe(document.body, { childList: true, subtree: true });
})();

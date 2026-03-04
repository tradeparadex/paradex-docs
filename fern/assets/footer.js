/**
 * Paradex docs footer — appends a slim bar with right-aligned social icons
 * inside the #fern-footer element so it persists across SPA navigations.
 * Icons: Discord, X (Twitter), GitHub, LinkedIn
 */
(function () {
  var FOOTER_ID = "paradex-social-footer";

  var icons = [
    {
      href: "https://discord.gg/paradex",
      title: "Discord",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>'
    },
    {
      href: "https://x.com/paradex",
      title: "X",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'
    },
    {
      href: "https://github.com/tradeparadex",
      title: "GitHub",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>'
    },
    {
      href: "https://www.linkedin.com/company/tradeparadex",
      title: "LinkedIn",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'
    }
  ];

  function injectStyles() {
    if (document.getElementById(FOOTER_ID + "-styles")) return;
    var style = document.createElement("style");
    style.id = FOOTER_ID + "-styles";
    style.textContent =
      "#" + FOOTER_ID + " {" +
        "border-top: 1px solid rgba(255,255,255,0.1);" +
        "background-color: var(--paradex-bg, #090A0A);" +
        "padding: 12px 24px;" +
        "display: flex;" +
        "justify-content: flex-end;" +
        "align-items: center;" +
        "gap: 16px;" +
        "width: 100%;" +
      "}" +
      "#" + FOOTER_ID + " a {" +
        "color: rgba(255,255,255,0.5);" +
        "display: flex;" +
        "align-items: center;" +
        "justify-content: center;" +
        "text-decoration: none;" +
        "transition: color 0.15s ease;" +
      "}" +
      "#" + FOOTER_ID + " a:hover {" +
        "color: rgba(255,255,255,0.9);" +
      "}" +
      "#" + FOOTER_ID + " a svg {" +
        "display: block;" +
      "}";
    document.head.appendChild(style);
  }

  function createFooter() {
    if (document.getElementById(FOOTER_ID)) return;

    injectStyles();

    var footer = document.createElement("div");
    footer.id = FOOTER_ID;

    for (var i = 0; i < icons.length; i++) {
      var link = document.createElement("a");
      link.href = icons[i].href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = icons[i].title;
      link.innerHTML = icons[i].svg;
      footer.appendChild(link);
    }

    // Append inside #fern-footer if available, otherwise at end of body
    var fernFooter = document.getElementById("fern-footer");
    if (fernFooter) {
      fernFooter.appendChild(footer);
    } else {
      document.body.appendChild(footer);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createFooter);
  } else {
    createFooter();
  }

  // Re-inject if removed during SPA navigation
  var observer = new MutationObserver(function () {
    if (!document.getElementById(FOOTER_ID)) {
      createFooter();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

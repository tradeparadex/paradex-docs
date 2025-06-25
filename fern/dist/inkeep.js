function loadScript(url, callback) {
  const script = document.createElement("script");
  script.src = url;
  script.type = "text/javascript";
  script.onload = callback;
  document.head.appendChild(script);
}

loadScript(
  "https://cdn.jsdelivr.net/npm/@inkeep/cxkit-fern@0.5/dist/index.js",
  () => {
    const settings = {
      baseSettings: {
        apiKey: "1e1660d254edc816b721951f6b1973f0492028b235f8dca6", // required
        primaryBrandColor: "#c83efb", // required -- your brand color, the color scheme is derived from this
        organizationDisplayName: "Paradex",
      },
      aiChatSettings: {
        // ...optional settings
        aiAssistantAvatar: "https://mydomain.com/mylogo.svg",
        exampleQuestions: [
          "What is the API Rate limit?"
        ],
      },
    };

    // Initialize the UI components
    Inkeep.ModalSearchAndChat(settings); // Search Bar
    Inkeep.ChatButton(settings); // 'Ask AI' button
  }
);
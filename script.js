(() => {
  const app = document.createElement("script");
  app.src = "https://chaoyifan.github.io/crowdcheck-s1-control/study1-app.js?v=d459af4b0b99700115e9a084bfc3c2434f090d5d";
  app.async = false;
  app.onload = () => {
    const editing = document.createElement("script");
    editing.src = "https://chaoyifan.github.io/crowdcheck-s1-control/study1-post-edit.js?v=20260730a";
    editing.async = false;
    document.head.appendChild(editing);
  };
  document.head.appendChild(app);
})();

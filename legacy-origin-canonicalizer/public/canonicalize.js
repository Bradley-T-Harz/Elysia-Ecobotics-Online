(() => {
  const destination = new URL("https://elysiaecobotics.com");
  destination.pathname = window.location.pathname;
  destination.search = window.location.search;
  destination.hash = window.location.hash;
  window.location.replace(destination.href);
})();

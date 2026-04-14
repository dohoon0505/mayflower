/* ============================================================
   ROUTER.JS — Hash-based routing
   ============================================================ */

const Router = {
  _routes: {},
  _defaultRoute: null,

  register(hash, handler) {
    Router._routes[hash] = handler;
  },

  default(hash) {
    Router._defaultRoute = hash;
  },

  navigate(hash) {
    if (window.location.hash === '#' + hash) {
      Router._dispatch(hash); /* force re-render even if same hash */
    } else {
      window.location.hash = hash;
    }
  },

  init() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      Router._dispatch(hash);
    });
    /* Initial dispatch */
    const initial = window.location.hash.slice(1);
    Router._dispatch(initial || Router._defaultRoute || '');
  },

  _dispatch(hash) {
    const handler = Router._routes[hash] || Router._routes[Router._defaultRoute] || null;
    if (handler) handler(hash);
    /* Sync active nav highlight */
    document.querySelectorAll('.nav-item[data-route]').forEach(el => {
      el.classList.toggle('active', el.dataset.route === hash);
    });
  },
};

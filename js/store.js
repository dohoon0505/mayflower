/* ============================================================
   STORE.JS — RTDB projection (v4)
   - Firebase RTDB `/users`, `/orders`, `/products`, `/categories`, `/drivers`
     를 한 번씩 subscribe 하여 메모리에 캐시.
   - 모든 조회는 동기 API 로 캐시에서 반환 (기존 view 코드 호환 목적).
   - 변경 전파: Store.onUpdate('orders'|'products'|...).
   - 쓰기는 api.js 가 담당 (Store 자체는 read-only projection).
   ============================================================ */

(() => {
  const cache = {
    users: [],
    orders: [],
    products: [],
    drivers: [],
    categories: [],   // [{ id, name, order }] 정렬됨
    ledger: [],       // [{ id, client, product, location, quantity, createdAt, ... }] createdAt 내림차순
    ready: {
      users: false, orders: false, products: false, drivers: false, categories: false, ledger: false,
    },
  };

  const listeners = {};

  const _snapToArray = (snap) => {
    const v = snap.val() || {};
    if (Array.isArray(v)) {
      return v.map((item, i) => item ? ({ id: String(i), ...item }) : null).filter(Boolean);
    }
    return Object.entries(v).map(([id, item]) => ({ id, ...(item || {}) }));
  };

  const _emit = (key) => {
    (listeners[key] || []).forEach(fn => { try { fn(); } catch (e) { console.error('[Store.listener]', e); } });
  };

  function _subscribe(path, cacheKey, transform) {
    if (!window.FirebaseDB) {
      console.warn(`[Store] FirebaseDB 없음 — /${path} 구독 건너뜀`);
      return;
    }
    window.FirebaseDB.ref(path).on('value', (snap) => {
      const list = _snapToArray(snap);
      cache[cacheKey] = transform ? transform(list) : list;
      cache.ready[cacheKey] = true;
      _emit(cacheKey);
    }, (err) => {
      console.warn(`[Store] /${path} 구독 에러:`, err?.message);
      cache.ready[cacheKey] = true;  // permission denied 도 ready 로 간주 (로그인 전엔 빈 캐시)
      _emit(cacheKey);
    });
  }

  /* Auth 세션이 확보되면 호출 — 보호된 경로 구독 시작 */
  function _start() {
    _subscribe('users',      'users');
    _subscribe('orders',     'orders');
    _subscribe('products',   'products');
    _subscribe('drivers',    'drivers');
    _subscribe('categories', 'categories', (list) => {
      /* order 오름차순 정렬 */
      return [...list].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    });
    _subscribe('orderLedger', 'ledger', (list) => {
      /* createdAt 내림차순 (최신이 위) */
      return [...list].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    });
  }

  /* 모든 컬렉션이 첫 데이터(또는 빈값)를 수신할 때까지 대기 */
  function _readyAll(timeoutMs = 4000) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const check = () => {
        const r = cache.ready;
        if (r.users && r.orders && r.products && r.drivers && r.categories && r.ledger) return resolve(true);
        if (Date.now() - t0 > timeoutMs) return resolve(false);
        setTimeout(check, 80);
      };
      check();
    });
  }

  const Store = {
    _cache: cache,

    /* ── 구독 생명주기 ──────────────────────────────────────── */
    startSubscriptions: _start,
    whenReady: _readyAll,
    onUpdate(key, fn) {
      if (!listeners[key]) listeners[key] = [];
      listeners[key].push(fn);
      return () => { listeners[key] = (listeners[key] || []).filter(x => x !== fn); };
    },

    /* ── Users ────────────────────────────────────────────── */
    getUsers: () => cache.users.slice(),
    getUserById: (id) => cache.users.find(u => u.id === id) || null,
    getUserByUsername: (u) => cache.users.find(x => x.username === String(u || '').trim().toLowerCase() && x.isActive !== false) || null,
    getUsersByRole: (role) => cache.users.filter(u => u.role === role && u.isActive !== false),
    getPendingUsers: () => cache.users.filter(u => !u.isApproved),

    /* ── Categories ──────────────────────────────────────── */
    /* 호환: 기존 코드가 Store.getCategories() → string[] 기대.
       새 스키마 {name, order} 이므로 name 만 뽑아 반환. */
    getCategories() {
      const list = cache.categories;
      if (!list.length) return [];
      return list.map(c => c.name).filter(Boolean);
    },
    /* 원본 객체 배열도 노출 (admin 관리용) */
    getCategoriesRaw: () => cache.categories.slice(),
    getCategoryByName: (name) => cache.categories.find(c => c.name === name) || null,
    getCategoryById:   (id)   => cache.categories.find(c => c.id   === id)   || null,

    /* ── Products ────────────────────────────────────────── */
    getProducts: (activeOnly = true) => {
      return activeOnly ? cache.products.filter(p => p.isActive !== false) : cache.products.slice();
    },
    getProductById: (id) => cache.products.find(p => p.id === id) || null,

    /* ── Drivers ─────────────────────────────────────────── */
    getDrivers: (activeOnly = true) => {
      return activeOnly ? cache.drivers.filter(d => d.isActive !== false) : cache.drivers.slice();
    },
    getDriverById: (id) => cache.drivers.find(d => d.id === id) || null,
    getDriverByLinkedUserId: (uid) => cache.drivers.find(d => d.linkedUserId === uid) || null,

    /* ── Ledger (수주 장부) ──────────────────────────────── */
    getLedger: () => cache.ledger.slice(),
    getLedgerById: (id) => cache.ledger.find(e => e.id === id) || null,

    /* ── Orders ──────────────────────────────────────────── */
    getOrders(filters = {}) {
      let list = cache.orders.slice();
      if (filters.createdByUserId != null) list = list.filter(o => o.createdByUserId === filters.createdByUserId);
      if (filters.driverId != null)        list = list.filter(o => o.assignedDriverId === filters.driverId);
      if (filters.status != null && filters.status !== '') list = list.filter(o => o.status === +filters.status);
      if (filters.dateFrom) list = list.filter(o => o.deliveryDatetime >= filters.dateFrom);
      if (filters.dateTo)   list = list.filter(o => o.deliveryDatetime <= filters.dateTo);
      return list;
    },
    getOrderById: (id) => cache.orders.find(o => o.id === id) || null,
  };

  /* 전역 노출 */
  window.Store = Store;
  /* Backward-compat: Store.CATEGORIES → string[] */
  Object.defineProperty(Store, 'CATEGORIES', {
    get() { return Store.getCategories(); },
  });
})();

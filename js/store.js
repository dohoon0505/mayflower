/* ============================================================
   STORE.JS — localStorage CRUD + Seed Data  (v3)
   ============================================================ */

const KEYS = {
  users:      'maydaegu.users',
  products:   'maydaegu.products',
  drivers:    'maydaegu.drivers',
  orders:     'maydaegu.orders',
  chat:       'maydaegu.chat',
  categories: 'maydaegu.categories',
  seeded:     'maydaegu.seeded.v8',   /* bump version to re-seed */
};

/* Default product categories (used only on first seed) */
const DEFAULT_CATEGORIES = ['화환', '꽃바구니', '화분', '생화', '조화', '기타'];

function _get(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function _set(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function _nextId(items) {
  return items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
}
function _addHours(date, h) {
  const d = new Date(date); d.setHours(d.getHours() + h); return d.toISOString();
}
function _roundTo10Min(iso) {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  d.setMinutes(Math.round(m / 10) * 10);
  return d.toISOString();
}

/* ── Seed ─────────────────────────────────────────────────── */
function _seed() {
  if (localStorage.getItem(KEYS.seeded)) return;
  const now = new Date();

  _set(KEYS.users, [
    { id:  1, username: 'floor2',   passwordHash: '1234', displayName: '2층 담당자', role: 'floor2', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id:  2, username: 'floor1',   passwordHash: '1234', displayName: '1층 담당자', role: 'floor1', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id:  3, username: 'admin',    passwordHash: '1234', displayName: '관리자',     role: 'admin',  isActive: true, createdAt: '2025-01-01T00:00:00' },
    /* 기사 계정 (driver1~driver12) */
    { id:  4, username: 'driver1',  passwordHash: '1234', displayName: '이민준', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id:  5, username: 'driver2',  passwordHash: '1234', displayName: '박서연', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id:  6, username: 'driver3',  passwordHash: '1234', displayName: '정지훈', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id:  7, username: 'driver4',  passwordHash: '1234', displayName: '김도윤', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id:  8, username: 'driver5',  passwordHash: '1234', displayName: '최하준', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id:  9, username: 'driver6',  passwordHash: '1234', displayName: '한시우', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 10, username: 'driver7',  passwordHash: '1234', displayName: '윤주원', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 11, username: 'driver8',  passwordHash: '1234', displayName: '송지후', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 12, username: 'driver9',  passwordHash: '1234', displayName: '임건우', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 13, username: 'driver10', passwordHash: '1234', displayName: '강선우', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 14, username: 'driver11', passwordHash: '1234', displayName: '조예준', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 15, username: 'driver12', passwordHash: '1234', displayName: '배민재', role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
  ]);

  _set(KEYS.categories, DEFAULT_CATEGORIES.slice());

  _set(KEYS.products, [
    { id: 1, name: '개업 화환', category: '화환',   isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 2, name: '졸업 화환', category: '화환',   isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 3, name: '축하 화환', category: '화환',   isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 4, name: '근조 화환', category: '화환',   isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 5, name: '꽃바구니',  category: '꽃바구니', isActive: true, createdAt: '2025-01-01T00:00:00' },
  ]);

  /* ── 기사 12명 — 뱃지별 (배송중 4명, 나머지 2명씩) ──────────── */
  _set(KEYS.drivers, [
    /* 배송중 (4명) — delivering + completed 수와 진행률이 각각 다름 */
    { id:  1, name: '이민준', phone: '010-1111-2222', isActive: true, createdAt: '2025-01-01T00:00:00' }, // 2배송+2완료 = 50%
    { id:  2, name: '박서연', phone: '010-3333-4444', isActive: true, createdAt: '2025-01-01T00:00:00' }, // 1배송+3완료 = 75%
    { id:  3, name: '정지훈', phone: '010-5555-6666', isActive: true, createdAt: '2025-01-01T00:00:00' }, // 3배송+1완료 = 25%
    { id:  4, name: '김도윤', phone: '010-7777-8888', isActive: true, createdAt: '2025-01-01T00:00:00' }, // 1배송+4완료 = 80%
    /* 배차완료 (2명) */
    { id:  5, name: '최하준', phone: '010-2222-3333', isActive: true, createdAt: '2025-01-01T00:00:00' }, // assigned 2건
    { id:  6, name: '한시우', phone: '010-4444-5555', isActive: true, createdAt: '2025-01-01T00:00:00' }, // assigned 1건
    /* 복귀중 (2명) */
    { id:  7, name: '윤주원', phone: '010-6666-7777', isActive: true, createdAt: '2025-01-01T00:00:00' }, // completed 3건
    { id:  8, name: '송지후', phone: '010-8888-9999', isActive: true, createdAt: '2025-01-01T00:00:00' }, // completed 2건
    /* 배송대기 (2명) */
    { id:  9, name: '임건우', phone: '010-1234-5678', isActive: true, createdAt: '2025-01-01T00:00:00' }, // 주문 없음
    { id: 10, name: '강선우', phone: '010-9876-5432', isActive: true, createdAt: '2025-01-01T00:00:00' }, // 주문 없음
    /* 휴무 (2명) — localStorage offduty=1 */
    { id: 11, name: '조예준', phone: '010-1357-2468', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 12, name: '배민재', phone: '010-2468-1357', isActive: true, createdAt: '2025-01-01T00:00:00' },
  ]);

  /* 휴무 기사 localStorage 플래그 */
  localStorage.setItem('maydaegu.driver.offduty.11', '1');
  localStorage.setItem('maydaegu.driver.offduty.12', '1');

  /* ── 주문 시드 (명시적 — 진행률 의도대로) ────────────────────── */
  const O = (id, chainName, productId, productName, deliveryHour, deliveryAddress,
             recipientName, ribbonText, status, driverId, driverName, updatedHoursAgo) => ({
    id, chainName, productId, productName,
    deliveryDatetime: _addHours(now, deliveryHour),
    isImmediate: false, deliveryAddress,
    recipientName, recipientPhone: '010-1234-5678', ribbonText, occasionText: '',
    storePhotoUrl: null, status,
    assignedDriverId: driverId, assignedDriverName: driverName,
    assignedAt: driverId ? _addHours(now, -4) : null,
    deliveryPhotoUrl: null, createdByUserId: 1, createdByName: '2층 담당자',
    createdAt: _addHours(now, -6), updatedAt: _addHours(now, -updatedHoursAgo),
  });

  _set(KEYS.orders, [
    /* ── 이민준 (배송중 2건, 완료 2건 → 50%) ── */
    O( 1,'행복꽃집',1,'개업 화환', 2,'대구시 중구 동성로 123',   '김철수','개업을 축하합니다',   3, 1,'이민준',1),
    O( 2,'봄꽃집',  3,'축하 화환', 3,'대구시 수성구 범어동 456',  '이영희','취임을 축하드립니다', 3, 1,'이민준',1),
    O( 3,'사랑꽃집',2,'졸업 화환',-2,'대구시 달서구 상인동 789',  '박민수','졸업을 축하합니다',   4, 1,'이민준',3),
    O( 4,'꽃향기',  1,'개업 화환',-4,'대구시 북구 칠성동 321',   '최지원','번창하세요',          4, 1,'이민준',5),

    /* ── 박서연 (배송중 1건, 완료 3건 → 75%) ── */
    O( 5,'미소꽃집',3,'축하 화환', 1,'대구시 동구 신천동 654',   '정승현','수고하셨습니다',      3, 2,'박서연',1),
    O( 6,'꽃나라',  2,'졸업 화환',-1,'대구시 서구 내당동 987',   '홍길동','항상 응원합니다',     4, 2,'박서연',2),
    O( 7,'새봄꽃집',4,'근조 화환',-3,'대구시 남구 대명동 111',   '김민정','삼가 고인의 명복을 빕니다',4,2,'박서연',4),
    O( 8,'꽃길',    1,'개업 화환',-5,'대구시 중구 서문로 222',   '이상호','좋은 시작 되세요',    4, 2,'박서연',6),

    /* ── 정지훈 (배송중 3건, 완료 1건 → 25%) ── */
    O( 9,'꽃피다',  3,'축하 화환', 2,'대구시 수성구 지산동 333', '박지연','축하드립니다',        3, 3,'정지훈',1),
    O(10,'꽃마을',  5,'꽃바구니',  3,'대구시 달서구 진천동 444', '최건우','늘 건강하세요',        3, 3,'정지훈',1),
    O(11,'행복꽃집',1,'개업 화환', 4,'대구시 북구 대현동 555',   '강수진','개업을 축하합니다',   3, 3,'정지훈',1),
    O(12,'봄꽃집',  2,'졸업 화환',-2,'대구시 동구 효목동 666',   '윤도영','고생 많으셨습니다',   4, 3,'정지훈',4),

    /* ── 김도윤 (배송중 1건, 완료 4건 → 80%) ── */
    O(13,'사랑꽃집',3,'축하 화환', 1,'대구시 수성구 황금동 77',  '한지수','항상 응원합니다',     3, 4,'김도윤',1),
    O(14,'꽃향기',  1,'개업 화환',-1,'대구시 중구 남산동 22',    '오준혁','번창하세요',          4, 4,'김도윤',2),
    O(15,'미소꽃집',2,'졸업 화환',-3,'대구시 달서구 용산동 11',  '서예은','졸업을 축하합니다',   4, 4,'김도윤',4),
    O(16,'꽃나라',  5,'꽃바구니', -4,'대구시 북구 구암동 88',    '임지호','감사합니다',          4, 4,'김도윤',5),
    O(17,'새봄꽃집',4,'근조 화환',-6,'대구시 동구 율하동 55',    '조수빈','삼가 고인의 명복을 빕니다',4,4,'김도윤',7),

    /* ── 최하준 (배차완료: assigned 2건) ── */
    O(18,'꽃길',    1,'개업 화환', 3,'대구시 서구 비산동 44',    '윤재원','개업을 축하합니다',   1, 5,'최하준',2),
    O(19,'꽃피다',  2,'졸업 화환', 5,'대구시 남구 봉덕동 99',    '강다인','졸업을 축하합니다',   2, 5,'최하준',2),

    /* ── 한시우 (배차완료: assigned 1건) ── */
    O(20,'꽃마을',  3,'축하 화환', 4,'대구시 수성구 만촌동 33',  '박은서','취임을 축하드립니다', 1, 6,'한시우',3),

    /* ── 윤주원 (복귀중: completed 3건) ── */
    O(21,'행복꽃집',1,'개업 화환',-2,'대구시 중구 삼덕동 16',    '최민준','개업을 축하합니다',   4, 7,'윤주원',1),
    O(22,'봄꽃집',  5,'꽃바구니', -3,'대구시 달서구 죽전동 7',   '이채원','감사합니다',          4, 7,'윤주원',2),
    O(23,'사랑꽃집',2,'졸업 화환',-5,'대구시 북구 침산동 82',    '김서준','졸업을 축하합니다',   4, 7,'윤주원',4),

    /* ── 송지후 (복귀중: completed 2건) ── */
    O(24,'꽃향기',  3,'축하 화환',-1,'대구시 동구 신암동 64',    '박하윤','축하드립니다',        4, 8,'송지후',2),
    O(25,'미소꽃집',4,'근조 화환',-4,'대구시 서구 중리동 30',    '오지민','삼가 고인의 명복을 빕니다',4,8,'송지후',5),

    /* ── 임건우, 강선우 (배송대기): 주문 없음 ── */

    /* ── 조예준, 배민재 (휴무): 주문 없음 ── */

    /* ── 미배차 대기 주문 (floor1 테스트용) ── */
    O(26,'꽃나라',  1,'개업 화환', 2,'대구시 수성구 파동 15',    '장민호','개업을 축하합니다',   0, null,null,1),
    O(27,'새봄꽃집',2,'졸업 화환', 4,'대구시 달서구 감삼동 27',  '류하은','졸업을 축하합니다',   0, null,null,2),
    O(28,'꽃길',    3,'축하 화환', 6,'대구시 북구 복현동 50',    '정우성','취임을 축하드립니다', 1, null,null,3),

    /* ── 취소 주문 ── */
    O(29,'꽃피다',  1,'개업 화환', 8,'대구시 중구 공평동 4',     '윤소희','개업을 축하합니다',   5, null,null,6),
    O(30,'꽃마을',  5,'꽃바구니', -6,'대구시 동구 방촌동 91',    '김태양','감사합니다',          6, null,null,8),
  ]);

  _set(KEYS.chat, []);
  localStorage.setItem(KEYS.seeded, '1');
}

/* ── Store API ────────────────────────────────────────────── */
const Store = {
  /* Users */
  getUsers: () => _get(KEYS.users),
  getUserByUsername: (u) => _get(KEYS.users).find(x => x.username === u && x.isActive),
  getUserById: (id) => _get(KEYS.users).find(x => x.id === id),
  createUser(data) {
    const users = _get(KEYS.users);
    const user = { id: _nextId(users), ...data, isActive: true, createdAt: new Date().toISOString() };
    _set(KEYS.users, [...users, user]);
    return user;
  },
  updateUser(id, data) {
    const users = _get(KEYS.users);
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) return false;
    users[idx] = { ...users[idx], ...data };
    _set(KEYS.users, users);
    return true;
  },
  getUsersByRole: (role) => _get(KEYS.users).filter(u => u.role === role && u.isActive),

  /* Categories */
  getCategories() {
    const list = _get(KEYS.categories);
    return list.length ? list : DEFAULT_CATEGORIES.slice();
  },
  createCategory(name) {
    const n = String(name || '').trim();
    if (!n) return false;
    const list = Store.getCategories();
    if (list.includes(n)) return false;      /* 중복 방지 */
    list.push(n);
    _set(KEYS.categories, list);
    return true;
  },
  renameCategory(oldName, newName) {
    const n = String(newName || '').trim();
    if (!n || oldName === n) return false;
    const list = Store.getCategories();
    const idx = list.indexOf(oldName);
    if (idx < 0) return false;
    if (list.includes(n)) return false;      /* 이미 존재 */
    list[idx] = n;
    _set(KEYS.categories, list);
    /* 해당 카테고리를 사용하는 상품도 일괄 갱신 */
    const products = _get(KEYS.products);
    let changed = false;
    products.forEach(p => {
      if (p.category === oldName) { p.category = n; changed = true; }
    });
    if (changed) _set(KEYS.products, products);
    return true;
  },
  deleteCategory(name) {
    const list = Store.getCategories();
    const idx = list.indexOf(name);
    if (idx < 0) return { ok: false, reason: 'not_found' };
    /* 사용 중인 상품이 있으면 차단 */
    const products = _get(KEYS.products);
    const inUse = products.filter(p => p.isActive && p.category === name).length;
    if (inUse > 0) return { ok: false, reason: 'in_use', count: inUse };
    list.splice(idx, 1);
    _set(KEYS.categories, list);
    return { ok: true };
  },

  /* Products */
  getProducts: (activeOnly = true) => {
    const all = _get(KEYS.products);
    return activeOnly ? all.filter(p => p.isActive) : all;
  },
  getProductById: (id) => _get(KEYS.products).find(p => p.id === id),
  createProduct(data) {
    const list = _get(KEYS.products);
    const item = {
      id: _nextId(list),
      name: data.name,
      category: data.category || '기타',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    _set(KEYS.products, [...list, item]);
    return item;
  },
  updateProduct(id, data) {
    const list = _get(KEYS.products);
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0) return false;
    list[idx] = { ...list[idx], ...data };
    _set(KEYS.products, list); return true;
  },
  deleteProduct(id) {
    const list = _get(KEYS.products);
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0) return false;
    list[idx].isActive = false;
    _set(KEYS.products, list); return true;
  },

  /* Drivers */
  getDrivers: (activeOnly = true) => {
    const all = _get(KEYS.drivers);
    return activeOnly ? all.filter(d => d.isActive) : all;
  },
  getDriverById: (id) => _get(KEYS.drivers).find(d => d.id === id),
  createDriver(data) {
    const list = _get(KEYS.drivers);
    const item = { id: _nextId(list), name: data.name, phone: data.phone || '', isActive: true, createdAt: new Date().toISOString() };
    _set(KEYS.drivers, [...list, item]);
    return item;
  },
  updateDriver(id, data) {
    const list = _get(KEYS.drivers);
    const idx = list.findIndex(d => d.id === id);
    if (idx < 0) return false;
    list[idx] = { ...list[idx], ...data };
    _set(KEYS.drivers, list); return true;
  },
  deleteDriver(id) {
    const list = _get(KEYS.drivers);
    const idx = list.findIndex(d => d.id === id);
    if (idx < 0) return false;
    list[idx].isActive = false;
    _set(KEYS.drivers, list); return true;
  },

  /* Orders */
  getOrders(filters = {}) {
    let list = _get(KEYS.orders);
    if (filters.createdByUserId != null) list = list.filter(o => o.createdByUserId === filters.createdByUserId);
    if (filters.driverId != null)        list = list.filter(o => o.assignedDriverId === filters.driverId);
    if (filters.status != null && filters.status !== '') list = list.filter(o => o.status === +filters.status);
    if (filters.dateFrom) list = list.filter(o => o.deliveryDatetime >= filters.dateFrom);
    if (filters.dateTo)   list = list.filter(o => o.deliveryDatetime <= filters.dateTo);
    return list;
  },
  getOrderById: (id) => _get(KEYS.orders).find(o => o.id === id),
  createOrder(data, session) {
    const list = _get(KEYS.orders);
    const product = Store.getProductById(data.productId);
    const order = {
      id: _nextId(list),
      chainName:        data.chainName,
      productId:        +data.productId,
      productName:      product ? product.name : '',
      deliveryDatetime: data.deliveryDatetime,
      isImmediate:      data.isImmediate || false,
      deliveryAddress:  data.deliveryAddress,
      recipientName:    data.recipientName,
      recipientPhone:   data.recipientPhone || '',
      ribbonText:       data.ribbonText || '',
      occasionText:     data.occasionText || '',
      status:           0,
      assignedDriverId: null, assignedDriverName: null, assignedAt: null,
      storePhotoUrl:    null,
      deliveryPhotoUrl: null,
      createdByUserId:  session.userId,
      createdByName:    session.displayName,
      createdAt:        new Date().toISOString(),
      updatedAt:        new Date().toISOString(),
    };
    _set(KEYS.orders, [...list, order]);
    return order;
  },
  updateOrder(id, data) {
    const list = _get(KEYS.orders);
    const idx = list.findIndex(o => o.id === id);
    if (idx < 0) return false;
    const cur = list[idx];
    const updates = { updatedAt: new Date().toISOString() };

    if (data.chainName        != null) updates.chainName        = data.chainName;
    if (data.deliveryDatetime != null) updates.deliveryDatetime = data.deliveryDatetime;
    if (data.deliveryAddress  != null) updates.deliveryAddress  = data.deliveryAddress;
    if (data.recipientName    != null) updates.recipientName    = data.recipientName;
    if (data.recipientPhone   != null) updates.recipientPhone   = data.recipientPhone;
    if (data.ribbonText       != null) updates.ribbonText       = data.ribbonText;
    if (data.occasionText     != null) updates.occasionText     = data.occasionText;
    if (data.isImmediate      != null) updates.isImmediate      = data.isImmediate;
    if (data.storePhotoUrl    !== undefined) updates.storePhotoUrl    = data.storePhotoUrl;
    if (data.deliveryPhotoUrl !== undefined) updates.deliveryPhotoUrl = data.deliveryPhotoUrl;

    if (data.productId != null) {
      updates.productId = +data.productId;
      const product = Store.getProductById(+data.productId);
      updates.productName = product ? product.name : cur.productName;
    }
    if ('assignedDriverId' in data) {
      if (!data.assignedDriverId || data.assignedDriverId === '0') {
        updates.assignedDriverId   = null;
        updates.assignedDriverName = null;
        updates.assignedAt         = null;
      } else {
        updates.assignedDriverId   = +data.assignedDriverId;
        const driver = Store.getDriverById(+data.assignedDriverId);
        updates.assignedDriverName = driver ? driver.name : cur.assignedDriverName;
        /* Only update assignedAt if driver actually changed */
        if (+data.assignedDriverId !== cur.assignedDriverId) {
          updates.assignedAt = new Date().toISOString();
        }
      }
    }

    list[idx] = { ...cur, ...updates };
    _set(KEYS.orders, list);
    return true;
  },
  updateOrderStatus(id, status) {
    const list = _get(KEYS.orders);
    const idx = list.findIndex(o => o.id === id);
    if (idx < 0) return false;
    list[idx].status = status; list[idx].updatedAt = new Date().toISOString();
    _set(KEYS.orders, list); return true;
  },
  assignDriver(id, driverId) {
    const list = _get(KEYS.orders);
    const idx = list.findIndex(o => o.id === id);
    if (idx < 0) return false;
    const driver = Store.getDriverById(driverId);
    const now = new Date().toISOString();
    list[idx].assignedDriverId = driverId;
    list[idx].assignedDriverName = driver ? driver.name : '';
    list[idx].assignedAt = now;
    list[idx].updatedAt = now;
    _set(KEYS.orders, list); return true;
  },
  completeOrder(id, photoUrl) {
    const list = _get(KEYS.orders);
    const idx = list.findIndex(o => o.id === id);
    if (idx < 0) return false;
    list[idx].status = 4; list[idx].deliveryPhotoUrl = photoUrl;
    list[idx].updatedAt = new Date().toISOString();
    _set(KEYS.orders, list); return true;
  },

  /* Chat */
  getChat: () => _get(KEYS.chat),
  addChat(msg) {
    const list = _get(KEYS.chat);
    list.push(msg);
    _set(KEYS.chat, list);
  },
  checkChatMsg(msgId, user) {
    const list = _get(KEYS.chat);
    const idx = list.findIndex(m => m.id === msgId);
    if (idx < 0) return false;
    if (!list[idx].checkedBy) list[idx].checkedBy = [];
    if (list[idx].checkedBy.find(c => c.userId === user.userId)) return false; /* already checked */
    list[idx].checkedBy.push({ userId: user.userId, name: user.displayName, role: user.role, ts: new Date().toISOString() });
    _set(KEYS.chat, list);
    return true;
  },
};

/* Backward-compat: Store.CATEGORIES → 동적 getter로 대체 */
Object.defineProperty(Store, 'CATEGORIES', {
  get() { return Store.getCategories(); },
});

_seed();

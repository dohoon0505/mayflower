/* ============================================================
   STORE.JS — localStorage CRUD + Seed Data  (v3)
   ============================================================ */

const KEYS = {
  users:    'maydaegu.users',
  products: 'maydaegu.products',
  drivers:  'maydaegu.drivers',
  orders:   'maydaegu.orders',
  chat:     'maydaegu.chat',
  seeded:   'maydaegu.seeded.v5',   /* bump version to re-seed */
};

/* Predefined product categories */
const CATEGORIES = ['화환', '꽃바구니', '화분', '생화', '조화', '기타'];

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
    { id: 1, username: 'floor2', passwordHash: '1234', displayName: '2층 담당자', role: 'floor2', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 2, username: 'floor1', passwordHash: '1234', displayName: '1층 담당자', role: 'floor1', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 3, username: 'driver', passwordHash: '1234', displayName: '이민준',     role: 'driver', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 4, username: 'admin',  passwordHash: '1234', displayName: '관리자',     role: 'admin',  isActive: true, createdAt: '2025-01-01T00:00:00' },
  ]);

  _set(KEYS.products, [
    { id: 1, name: '개업 화환', category: '화환',   isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 2, name: '졸업 화환', category: '화환',   isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 3, name: '축하 화환', category: '화환',   isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 4, name: '근조 화환', category: '화환',   isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 5, name: '꽃바구니',  category: '꽃바구니', isActive: true, createdAt: '2025-01-01T00:00:00' },
  ]);

  /* ── 28명의 기사 — 각 뱃지 상태별 7명씩 예시 데이터 ───────────── */
  const driverNames = [
    /* delivering (배송중) 1-7 */
    '이민준','박서연','정지훈','김도윤','최하준','한시우','윤주원',
    /* assigned (배차완료) 8-14 */
    '송지후','임건우','강선우','조예준','배민재','신우진','홍지안',
    /* returning (복귀중) 15-21 */
    '류태윤','오서진','권예성','남현우','문지환','서준영','황도현',
    /* waiting/off (배송대기/휴무) 22-28 */
    '표은찬','구지훈','노시온','고라온','백하람','석해찬','전  율',
  ];
  const drivers = driverNames.map((name, i) => ({
    id: i + 1,
    name: name.trim(),
    phone: `010-${String(1111 * ((i % 9) + 1)).padStart(4,'0')}-${String(2222 * ((i % 9) + 1)).padStart(4,'0')}`,
    isActive: true,
    createdAt: '2025-01-01T00:00:00',
  }));
  _set(KEYS.drivers, drivers);

  /* 기사 22-24: 배송대기(출근), 25-28: 휴무 로컬스토리지 플래그 */
  for (let i = 25; i <= 28; i++) {
    localStorage.setItem(`maydaegu.driver.offduty.${i}`, '1');
  }

  /* ── 주문 시드 — 기사 상태별로 생성 ───────────────────────── */
  const chains     = ['행복꽃집','봄꽃집','사랑꽃집','꽃향기','미소꽃집','꽃나라','새봄꽃집','꽃길','꽃피다','꽃마을'];
  const recipients = ['김철수','이영희','박민수','최지원','정승현','홍길동','김민정','이상호','박지연','최건우','강수진','윤도영'];
  const ribbons    = ['개업을 축하합니다','졸업을 축하합니다','취임을 축하드립니다','번창하세요','수고하셨습니다','항상 응원합니다','좋은 시작 되세요','축하드립니다','늘 건강하세요','감사합니다'];
  const addresses  = [
    '대구시 중구 동성로 123','대구시 수성구 범어동 456','대구시 달서구 상인동 789',
    '대구시 북구 칠성동 321','대구시 동구 신천동 654','대구시 서구 내당동 987',
    '대구시 남구 대명동 111','대구시 중구 서문로 222','대구시 수성구 지산동 333',
    '대구시 달서구 진천동 444','대구시 북구 대현동 555','대구시 동구 효목동 666',
  ];
  const productsList = [
    { id:1, name:'개업 화환' },
    { id:2, name:'졸업 화환' },
    { id:3, name:'축하 화환' },
    { id:4, name:'근조 화환' },
    { id:5, name:'꽃바구니' },
  ];

  const orders = [];
  let oid = 1;
  const mkOrder = (driver, status, deliveryHour, updatedHoursAgo) => {
    const p = productsList[oid % productsList.length];
    const o = {
      id: oid++,
      chainName:        chains[oid % chains.length],
      productId:        p.id,
      productName:      p.name,
      deliveryDatetime: _addHours(now, deliveryHour),
      isImmediate:      false,
      deliveryAddress:  addresses[oid % addresses.length],
      recipientName:    recipients[oid % recipients.length],
      recipientPhone:   '010-1234-5678',
      ribbonText:       ribbons[oid % ribbons.length],
      occasionText:     '',
      storePhotoUrl:    null,
      status,
      assignedDriverId:   driver ? driver.id   : null,
      assignedDriverName: driver ? driver.name : null,
      assignedAt:         driver ? _addHours(now, -4) : null,
      deliveryPhotoUrl:   null,
      createdByUserId:    1,
      createdByName:      '2층 담당자',
      createdAt:          _addHours(now, -6),
      updatedAt:          _addHours(now, -updatedHoursAgo),
    };
    return o;
  };

  /* 배송중 (drivers 1-7): delivering 1건 + completed 1건씩 (진행률 50%) */
  drivers.slice(0, 7).forEach((d, i) => {
    orders.push(mkOrder(d, 3,  2 + (i % 3), 1));
    orders.push(mkOrder(d, 4, -2 - (i % 3), 2));
  });

  /* 배차완료 (drivers 8-14): assigned(1 or 2) 1건씩 */
  drivers.slice(7, 14).forEach((d, i) => {
    orders.push(mkOrder(d, (i % 2) + 1, 3 + (i % 4), 2));
  });

  /* 복귀중 (drivers 15-21): completed 2건씩 (delivering/assigned 없음) */
  drivers.slice(14, 21).forEach((d, i) => {
    orders.push(mkOrder(d, 4, -3 - (i % 3), 1));
    orders.push(mkOrder(d, 4, -5 - (i % 3), 3));
  });

  /* 배송대기 (drivers 22-24): 주문 없음 — 출근 상태 */
  /* 휴무 (drivers 25-28): 주문 없음 + localStorage offduty=1 */

  /* 미배차 대기 주문 몇 건 (floor1/admin 테스트용) */
  orders.push(mkOrder(null, 0, 2, 1));
  orders.push(mkOrder(null, 0, 4, 2));
  orders.push(mkOrder(null, 1, 5, 2));
  /* 취소 주문 */
  orders.push(mkOrder(drivers[0], 5, 6, 6));
  orders.push(mkOrder(drivers[2], 6, -6, 7));

  _set(KEYS.orders, orders);

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

/* CATEGORIES exported for use in admin view */
Store.CATEGORIES = CATEGORIES;

_seed();

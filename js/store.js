/* ============================================================
   STORE.JS — localStorage CRUD + Seed Data  (v3)
   ============================================================ */

const KEYS = {
  users:    'maydaegu.users',
  products: 'maydaegu.products',
  drivers:  'maydaegu.drivers',
  orders:   'maydaegu.orders',
  chat:     'maydaegu.chat',
  seeded:   'maydaegu.seeded.v4',   /* bump version to re-seed */
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

  _set(KEYS.drivers, [
    { id: 1, name: '이민준', phone: '010-1111-2222', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 2, name: '박서연', phone: '010-3333-4444', isActive: true, createdAt: '2025-01-01T00:00:00' },
    { id: 3, name: '정지훈', phone: '010-5555-6666', isActive: true, createdAt: '2025-01-01T00:00:00' },
  ]);

  _set(KEYS.orders, [
    { id:1,  chainName:'행복꽃집', productId:1, productName:'개업 화환', deliveryDatetime:_addHours(now,2),   isImmediate:false, deliveryAddress:'대구시 중구 동성로 123',    recipientName:'김철수', recipientPhone:'010-1234-5678', ribbonText:'개업을 축하합니다',       occasionText:'', storePhotoUrl:null, status:0, assignedDriverId:null, assignedDriverName:null, assignedAt:null, deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-1),  updatedAt:_addHours(now,-1) },
    { id:2,  chainName:'봄꽃집',   productId:2, productName:'졸업 화환', deliveryDatetime:_addHours(now,3),   isImmediate:false, deliveryAddress:'대구시 수성구 범어동 456',   recipientName:'이영희', recipientPhone:'010-2345-6789', ribbonText:'졸업을 축하합니다',       occasionText:'', storePhotoUrl:null, status:0, assignedDriverId:null, assignedDriverName:null, assignedAt:null, deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-2),  updatedAt:_addHours(now,-2) },
    { id:3,  chainName:'사랑꽃집', productId:3, productName:'축하 화환', deliveryDatetime:_addHours(now,4),   isImmediate:false, deliveryAddress:'대구시 달서구 상인동 789',   recipientName:'박민수', recipientPhone:'010-3456-7890', ribbonText:'취임을 축하드립니다',     occasionText:'', storePhotoUrl:null, status:1, assignedDriverId:null, assignedDriverName:null, assignedAt:null, deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-3),  updatedAt:_addHours(now,-1) },
    { id:4,  chainName:'꽃향기',   productId:1, productName:'개업 화환', deliveryDatetime:_addHours(now,5),   isImmediate:false, deliveryAddress:'대구시 북구 칠성동 321',    recipientName:'최지원', recipientPhone:'010-4567-8901', ribbonText:'번창하세요',              occasionText:'', storePhotoUrl:null, status:2, assignedDriverId:null, assignedDriverName:null, assignedAt:null, deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-4),  updatedAt:_addHours(now,-2) },
    { id:5,  chainName:'미소꽃집', productId:2, productName:'졸업 화환', deliveryDatetime:_addHours(now,1),   isImmediate:true,  deliveryAddress:'대구시 동구 신천동 654',    recipientName:'정승현', recipientPhone:'010-5678-9012', ribbonText:'수고하셨습니다',          occasionText:'', storePhotoUrl:null, status:3, assignedDriverId:1,    assignedDriverName:'이민준', assignedAt:_addHours(now,-1),  deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-5),  updatedAt:_addHours(now,-1) },
    { id:6,  chainName:'꽃나라',   productId:3, productName:'축하 화환', deliveryDatetime:_addHours(now,2),   isImmediate:false, deliveryAddress:'대구시 서구 내당동 987',    recipientName:'홍길동', recipientPhone:'010-6789-0123', ribbonText:'항상 응원합니다',         occasionText:'', storePhotoUrl:null, status:3, assignedDriverId:2,    assignedDriverName:'박서연', assignedAt:_addHours(now,-2),  deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-6),  updatedAt:_addHours(now,-2) },
    { id:7,  chainName:'새봄꽃집', productId:1, productName:'개업 화환', deliveryDatetime:_addHours(now,-2),  isImmediate:false, deliveryAddress:'대구시 남구 대명동 111',    recipientName:'김민정', recipientPhone:'010-7890-1234', ribbonText:'좋은 시작 되세요',        occasionText:'', storePhotoUrl:null, status:4, assignedDriverId:1,    assignedDriverName:'이민준', assignedAt:_addHours(now,-3),  deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-8),  updatedAt:_addHours(now,-3) },
    { id:8,  chainName:'꽃길',     productId:4, productName:'근조 화환', deliveryDatetime:_addHours(now,-4),  isImmediate:false, deliveryAddress:'대구시 중구 서문로 222',    recipientName:'이상호', recipientPhone:'010-8901-2345', ribbonText:'삼가 고인의 명복을 빕니다', occasionText:'삼가 고인의 명복을 빕니다', storePhotoUrl:null, status:4, assignedDriverId:2, assignedDriverName:'박서연', assignedAt:_addHours(now,-5), deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-10), updatedAt:_addHours(now,-5) },
    { id:9,  chainName:'꽃피다',   productId:2, productName:'졸업 화환', deliveryDatetime:_addHours(now,6),   isImmediate:false, deliveryAddress:'대구시 수성구 지산동 333',  recipientName:'박지연', recipientPhone:'010-9012-3456', ribbonText:'고생 많으셨습니다',       occasionText:'', storePhotoUrl:null, status:5, assignedDriverId:null, assignedDriverName:null, assignedAt:null, deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-12), updatedAt:_addHours(now,-6) },
    { id:10, chainName:'꽃마을',   productId:3, productName:'축하 화환', deliveryDatetime:_addHours(now,-6),  isImmediate:false, deliveryAddress:'대구시 달서구 진천동 444',  recipientName:'최건우', recipientPhone:'010-0123-4567', ribbonText:'축하드립니다',            occasionText:'', storePhotoUrl:null, status:6, assignedDriverId:3,    assignedDriverName:'정지훈', assignedAt:_addHours(now,-7),  deliveryPhotoUrl:null, createdByUserId:1, createdByName:'2층 담당자', createdAt:_addHours(now,-14), updatedAt:_addHours(now,-7) },
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

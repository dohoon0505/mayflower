/* ============================================================
   API.JS — Mock API layer (swap fetch() here for real server)
   ============================================================ */

const _delay = (min = 80, max = 250) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

const Api = {
  /* ── Auth ───────────────────────────────────────────────── */
  login:    (u, p)  => Auth.login(u, p),
  register: (data)  => Auth.register(data),

  /* ── Orders ─────────────────────────────────────────────── */
  async getOrders(filters = {}) {
    await _delay();
    const s = Auth.getSession();
    if (!s) throw { status: 401, message: '인증이 필요합니다.' };
    if (s.role === 'floor2') filters = { ...filters, createdByUserId: s.userId };
    if (s.role === 'driver') throw { status: 403, message: '권한이 없습니다.' };
    return Store.getOrders(filters);
  },

  async createOrder(data) {
    await _delay();
    const s = Auth.getSession();
    if (!s) throw { status: 401, message: '인증이 필요합니다.' };
    if (!Auth.can('createOrder', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    if (!data.chainName?.trim()) throw { status: 400, message: '체인명을 입력해 주세요.' };
    if (!data.productId) throw { status: 400, message: '상품을 선택해 주세요.' };
    if (!data.deliveryAddress?.trim()) throw { status: 400, message: '배송지를 입력해 주세요.' };
    if (!data.recipientName?.trim()) throw { status: 400, message: '받는 분 성함을 입력해 주세요.' };
    return Store.createOrder(data, s);
  },

  async updateOrderStatus(id, status) {
    await _delay();
    const s = Auth.getSession();
    if (!s) throw { status: 401, message: '인증이 필요합니다.' };
    if (!Auth.can('updateStatus', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    if (!Store.updateOrderStatus(id, status)) throw { status: 404, message: '주문을 찾을 수 없습니다.' };
    return true;
  },

  async assignDriver(id, driverId) {
    await _delay();
    const s = Auth.getSession();
    if (!s) throw { status: 401, message: '인증이 필요합니다.' };
    if (!Auth.can('assignDriver', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    if (!Store.assignDriver(id, driverId)) throw { status: 404, message: '주문을 찾을 수 없습니다.' };
    return true;
  },

  async completeOrder(id, photoUrl) {
    await _delay();
    const s = Auth.getSession();
    if (!s) throw { status: 401, message: '인증이 필요합니다.' };
    if (!Auth.can('completeDelivery', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    if (!Store.completeOrder(id, photoUrl)) throw { status: 404, message: '주문을 찾을 수 없습니다.' };
    return true;
  },

  async updateOrder(id, data) {
    await _delay();
    const s = Auth.getSession();
    if (!s) throw { status: 401, message: '인증이 필요합니다.' };
    if (!Auth.can('updateStatus', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    if (!Store.updateOrder(id, data)) throw { status: 404, message: '주문을 찾을 수 없습니다.' };
    return true;
  },

  async uploadStorePhoto(file) {
    await _delay(200, 600);
    if (file.size > 5 * 1024 * 1024) throw { status: 400, message: '파일 크기는 5MB 이하여야 합니다.' };
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) throw { status: 400, message: 'jpg, png 파일만 허용됩니다.' };
    return { url: URL.createObjectURL(file) };
  },

  /* ── Products ───────────────────────────────────────────── */
  async getProducts(includeInactive = false) {
    await _delay();
    return Store.getProducts(!includeInactive);
  },

  async createProduct(data) {
    await _delay();
    const s = Auth.getSession();
    if (!s || s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (!data.name?.trim()) throw { status: 400, message: '상품명을 입력해 주세요.' };
    return Store.createProduct(data);
  },

  async updateProduct(id, data) {
    await _delay();
    const s = Auth.getSession();
    if (!s || s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (!Store.updateProduct(id, data)) throw { status: 404, message: '상품을 찾을 수 없습니다.' };
    return true;
  },

  async deleteProduct(id) {
    await _delay();
    const s = Auth.getSession();
    if (!s || s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (!Store.deleteProduct(id)) throw { status: 404, message: '상품을 찾을 수 없습니다.' };
    return true;
  },

  /* ── Drivers ─────────────────────────────────────────────── */
  async getDrivers(includeInactive = false) {
    await _delay();
    return Store.getDrivers(!includeInactive);
  },

  async createDriver(data) {
    await _delay();
    const s = Auth.getSession();
    if (!s || s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (!data.name?.trim()) throw { status: 400, message: '기사 이름을 입력해 주세요.' };
    return Store.createDriver(data);
  },

  async updateDriver(id, data) {
    await _delay();
    const s = Auth.getSession();
    if (!s || s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (!Store.updateDriver(id, data)) throw { status: 404, message: '기사를 찾을 수 없습니다.' };
    return true;
  },

  async deleteDriver(id) {
    await _delay();
    const s = Auth.getSession();
    if (!s || s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (!Store.deleteDriver(id)) throw { status: 404, message: '기사를 찾을 수 없습니다.' };
    return true;
  },

  /* ── Delivery ───────────────────────────────────────────── */
  async getMyDeliveries() {
    await _delay();
    const s = Auth.getSession();
    if (!s) throw { status: 401, message: '인증이 필요합니다.' };
    if (!Auth.can('myDeliveries', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    const driverId = s.driverId;
    if (!driverId) return [];
    return Store.getOrders({ driverId }).filter(o => ![4, 5, 6].includes(o.status));
  },

  async uploadDeliveryPhoto(file) {
    await _delay(300, 800);
    if (file.size > 5 * 1024 * 1024) throw { status: 400, message: '파일 크기는 5MB 이하여야 합니다.' };
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) throw { status: 400, message: 'jpg, png 파일만 허용됩니다.' };
    return { url: URL.createObjectURL(file) };
  },

  /* ── Statistics ─────────────────────────────────────────── */
  async getDriverStats(from, to) {
    await _delay();
    const s = Auth.getSession();
    if (!s || !Auth.can('statistics', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    const orders = Store.getOrders({ status: 4 }).filter(o =>
      (!from || o.deliveryDatetime >= from) && (!to || o.deliveryDatetime <= to)
    );
    const map = {};
    orders.forEach(o => {
      if (!o.assignedDriverName) return;
      const key = `${o.assignedDriverName}||${o.productName}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([k, count]) => {
      const [driverName, productName] = k.split('||');
      return { driverName, productName, count };
    }).sort((a, b) => a.driverName.localeCompare(b.driverName, 'ko'));
  },

  async getDailyStats(year, month) {
    await _delay();
    const s = Auth.getSession();
    if (!s || !Auth.can('statistics', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    const orders = Store.getOrders({ status: 4 }).filter(o => {
      const d = new Date(o.deliveryDatetime);
      return d.getFullYear() === +year && (d.getMonth() + 1) === +month;
    });
    const map = {};
    orders.forEach(o => {
      const d = new Date(o.deliveryDatetime);
      const date = UI.fmtDate(o.deliveryDatetime);
      const key = `${date}||${o.productName}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([k, count]) => {
      const [date, productName] = k.split('||');
      return { date, productName, count };
    }).sort((a, b) => a.date.localeCompare(b.date));
  },

  async getMonthlyStats(year) {
    await _delay();
    const s = Auth.getSession();
    if (!s || !Auth.can('statistics', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    const orders = Store.getOrders({ status: 4 }).filter(o =>
      new Date(o.deliveryDatetime).getFullYear() === +year
    );
    const map = {};
    orders.forEach(o => {
      const d = new Date(o.deliveryDatetime);
      const month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const key = `${month}||${o.productName}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([k, count]) => {
      const [month, productName] = k.split('||');
      return { month, productName, count };
    }).sort((a, b) => a.month.localeCompare(b.month));
  },
};

/* ============================================================
   AUTH.JS — Session · Login · Logout · Permission Guard
   ============================================================ */

const Auth = {
  SESSION_KEY: 'maydaegu.session',

  async login(username, password) {
    const user = Store.getUserByUsername(username);
    if (!user || user.passwordHash !== password) {
      return { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' };
    }
    const session = {
      token:       `mock_${user.id}_${Date.now()}`,
      userId:      user.id,
      displayName: user.displayName,
      role:        user.role,
    };
    /* driver 역할이면 drivers 테이블에서 driverId 매핑 */
    if (user.role === 'driver') {
      const driver = Store.getDrivers(false).find(d => d.name === user.displayName);
      session.driverId = driver ? driver.id : null;
    }
    sessionStorage.setItem(Auth.SESSION_KEY, JSON.stringify(session));
    return { success: true, ...session };
  },

  async register(data) {
    if (Store.getUserByUsername(data.username)) {
      throw { status: 400, message: '이미 사용 중인 아이디입니다.' };
    }
    Store.createUser({
      username:     data.username,
      passwordHash: data.password,
      displayName:  data.displayName,
      role:         data.role,
    });
    return true;
  },

  logout() {
    sessionStorage.removeItem(Auth.SESSION_KEY);
    window.location.href = 'index.html';
  },

  getSession() {
    try { return JSON.parse(sessionStorage.getItem(Auth.SESSION_KEY)); } catch { return null; }
  },

  isAuthenticated() { return !!Auth.getSession(); },

  requireAuth() {
    const s = Auth.getSession();
    if (!s) { window.location.href = 'index.html'; return null; }
    return s;
  },

  /* 기능별 허용 role 목록 */
  can(feature, role) {
    const rules = {
      createOrder:      ['floor2', 'admin'],
      myOrders:         ['floor2'],
      allOrders:        ['floor1', 'admin'],
      updateStatus:     ['floor1', 'admin'],
      assignDriver:     ['floor1', 'admin'],
      myDeliveries:     ['driver'],
      completeDelivery: ['driver', 'admin'],
      manageProducts:   ['admin'],
      manageDrivers:    ['admin'],
      statistics:       ['admin'],
      viewProducts:     ['floor2', 'floor1', 'admin'],
      viewDrivers:      ['floor1', 'admin'],
    };
    return (rules[feature] || []).includes(role);
  },
};

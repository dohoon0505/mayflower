/* ============================================================
   AUTH.JS — Firebase Auth wrapper (Email/Password)
   username → `@maydaegu.internal` 이메일 합성
   세션은 firebase.auth().currentUser 와 /users/{uid} 프로필 조합
   ============================================================ */

const EMAIL_DOMAIN = 'maydaegu.internal';

const Auth = {
  _session:  null,   // 메모리 캐시: { token, userId, displayName, role, driverId }
  _readyPromise: null,

  /* username(trim·lowercase) → email */
  toEmail(username) {
    return `${String(username || '').trim().toLowerCase()}@${EMAIL_DOMAIN}`;
  },

  /* ── 진입점에서 호출 — onAuthStateChanged 1회 + 3초 타임아웃 ───── */
  waitForReady(timeoutMs = 3000) {
    if (Auth._readyPromise) return Auth._readyPromise;
    Auth._readyPromise = new Promise((resolve) => {
      if (!window.FirebaseAuth) { resolve(null); return; }
      let done = false;
      const unsub = window.FirebaseAuth.onAuthStateChanged(async (user) => {
        if (done) return; done = true;
        unsub();
        if (!user) { Auth._session = null; resolve(null); return; }
        try {
          const session = await Auth._buildSession(user);
          Auth._session = session;
          resolve(session);
        } catch (e) {
          console.error('[Auth] session build failed:', e);
          Auth._session = null;
          resolve(null);
        }
      });
      setTimeout(() => { if (!done) { done = true; resolve(Auth._session); } }, timeoutMs);
    });
    return Auth._readyPromise;
  },

  /* firebase.User → /users/{uid} 병합 세션 빌드 */
  async _buildSession(user) {
    const snap = await window.FirebaseDB.ref(`users/${user.uid}`).once('value');
    const profile = snap.val();
    if (!profile) throw new Error('프로필을 찾을 수 없습니다. 관리자에게 문의하세요.');
    if (!profile.isApproved) throw new Error('승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.');
    if (!profile.isActive)   throw new Error('비활성화된 계정입니다.');
    if (!profile.role)       throw new Error('역할이 지정되지 않았습니다. 관리자에게 문의하세요.');

    const session = {
      token:       user.getIdToken ? await user.getIdToken() : `fb_${user.uid}`,
      userId:      user.uid,
      username:    profile.username,
      displayName: profile.displayName,
      role:        profile.role,
      email:       user.email,
    };

    /* driver 역할이면 /drivers 에서 linkedUserId 로 레코드 찾아 driverId 주입 */
    if (profile.role === 'driver') {
      const dsnap = await window.FirebaseDB.ref('drivers').orderByChild('linkedUserId').equalTo(user.uid).once('value');
      const drivers = dsnap.val() || {};
      const driverKey = Object.keys(drivers)[0] || null;
      session.driverId = driverKey;
    }
    return session;
  },

  /* ── 로그인 ─────────────────────────────────────────────────── */
  async login(username, password) {
    if (!window.FirebaseAuth) {
      return { success: false, message: 'Firebase 인증이 초기화되지 않았습니다.' };
    }
    const email = Auth.toEmail(username);
    try {
      const cred = await window.FirebaseAuth.signInWithEmailAndPassword(email, password);
      try {
        const session = await Auth._buildSession(cred.user);
        Auth._session = session;

        /* 드라이버 웹 로그인 차단 — 모바일 앱 전용 */
        if (session.role === 'driver') {
          await window.FirebaseAuth.signOut();
          Auth._session = null;
          return { success: false, message: '배송기사 계정은 모바일 앱에서만 이용 가능합니다.' };
        }

        return { success: true, ...session };
      } catch (e) {
        /* 승인/활성/역할 검증 실패 → 즉시 signOut */
        await window.FirebaseAuth.signOut();
        Auth._session = null;
        return { success: false, message: e.message || '로그인 검증 실패' };
      }
    } catch (e) {
      let msg = '아이디 또는 비밀번호가 올바르지 않습니다.';
      if (e?.code === 'auth/user-not-found' || e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        msg = '아이디 또는 비밀번호가 올바르지 않습니다.';
      } else if (e?.code === 'auth/too-many-requests') {
        msg = '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
      } else if (e?.message) {
        msg = e.message;
      }
      return { success: false, message: msg };
    }
  },

  /* ── 회원가입 ──────────────────────────────────────────────────
     role 은 관리자가 나중에 부여. 승인 전엔 로그인 불가 (isApproved=false).
     첫 사용자(users 컬렉션 비어 있음) 는 자동으로 isApproved=true, role='admin' 부트스트랩.
     ───────────────────────────────────────────────────────────── */
  async register(data) {
    const { username, password, displayName } = data;
    if (!window.FirebaseAuth) throw { status: 500, message: 'Firebase 인증이 초기화되지 않았습니다.' };
    if (!username || !password || !displayName) {
      throw { status: 400, message: '아이디, 비밀번호, 표시 이름을 모두 입력해 주세요.' };
    }

    const email = Auth.toEmail(username);

    /* 첫 사용자 여부 사전 확인 (규칙: auth 없이도 users .read 가능) */
    let isBootstrap = false;
    try {
      const s = await window.FirebaseDB.ref('users').limitToFirst(1).once('value');
      isBootstrap = !s.exists();
    } catch (_) {
      /* 읽기 실패 시 bootstrap 아님으로 간주 */
    }

    let cred;
    try {
      cred = await window.FirebaseAuth.createUserWithEmailAndPassword(email, password);
    } catch (e) {
      if (e?.code === 'auth/email-already-in-use') {
        /* RTDB에 레코드가 없으면 삭제된 사용자의 고스트 Auth 계정 */
        let hasDbRecord = false;
        try {
          const snap = await window.FirebaseDB.ref('users')
            .orderByChild('username').equalTo(String(username).trim().toLowerCase())
            .limitToFirst(1).once('value');
          hasDbRecord = snap.exists();
        } catch (_) {}
        if (!hasDbRecord) {
          throw { status: 400, message: '이 아이디는 현재 사용할 수 없습니다. 관리자가 Firebase Console에서 Auth 계정을 삭제한 후 재가입이 가능합니다.' };
        }
        throw { status: 400, message: '이미 사용 중인 아이디입니다.' };
      }
      if (e?.code === 'auth/weak-password')  throw { status: 400, message: '비밀번호는 6자 이상이어야 합니다.' };
      if (e?.code === 'auth/invalid-email')  throw { status: 400, message: '아이디 형식이 올바르지 않습니다.' };
      throw { status: 500, message: e?.message || '회원가입 실패' };
    }

    const profile = {
      username:    String(username).trim().toLowerCase(),
      displayName: String(displayName).trim(),
      isApproved:  isBootstrap,
      isActive:    true,
      createdAt:   new Date().toISOString(),
    };
    if (isBootstrap) profile.role = 'admin';   // 첫 사용자 자동 관리자

    try {
      await window.FirebaseDB.ref(`users/${cred.user.uid}`).set(profile);
    } catch (e) {
      console.error('[Auth.register] 프로필 저장 실패:', e);
      /* 프로필 저장 실패 시 가능한 한 auth 계정 정리 (본인 권한으로만 가능) */
      try { await cred.user.delete(); } catch (_) {}
      throw { status: 500, message: '프로필 저장 실패: ' + (e?.message || '알 수 없는 오류') };
    }

    /* 가입 직후 즉시 로그아웃 — 승인 대기 상태 유지 */
    try { await window.FirebaseAuth.signOut(); } catch (_) {}
    Auth._session = null;

    return { bootstrap: isBootstrap };
  },

  /* ── 로그아웃 ──────────────────────────────────────────────── */
  async logout() {
    try { if (window.FirebaseAuth) await window.FirebaseAuth.signOut(); } catch (_) {}
    Auth._session = null;
    Auth._readyPromise = null;
    window.location.href = 'index.html';
  },

  /* ── 세션 조회 (동기) ───────────────────────────────────────── */
  getSession() { return Auth._session; },

  isAuthenticated() { return !!Auth._session; },

  requireAuth() {
    const s = Auth._session;
    if (!s) { window.location.href = 'index.html'; return null; }
    return s;
  },

  /* ── 비밀번호 변경 (재인증 필요) ─────────────────────────────── */
  async changePassword(currentPassword, newPassword) {
    const user = window.FirebaseAuth?.currentUser;
    if (!user || !user.email) throw { status: 401, message: '로그인이 필요합니다.' };
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(newPassword);
    return true;
  },

  /* ── 권한 규칙 (UI 가드용) ──────────────────────────────────── */
  can(feature, role) {
    const rules = {
      createOrder:      ['floor2', 'admin'],
      myOrders:         ['floor2'],
      allOrders:        ['floor1', 'admin'],
      updateStatus:     ['floor1', 'floor2', 'admin'],
      assignDriver:     ['floor1', 'admin'],
      myDeliveries:     ['driver'],
      completeDelivery: ['driver', 'admin'],
      manageProducts:   ['admin'],
      manageDrivers:    ['admin'],
      manageUsers:      ['admin'],
      statistics:       ['admin'],
      viewProducts:     ['floor2', 'floor1', 'admin'],
      viewDrivers:      ['floor1', 'admin'],
    };
    return (rules[feature] || []).includes(role);
  },
};

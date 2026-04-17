/* ============================================================
   LOGIN.JS — Login + Register view (Firebase Auth)
   ============================================================ */

const LoginView = {
  init() {
    LoginView._renderTabs();
    LoginView._bindTabs();
    LoginView._bindForms();
    LoginView._checkQueryErrors();
  },

  _checkQueryErrors() {
    const q = new URLSearchParams(window.location.search);
    const err = q.get('error');
    if (!err) return;
    const errEl = document.getElementById('login-err');
    if (err === 'driver_only')    errEl.textContent = '배송기사 계정은 모바일 앱에서만 이용 가능합니다.';
    else if (err === 'unauth')    errEl.textContent = '로그인이 필요합니다.';
    else if (err === 'not_approved') errEl.textContent = '승인 대기 중입니다.';
    if (errEl.textContent) errEl.style.display = 'block';
  },

  _renderTabs() {
    UI.setContent('login-tabs', `
      <button class="login-tab active" data-tab="login">로그인</button>
      <button class="login-tab" data-tab="register">회원가입</button>`);

    UI.setContent('login-panels', `
      <form id="form-login" class="login-panel" novalidate>
        <div class="form-group">
          <label class="form-label">아이디</label>
          <input type="text" id="inp-username" class="form-control" placeholder="아이디 입력" autocomplete="username" required>
        </div>
        <div class="form-group">
          <label class="form-label">비밀번호</label>
          <input type="password" id="inp-password" class="form-control" placeholder="비밀번호 입력" autocomplete="current-password" required>
        </div>
        <div id="login-err" style="color:var(--error);font-size:0.82rem;display:none"></div>
        <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-login">로그인</button>
        <div class="login-hint">
          계정이 없으신 분은 회원가입 후 관리자 승인을 받으시면 이용 가능합니다.<br>
          <strong>배송기사</strong>는 전용 모바일 앱을 사용해 주세요.
        </div>
      </form>

      <form id="form-register" class="login-panel hidden" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">아이디 <span class="form-required">*</span></label>
            <input type="text" id="reg-username" class="form-control" placeholder="영문·숫자" required>
          </div>
          <div class="form-group">
            <label class="form-label">비밀번호 <span class="form-required">*</span> <span class="text-muted" style="font-weight:400">(6자 이상)</span></label>
            <input type="password" id="reg-password" class="form-control" placeholder="비밀번호" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">표시 이름 <span class="form-required">*</span></label>
          <input type="text" id="reg-displayname" class="form-control" placeholder="화면에 표시될 이름" required>
        </div>
        <p class="text-muted" style="font-size:0.82rem;margin-top:0.5rem">
          회원가입 후 관리자가 승인하면 로그인이 가능합니다. 권한(1층/2층/관리자)은 관리자가 지정합니다.
        </p>
        <div id="reg-err" style="color:var(--error);font-size:0.82rem;display:none"></div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">회원가입</button>
      </form>`);
  },

  _bindTabs() {
    document.getElementById('login-tabs').addEventListener('click', e => {
      const tab = e.target.closest('.login-tab');
      if (!tab) return;
      const name = tab.dataset.tab;
      UI.$$('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
      UI.$$('.login-panel').forEach(p => {
        p.classList.toggle('hidden', p.id !== `form-${name}`);
      });
    });
  },

  _bindForms() {
    document.getElementById('form-login').addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('inp-username').value.trim();
      const password = document.getElementById('inp-password').value;
      const errEl = document.getElementById('login-err');
      const btn = document.getElementById('btn-login');
      errEl.style.display = 'none';
      btn.disabled = true; btn.textContent = '로그인 중...';
      try {
        const res = await Api.login(username, password);
        if (res.success) {
          window.location.href = 'app.html';
        } else {
          errEl.textContent = res.message; errEl.style.display = 'block';
        }
      } catch(err) {
        errEl.textContent = err.message || '오류가 발생했습니다.'; errEl.style.display = 'block';
      } finally {
        btn.disabled = false; btn.textContent = '로그인';
      }
    });

    document.getElementById('form-register').addEventListener('submit', async e => {
      e.preventDefault();
      const data = {
        username:    document.getElementById('reg-username').value.trim(),
        password:    document.getElementById('reg-password').value,
        displayName: document.getElementById('reg-displayname').value.trim(),
      };
      const errEl = document.getElementById('reg-err');
      const btn = e.target.querySelector('button[type="submit"]');
      errEl.style.display = 'none';
      if (!data.username || !data.password || !data.displayName) {
        errEl.textContent = '모든 필드를 입력해 주세요.'; errEl.style.display = 'block'; return;
      }
      btn.disabled = true; btn.textContent = '가입 중...';
      try {
        const res = await Api.register(data);
        if (res?.bootstrap) {
          UI.toast('첫 관리자 계정이 생성되었습니다. 로그인해 주세요.', 'success', 5000);
        } else {
          UI.toast('회원가입이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.', 'success', 5000);
        }
        /* 로그인 탭으로 전환 */
        UI.$$('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'login'));
        UI.$$('.login-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'form-login'));
        document.getElementById('inp-username').value = data.username;
        document.getElementById('inp-password').focus();
      } catch(err) {
        errEl.textContent = err.message || '오류가 발생했습니다.'; errEl.style.display = 'block';
      } finally {
        btn.disabled = false; btn.textContent = '회원가입';
      }
    });
  },
};

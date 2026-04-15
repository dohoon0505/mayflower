/* ============================================================
   ADMIN.JS — 관리자: 전체주문 · 상품CRUD · 기사CRUD · 통계
   ============================================================ */

const AdminView = {
  _session: null,

  init(session) {
    AdminView._session = session;
    Router.register('all-orders',      () => Floor1View.showAllOrders());
    Router.register('manage-products', () => AdminView.showProducts());
    Router.register('manage-drivers',  () => AdminView.showDrivers());
    Router.register('statistics',      () => AdminView.showStats());
    Router.default('all-orders');
  },

  /* ── 상품 관리 ────────────────────────────────────────────── */
  async showProducts() {
    UI.setFilter(`
      <div class="filter-area-inner">
        <span class="filter-label">상품 관리</span>
      </div>`);
    UI.loading(true);
    try {
      const products = await Api.getProducts(true); /* include inactive */
      UI.setMain(AdminView._renderProductTable(products));
      AdminView._bindProductActions(products);
    } catch(e) {
      UI.toast(e.message || '조회 실패', 'error');
    } finally { UI.loading(false); }
  },

  _renderProductTable(products) {
    const categories = Store.getCategories();
    const catOpts = categories.map(c => `<option value="${c}">${c}</option>`).join('');

    /* 카테고리별 활성 상품 수 집계 */
    const usageCount = (cat) => products.filter(p => p.isActive && p.category === cat).length;

    const catChips = categories.map(c => `
      <div class="cat-chip" data-cat="${UI.escHtml(c)}">
        <span class="cat-chip-name">${UI.escHtml(c)}</span>
        <span class="cat-chip-count">${usageCount(c)}</span>
        <button class="cat-chip-btn cat-rename" data-cat="${UI.escHtml(c)}" title="이름 변경">✏️</button>
        <button class="cat-chip-btn cat-delete" data-cat="${UI.escHtml(c)}" title="삭제">✕</button>
      </div>`).join('');

    const rows = products.map(p => `
      <tr data-id="${p.id}">
        <td>${p.id}</td>
        <td class="td-name">${UI.escHtml(p.name)}</td>
        <td class="td-cat"><span class="badge badge-role">${UI.escHtml(p.category || '기타')}</span></td>
        <td>${p.isActive ? '<span class="badge status-complete">활성</span>' : '<span class="badge status-cancel">비활성</span>'}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-secondary btn-xs p-edit" data-id="${p.id}">수정</button>
            <button class="btn btn-danger btn-xs p-delete" data-id="${p.id}" ${!p.isActive?'disabled':''}>삭제</button>
            ${!p.isActive ? `<button class="btn btn-success btn-xs p-restore" data-id="${p.id}">복원</button>` : ''}
          </div>
        </td>
      </tr>`).join('');

    return `
      <div class="section-header">
        <div><div class="section-title">카테고리 관리</div><div class="section-sub">${categories.length}개 · 숫자는 활성 상품 수</div></div>
      </div>
      <div class="cat-manage-box">
        <div class="cat-chip-list" id="cat-chip-list">${catChips}</div>
        <div class="cat-add-row">
          <input type="text" id="new-cat-name" class="inline-input" placeholder="새 카테고리명" style="max-width:180px">
          <button class="btn btn-primary btn-sm" id="btn-add-cat">+ 카테고리 추가</button>
        </div>
      </div>

      <div class="section-header" style="margin-top:1.25rem">
        <div><div class="section-title">상품 목록</div><div class="section-sub">${products.filter(p=>p.isActive).length}개 활성</div></div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>상품명</th><th>카테고리</th><th>상태</th><th>관리</th></tr></thead>
          <tbody id="product-tbody">${rows}</tbody>
        </table>
        <div class="add-row-form">
          <input type="text" id="new-product-name" class="inline-input" placeholder="새 상품명" style="max-width:180px">
          <select id="new-product-cat" class="filter-select">${catOpts}</select>
          <button class="btn btn-primary btn-sm" id="btn-add-product">+ 상품 추가</button>
        </div>
      </div>`;
  },

  _bindProductActions(products) {
    /* ── 카테고리: 추가 ── */
    const addCatBtn   = document.getElementById('btn-add-cat');
    const newCatInput = document.getElementById('new-cat-name');
    const doAddCat = () => {
      const name = newCatInput.value.trim();
      if (!name) { UI.toast('카테고리명을 입력해 주세요.', 'warning'); return; }
      if (!Store.createCategory(name)) {
        UI.toast('이미 존재하는 카테고리입니다.', 'warning'); return;
      }
      UI.toast(`"${name}" 카테고리가 추가되었습니다.`, 'success');
      AdminView.showProducts();
    };
    addCatBtn.addEventListener('click', doAddCat);
    newCatInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAddCat(); });

    /* ── 카테고리: 이름 변경 ── */
    document.querySelectorAll('.cat-rename').forEach(btn => {
      btn.addEventListener('click', async () => {
        const old = btn.dataset.cat;
        const newName = await UI.prompt?.(`"${old}" 카테고리의 새 이름을 입력하세요.`, '카테고리 이름 변경', old)
          ?? window.prompt(`"${old}" 카테고리의 새 이름`, old);
        if (!newName || newName.trim() === old) return;
        if (!Store.renameCategory(old, newName.trim())) {
          UI.toast('이름 변경 실패 (중복 또는 공백)', 'error'); return;
        }
        UI.toast('카테고리 이름이 변경되었습니다.', 'success');
        AdminView.showProducts();
      });
    });

    /* ── 카테고리: 삭제 ── */
    document.querySelectorAll('.cat-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.cat;
        const ok = await UI.confirm(`"${name}" 카테고리를 삭제할까요?`, '카테고리 삭제');
        if (!ok) return;
        const res = Store.deleteCategory(name);
        if (!res.ok) {
          if (res.reason === 'in_use') {
            UI.toast(`사용 중인 상품이 ${res.count}건 있어 삭제할 수 없습니다.`, 'warning');
          } else {
            UI.toast('삭제 실패', 'error');
          }
          return;
        }
        UI.toast('카테고리가 삭제되었습니다.', 'success');
        AdminView.showProducts();
      });
    });

    /* 상품 추가 */
    document.getElementById('btn-add-product').addEventListener('click', async () => {
      const nameEl = document.getElementById('new-product-name');
      const catEl  = document.getElementById('new-product-cat');
      const name = nameEl.value.trim();
      const category = catEl?.value || '기타';
      if (!name) { UI.toast('상품명을 입력해 주세요.', 'warning'); return; }
      try {
        await Api.createProduct({ name, category });
        UI.toast(`"${name}" 상품이 추가되었습니다.`, 'success');
        AdminView.showProducts();
      } catch(e) { UI.toast(e.message || '추가 실패', 'error'); }
    });
    document.getElementById('new-product-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-add-product').click();
    });

    /* 수정 */
    document.querySelectorAll('.p-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = +btn.dataset.id;
        const p = products.find(x => x.id === id);
        if (!p) return;
        const tr = btn.closest('tr');
        const tdName = tr.querySelector('.td-name');
        const tdCat  = tr.querySelector('.td-cat');
        const cats = (Store.CATEGORIES || ['화환','꽃바구니','화분','생화','조화','기타'])
          .map(c => `<option value="${c}" ${c === p.category ? 'selected' : ''}>${c}</option>`).join('');
        tdName.innerHTML = `<input type="text" class="inline-input" id="edit-p-${id}" value="${UI.escHtml(p.name)}" style="max-width:160px">`;
        tdCat.innerHTML  = `<select class="filter-select" id="edit-pc-${id}" style="font-size:0.8rem">${cats}</select>`;
        const input    = document.getElementById(`edit-p-${id}`);
        const catInput = document.getElementById(`edit-pc-${id}`);
        input.focus(); input.select();
        btn.textContent = '저장';
        btn.onclick = async () => {
          const newName = input.value.trim();
          const newCat  = catInput.value;
          if (!newName) { UI.toast('상품명을 입력해 주세요.', 'warning'); return; }
          try {
            await Api.updateProduct(id, { name: newName, category: newCat, isActive: p.isActive });
            UI.toast('상품이 수정되었습니다.', 'success');
            AdminView.showProducts();
          } catch(e) { UI.toast(e.message || '수정 실패', 'error'); }
        };
      });
    });

    /* 삭제 */
    document.querySelectorAll('.p-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = +btn.dataset.id;
        const p = products.find(x => x.id === id);
        const ok = await UI.confirm(`"${p?.name}" 상품을 삭제(비활성)할까요?`, '상품 삭제');
        if (!ok) return;
        try {
          await Api.deleteProduct(id);
          UI.toast('삭제되었습니다.', 'success');
          AdminView.showProducts();
        } catch(e) { UI.toast(e.message || '삭제 실패', 'error'); }
      });
    });

    /* 복원 */
    document.querySelectorAll('.p-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = +btn.dataset.id;
        const p = products.find(x => x.id === id);
        try {
          await Api.updateProduct(id, { name: p.name, category: p.category || '기타', isActive: true });
          UI.toast('복원되었습니다.', 'success');
          AdminView.showProducts();
        } catch(e) { UI.toast(e.message || '복원 실패', 'error'); }
      });
    });
  },

  /* ── 기사 관리 ────────────────────────────────────────────── */
  async showDrivers() {
    UI.setFilter(`
      <div class="filter-area-inner">
        <span class="filter-label">기사 관리</span>
      </div>`);
    UI.loading(true);
    try {
      const drivers = await Api.getDrivers(true); /* include inactive */
      const driverUsers = Store.getUsersByRole('driver');
      UI.setMain(AdminView._renderDriverTable(drivers, driverUsers));
      AdminView._bindDriverActions(drivers, driverUsers);
    } catch(e) {
      UI.toast(e.message || '조회 실패', 'error');
    } finally { UI.loading(false); }
  },

  /* driver users 테이블에서 기사에 연결된 계정 검색 (displayName 매핑) */
  _findDriverUser(driverName, driverUsers) {
    return driverUsers.find(u => u.displayName === driverName) || null;
  },

  _renderDriverTable(drivers, driverUsers) {
    const rows = drivers.map(d => {
      const linked = AdminView._findDriverUser(d.name, driverUsers);
      const loginId = linked ? UI.escHtml(linked.username) : '<span class="text-muted">미설정</span>';
      return `
        <tr data-id="${d.id}">
          <td>${d.id}</td>
          <td class="td-dname">${UI.escHtml(d.name)}</td>
          <td class="td-dphone">${UI.escHtml(d.phone || '-')}</td>
          <td>${loginId}</td>
          <td>${d.isActive ? '<span class="badge status-complete">활성</span>' : '<span class="badge status-cancel">비활성</span>'}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-secondary btn-xs d-edit" data-id="${d.id}">수정</button>
              <button class="btn btn-secondary btn-xs d-cred" data-id="${d.id}" title="아이디·비밀번호 수정">🔑 계정</button>
              <button class="btn btn-danger btn-xs d-delete" data-id="${d.id}" ${!d.isActive?'disabled':''}>삭제</button>
              ${!d.isActive ? `<button class="btn btn-success btn-xs d-restore" data-id="${d.id}">복원</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="section-header">
        <div><div class="section-title">기사 목록</div><div class="section-sub">${drivers.filter(d=>d.isActive).length}명 활성</div></div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>이름</th><th>연락처</th><th>로그인 아이디</th><th>상태</th><th>관리</th></tr></thead>
          <tbody id="driver-tbody">${rows}</tbody>
        </table>
        <div class="add-row-form">
          <input type="text"     id="new-driver-name"  class="inline-input" placeholder="이름"            style="max-width:110px">
          <input type="tel"      id="new-driver-phone" class="inline-input" placeholder="010-0000-0000"   style="max-width:145px">
          <input type="text"     id="new-driver-uid"   class="inline-input" placeholder="아이디 (선택)"    style="max-width:120px">
          <input type="password" id="new-driver-pw"    class="inline-input" placeholder="비밀번호 (선택)"  style="max-width:130px">
          <button class="btn btn-primary btn-sm" id="btn-add-driver">+ 기사 추가</button>
        </div>
      </div>`;
  },

  _bindDriverActions(drivers, driverUsers) {
    /* ── 추가 ── */
    document.getElementById('btn-add-driver').addEventListener('click', async () => {
      const name  = document.getElementById('new-driver-name').value.trim();
      const phone = document.getElementById('new-driver-phone').value.trim();
      const uid   = document.getElementById('new-driver-uid').value.trim();
      const pw    = document.getElementById('new-driver-pw').value.trim();
      if (!name) { UI.toast('이름을 입력해 주세요.', 'warning'); return; }
      if ((uid && !pw) || (!uid && pw)) {
        UI.toast('아이디와 비밀번호를 함께 입력해 주세요.', 'warning'); return;
      }
      if (uid && Store.getUserByUsername(uid)) {
        UI.toast('이미 사용 중인 아이디입니다.', 'warning'); return;
      }
      try {
        await Api.createDriver({ name, phone });
        if (uid && pw) {
          Store.createUser({ username: uid, passwordHash: pw, displayName: name, role: 'driver' });
        }
        UI.toast(`"${name}" 기사가 추가되었습니다.`, 'success');
        AdminView.showDrivers();
      } catch(e) { UI.toast(e.message || '추가 실패', 'error'); }
    });

    /* ── 이름·연락처 수정 (인라인 → 모달로 교체하여 이벤트 충돌 방지) ── */
    document.querySelectorAll('.d-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = +btn.dataset.id;
        const d  = drivers.find(x => x.id === id);
        if (!d) return;

        const overlay = UI.modal({
          title:       `✏️ 기사 정보 수정 — ${UI.escHtml(d.name)}`,
          content: `
            <div class="form-group">
              <label class="form-label">이름</label>
              <input type="text" id="medit-name" class="form-control" value="${UI.escHtml(d.name)}">
            </div>
            <div class="form-group">
              <label class="form-label">연락처</label>
              <input type="tel" id="medit-phone" class="form-control" value="${UI.escHtml(d.phone || '')}" placeholder="010-0000-0000">
            </div>`,
          confirmText: '저장',
          cancelText:  '취소',
        });

        setTimeout(() => document.getElementById('medit-name')?.focus(), 50);

        overlay.querySelector('.modal-confirm').addEventListener('click', async () => {
          const newName  = document.getElementById('medit-name').value.trim();
          const newPhone = document.getElementById('medit-phone').value.trim();
          if (!newName) { UI.toast('이름을 입력해 주세요.', 'warning'); return; }
          try {
            await Api.updateDriver(id, { name: newName, phone: newPhone, isActive: d.isActive });

            /* 이름이 바뀌면 연결된 user 계정의 displayName도 동기화 */
            if (newName !== d.name) {
              const linked = AdminView._findDriverUser(d.name, driverUsers);
              if (linked) Store.updateUser(linked.id, { displayName: newName });
            }

            UI.toast('수정되었습니다.', 'success');
            overlay.classList.remove('show');
            setTimeout(() => { overlay.remove(); AdminView.showDrivers(); }, 300);
          } catch(e) { UI.toast(e.message || '수정 실패', 'error'); }
        });
      });
    });

    /* ── 계정(아이디·비밀번호) 수정 ── */
    document.querySelectorAll('.d-cred').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = +btn.dataset.id;
        const d  = drivers.find(x => x.id === id);
        if (!d) return;
        const linked = AdminView._findDriverUser(d.name, driverUsers);

        const overlay = UI.modal({
          title:       `🔑 계정 관리 — ${UI.escHtml(d.name)}`,
          content: `
            <div class="form-group">
              <label class="form-label">로그인 아이디</label>
              <input type="text" id="cred-uid" class="form-control"
                value="${linked ? UI.escHtml(linked.username) : ''}"
                placeholder="영문·숫자 조합">
            </div>
            <div class="form-group">
              <label class="form-label">비밀번호${linked ? ' <span class="text-muted" style="font-weight:400">(변경하지 않으려면 비워두세요)</span>' : ''}</label>
              <input type="password" id="cred-pw" class="form-control"
                placeholder="${linked ? '변경할 비밀번호 입력' : '비밀번호 입력'}">
            </div>
            ${linked ? `<p class="text-muted" style="font-size:0.82rem;margin-top:0.5rem">현재 아이디: <strong>${UI.escHtml(linked.username)}</strong></p>` : '<p class="text-muted" style="font-size:0.82rem;margin-top:0.5rem">이 기사에 연결된 계정이 없습니다. 아이디와 비밀번호를 입력하면 새로 생성됩니다.</p>'}`,
          confirmText: linked ? '저장' : '계정 생성',
          cancelText:  '취소',
        });

        setTimeout(() => document.getElementById('cred-uid')?.focus(), 50);

        overlay.querySelector('.modal-confirm').addEventListener('click', async () => {
          const newUid = document.getElementById('cred-uid').value.trim();
          const newPw  = document.getElementById('cred-pw').value.trim();

          if (!newUid) { UI.toast('아이디를 입력해 주세요.', 'warning'); return; }
          if (!linked && !newPw) { UI.toast('비밀번호를 입력해 주세요.', 'warning'); return; }

          /* 아이디 중복 확인 (자기 자신 제외) */
          const existing = Store.getUserByUsername(newUid);
          if (existing && (!linked || existing.id !== linked.id)) {
            UI.toast('이미 사용 중인 아이디입니다.', 'warning'); return;
          }

          try {
            if (linked) {
              /* 기존 계정 업데이트 */
              const updates = { username: newUid };
              if (newPw) updates.passwordHash = newPw;
              Store.updateUser(linked.id, updates);
              UI.toast('계정이 수정되었습니다.', 'success');
            } else {
              /* 신규 계정 생성 */
              Store.createUser({ username: newUid, passwordHash: newPw, displayName: d.name, role: 'driver' });
              UI.toast('계정이 생성되었습니다.', 'success');
            }
            overlay.classList.remove('show');
            setTimeout(() => { overlay.remove(); AdminView.showDrivers(); }, 300);
          } catch(e) { UI.toast(e.message || '처리 실패', 'error'); }
        });
      });
    });

    /* ── 삭제 ── */
    document.querySelectorAll('.d-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = +btn.dataset.id;
        const d = drivers.find(x => x.id === id);
        const ok = await UI.confirm(`"${d?.name}" 기사를 삭제할까요?`, '기사 삭제');
        if (!ok) return;
        try {
          await Api.deleteDriver(id);
          UI.toast('삭제되었습니다.', 'success');
          AdminView.showDrivers();
        } catch(e) { UI.toast(e.message || '삭제 실패', 'error'); }
      });
    });

    /* ── 복원 ── */
    document.querySelectorAll('.d-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = +btn.dataset.id;
        const d = drivers.find(x => x.id === id);
        try {
          await Api.updateDriver(id, { name: d.name, phone: d.phone, isActive: true });
          UI.toast('복원되었습니다.', 'success');
          AdminView.showDrivers();
        } catch(e) { UI.toast(e.message || '복원 실패', 'error'); }
      });
    });
  },

  /* ── 통계 ─────────────────────────────────────────────────── */
  showStats() {
    UI.setFilter(`
      <div class="filter-area-inner">
        <span class="filter-label">통계</span>
      </div>`);

    const today = new Date();
    const yy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const firstDay = `${yy}-${mm}-01`;
    const todayStr = UI.fmtDate(today.toISOString());

    UI.setMain(`
      <div class="stats-tabs">
        <button class="stats-tab active" data-tab="driver">기사별</button>
        <button class="stats-tab" data-tab="daily">일별</button>
        <button class="stats-tab" data-tab="monthly">월별</button>
      </div>
      <div id="stats-controls"></div>
      <div id="stats-result"></div>`);

    UI.$$('.stats-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        UI.$$('.stats-tab').forEach(t => t.classList.toggle('active', t === tab));
        AdminView._renderStatsTab(tab.dataset.tab);
      });
    });

    AdminView._renderStatsTab('driver');
  },

  _renderStatsTab(tab) {
    const today = new Date();
    const yy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const firstDay = `${yy}-${mm}-01`;
    const todayStr = UI.fmtDate(today.toISOString());

    const ctrl = document.getElementById('stats-controls');
    if (tab === 'driver') {
      ctrl.innerHTML = `
        <div class="stats-controls">
          <span class="filter-label">기간</span>
          <input type="date" id="st-from" class="filter-input" value="${firstDay}">
          <span class="text-muted">~</span>
          <input type="date" id="st-to" class="filter-input" value="${todayStr}">
          <button class="btn btn-primary btn-sm" id="st-query">조회</button>
          <button class="btn btn-ghost btn-sm" id="st-csv">CSV 내보내기</button>
        </div>`;
      document.getElementById('st-query').onclick = () => AdminView._loadDriverStats();
      document.getElementById('st-csv').onclick   = () => AdminView._exportCsv('driver');
      AdminView._loadDriverStats();
    } else if (tab === 'daily') {
      ctrl.innerHTML = `
        <div class="stats-controls">
          <span class="filter-label">연도</span>
          <input type="number" id="st-year" class="filter-input" value="${yy}" min="2020" max="2099" style="max-width:90px">
          <span class="filter-label">월</span>
          <input type="number" id="st-month" class="filter-input" value="${+mm}" min="1" max="12" style="max-width:70px">
          <button class="btn btn-primary btn-sm" id="st-query">조회</button>
          <button class="btn btn-ghost btn-sm" id="st-csv">CSV 내보내기</button>
        </div>`;
      document.getElementById('st-query').onclick = () => AdminView._loadDailyStats();
      document.getElementById('st-csv').onclick   = () => AdminView._exportCsv('daily');
      AdminView._loadDailyStats();
    } else {
      ctrl.innerHTML = `
        <div class="stats-controls">
          <span class="filter-label">연도</span>
          <input type="number" id="st-year" class="filter-input" value="${yy}" min="2020" max="2099" style="max-width:90px">
          <button class="btn btn-primary btn-sm" id="st-query">조회</button>
          <button class="btn btn-ghost btn-sm" id="st-csv">CSV 내보내기</button>
        </div>`;
      document.getElementById('st-query').onclick = () => AdminView._loadMonthlyStats();
      document.getElementById('st-csv').onclick   = () => AdminView._exportCsv('monthly');
      AdminView._loadMonthlyStats();
    }
  },

  async _loadDriverStats() {
    const from = document.getElementById('st-from')?.value;
    const to   = document.getElementById('st-to')?.value;
    try {
      const data = await Api.getDriverStats(
        from ? new Date(from).toISOString() : '',
        to   ? new Date(to + 'T23:59:59').toISOString() : ''
      );
      AdminView._renderStatsTable(data, ['기사명','카테고리','건수'], r => [r.driverName, r.category, r.count]);
    } catch(e) { UI.toast(e.message || '통계 조회 실패', 'error'); }
  },

  async _loadDailyStats() {
    const year  = +document.getElementById('st-year')?.value;
    const month = +document.getElementById('st-month')?.value;
    try {
      const data = await Api.getDailyStats(year, month);
      AdminView._renderStatsTable(data, ['날짜','카테고리','건수'], r => [r.date, r.category, r.count]);
    } catch(e) { UI.toast(e.message || '통계 조회 실패', 'error'); }
  },

  async _loadMonthlyStats() {
    const year = +document.getElementById('st-year')?.value;
    try {
      const data = await Api.getMonthlyStats(year);
      AdminView._renderStatsTable(data, ['월','카테고리','건수'], r => [r.month, r.category, r.count]);
    } catch(e) { UI.toast(e.message || '통계 조회 실패', 'error'); }
  },

  _renderStatsTable(data, headers, rowFn) {
    const result = document.getElementById('stats-result');
    if (!data.length) {
      result.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">데이터가 없습니다.</div></div>`;
      return;
    }
    const total = data.reduce((s, r) => s + r.count, 0);
    const rows = data.map(r => `<tr>${rowFn(r).map(c => `<td>${UI.escHtml(String(c))}</td>`).join('')}</tr>`).join('');
    result.innerHTML = `
      <div class="section-header" style="margin-top:1rem">
        <div class="section-title">총 ${total}건</div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    AdminView._lastData = data; AdminView._lastHeaders = headers; AdminView._lastRowFn = rowFn;
  },

  _exportCsv(type) {
    if (!AdminView._lastData?.length) { UI.toast('조회 결과가 없습니다.', 'warning'); return; }
    const lines = [AdminView._lastHeaders.join(',')];
    AdminView._lastData.forEach(r => {
      lines.push(AdminView._lastRowFn(r).map(c => `"${String(c).replace(/"/g,'""')}"`).join(','));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `statistics_${type}_${UI.fmtDate(new Date().toISOString())}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    UI.toast('CSV 파일이 다운로드됩니다.', 'success');
  },
};

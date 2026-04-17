/* ============================================================
   ADMIN.JS — 관리자: 전체주문 · 상품CRUD · 기사CRUD · 통계
   ============================================================ */

const AdminView = {
  _session: null,

  init(session) {
    AdminView._session = session;
    Router.register('all-orders',      () => Floor1View.showAllOrders());
    Router.register('manage-users',    () => AdminView.showUsers());
    Router.register('manage-products', () => AdminView.showProducts());
    Router.register('manage-drivers',  () => AdminView.showDrivers());
    Router.register('statistics',      () => AdminView.showStats());
    Router.default('all-orders');
  },

  /* ── 사용자 관리 (승인/역할/활성) ─────────────────────────── */
  showUsers() {
    UI.setFilter(`
      <div class="filter-area-inner">
        <span class="filter-label">사용자 관리</span>
        <label style="margin-left:1rem;display:inline-flex;align-items:center;gap:0.3rem">
          <input type="checkbox" id="u-only-pending" style="transform:scale(1.1)"> 승인 대기만
        </label>
      </div>`);
    const rerender = () => {
      const onlyPending = document.getElementById('u-only-pending')?.checked;
      const all = Store.getUsers();
      const list = onlyPending ? all.filter(u => !u.isApproved) : all;
      UI.setMain(AdminView._renderUserTable(list));
      AdminView._bindUserActions(list);
    };
    rerender();
    document.getElementById('u-only-pending')?.addEventListener('change', rerender);
    /* 사용자 데이터 갱신 시 자동 재렌더 */
    AdminView._userUnsub?.();
    AdminView._userUnsub = Store.onUpdate('users', rerender);
  },

  _renderUserTable(users) {
    const roleBadge = (r) => {
      if (!r) return '<span class="text-muted">—</span>';
      const labels = { admin: '관리자', floor1: '1층 제작', floor2: '2층 수주', driver: '배송기사' };
      return `<span class="badge badge-role">${labels[r] || r}</span>`;
    };
    const rows = users.map(u => `
      <tr data-id="${u.id}">
        <td class="td-dname">${UI.escHtml(u.displayName || '-')}</td>
        <td>${UI.escHtml(u.username || '-')}</td>
        <td>${roleBadge(u.role)}</td>
        <td>${u.isApproved ? '<span class="badge status-complete">승인</span>' : '<span class="badge status-warning" style="background:#fef3c7;color:#92400e">대기</span>'}</td>
        <td>${u.isActive !== false ? '<span class="badge status-complete">활성</span>' : '<span class="badge status-cancel">비활성</span>'}</td>
        <td>
          <div class="td-actions">
            ${!u.isApproved ? `
              <select class="inline-input u-role-sel" data-id="${u.id}" style="max-width:130px;font-size:0.8rem">
                <option value="floor2">2층 수주</option>
                <option value="floor1">1층 제작</option>
                <option value="driver">배송기사</option>
                <option value="admin">관리자</option>
              </select>
              <button class="btn btn-success btn-xs u-approve" data-id="${u.id}">승인</button>` : ''}
            <button class="btn btn-secondary btn-xs u-role" data-id="${u.id}">역할변경</button>
            <button class="btn ${u.isActive !== false ? 'btn-danger' : 'btn-success'} btn-xs u-toggle" data-id="${u.id}">
              ${u.isActive !== false ? '비활성' : '활성'}
            </button>
            <button class="btn btn-danger btn-xs u-delete" data-id="${u.id}" data-name="${UI.escHtml(u.displayName || u.username || '')}">삭제</button>
          </div>
        </td>
      </tr>`).join('');

    const pending = users.filter(u => !u.isApproved).length;
    return `
      <div class="section-header">
        <div><div class="section-title">사용자</div><div class="section-sub">${users.length}명 · 승인 대기 ${pending}명</div></div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>표시 이름</th><th>아이디</th><th>역할</th><th>승인</th><th>활성</th><th>관리</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  _bindUserActions(users) {
    /* 승인 */
    document.querySelectorAll('.u-approve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.id;
        const sel = document.querySelector(`.u-role-sel[data-id="${uid}"]`);
        const role = sel?.value || 'floor2';
        try {
          await Api.approveUser(uid, role);
          UI.toast('승인되었습니다.', 'success');
        } catch (e) { UI.toast(e.message || '승인 실패', 'error'); }
      });
    });
    /* 역할 변경 */
    document.querySelectorAll('.u-role').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.id;
        const u = users.find(x => x.id === uid);
        const overlay = UI.modal({
          title: `역할 변경 — ${UI.escHtml(u?.displayName || '')}`,
          content: `
            <div class="form-group">
              <label class="form-label">역할</label>
              <select id="ur-sel" class="form-control">
                <option value="floor2" ${u?.role==='floor2'?'selected':''}>2층 수주</option>
                <option value="floor1" ${u?.role==='floor1'?'selected':''}>1층 제작</option>
                <option value="driver" ${u?.role==='driver'?'selected':''}>배송기사</option>
                <option value="admin"  ${u?.role==='admin' ?'selected':''}>관리자</option>
              </select>
            </div>`,
          confirmText: '저장', cancelText: '취소',
        });
        overlay.querySelector('.modal-confirm').addEventListener('click', async () => {
          const newRole = document.getElementById('ur-sel').value;
          try {
            await Api.updateUser(uid, { role: newRole });
            UI.toast('역할이 변경되었습니다.', 'success');
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
          } catch (e) { UI.toast(e.message || '변경 실패', 'error'); }
        });
      });
    });
    /* 활성/비활성 */
    document.querySelectorAll('.u-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.id;
        const u = users.find(x => x.id === uid);
        const next = !(u?.isActive !== false);
        try {
          await Api.toggleUserActive(uid, next);
          UI.toast(next ? '활성화되었습니다.' : '비활성화되었습니다.', 'success');
        } catch (e) { UI.toast(e.message || '변경 실패', 'error'); }
      });
    });
    /* 삭제 */
    document.querySelectorAll('.u-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.id;
        const name = btn.dataset.name;
        const overlay = UI.modal({
          title: '사용자 삭제',
          content: `
            <p><strong>${UI.escHtml(name)}</strong> 계정을 삭제하시겠습니까?</p>
            <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:0.75rem;margin-top:0.75rem;font-size:0.82rem;color:#92400e;line-height:1.5">
              ⚠️ DB 레코드만 삭제됩니다.<br>
              해당 아이디로 <strong>재가입을 허용</strong>하려면
              <a href="https://console.firebase.google.com/project/mayflower-5c9dd/authentication/users" target="_blank" style="color:#b45309;font-weight:600">Firebase Console → Authentication</a>
              에서 Auth 계정도 함께 삭제해야 합니다.
            </div>`,
          confirmText: '삭제', cancelText: '취소',
        });
        overlay.querySelector('.modal-confirm').style.cssText = 'background:#ef4444;border-color:#ef4444';
        overlay.querySelector('.modal-confirm').addEventListener('click', async () => {
          try {
            await Api.deleteUser(uid);
            UI.toast('사용자가 삭제되었습니다.', 'success');
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
          } catch (e) { UI.toast(e.message || '삭제 실패', 'error'); }
        });
      });
    });
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
    const doAddCat = async () => {
      const name = newCatInput.value.trim();
      if (!name) { UI.toast('카테고리명을 입력해 주세요.', 'warning'); return; }
      try {
        await Api.createCategory(name);
        UI.toast(`"${name}" 카테고리가 추가되었습니다.`, 'success');
        AdminView.showProducts();
      } catch (e) { UI.toast(e.message || '추가 실패', 'error'); }
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
        try {
          await Api.renameCategory(old, newName.trim());
          UI.toast('카테고리 이름이 변경되었습니다.', 'success');
          AdminView.showProducts();
        } catch (e) { UI.toast(e.message || '이름 변경 실패', 'error'); }
      });
    });

    /* ── 카테고리: 삭제 ── */
    document.querySelectorAll('.cat-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.cat;
        const ok = await UI.confirm(`"${name}" 카테고리를 삭제할까요?`, '카테고리 삭제');
        if (!ok) return;
        try {
          await Api.deleteCategory(name);
          UI.toast('카테고리가 삭제되었습니다.', 'success');
          AdminView.showProducts();
        } catch (e) { UI.toast(e.message || '삭제 실패', 'error'); }
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
        const id = btn.dataset.id;
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
        const id = btn.dataset.id;
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
        const id = btn.dataset.id;
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

  /* linkedUserId 로 연결된 계정 검색 */
  _findLinkedUser(driver, driverUsers) {
    if (!driver.linkedUserId) return null;
    return driverUsers.find(u => u.id === driver.linkedUserId) || null;
  },

  _renderDriverTable(drivers, driverUsers) {
    const rows = drivers.map(d => {
      const linked = AdminView._findLinkedUser(d, driverUsers);
      const loginId = linked ? UI.escHtml(linked.username) : '<span class="text-muted">미설정</span>';
      return `
        <tr data-id="${d.id}">
          <td title="${d.id}">${UI.escHtml(String(d.id).slice(0, 8))}…</td>
          <td class="td-dname">${UI.escHtml(d.name)}</td>
          <td class="td-dphone">${UI.escHtml(d.phone || '-')}</td>
          <td>${loginId}</td>
          <td>${d.isActive ? '<span class="badge status-complete">활성</span>' : '<span class="badge status-cancel">비활성</span>'}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-secondary btn-xs d-edit" data-id="${d.id}">수정</button>
              <button class="btn btn-secondary btn-xs d-cred" data-id="${d.id}" title="기사 계정 연결">🔗 계정 연결</button>
              <button class="btn btn-danger btn-xs d-delete" data-id="${d.id}" ${!d.isActive?'disabled':''}>삭제</button>
              ${!d.isActive ? `<button class="btn btn-success btn-xs d-restore" data-id="${d.id}">복원</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="section-header">
        <div><div class="section-title">기사 목록</div><div class="section-sub">${drivers.filter(d=>d.isActive).length}명 활성 · 기사 계정은 모바일 앱 회원가입 후 승인 → 여기서 연결</div></div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>이름</th><th>연락처</th><th>로그인 아이디</th><th>상태</th><th>관리</th></tr></thead>
          <tbody id="driver-tbody">${rows}</tbody>
        </table>
        <div class="add-row-form">
          <input type="text" id="new-driver-name"  class="inline-input" placeholder="이름"            style="max-width:140px">
          <input type="tel"  id="new-driver-phone" class="inline-input" placeholder="010-0000-0000"   style="max-width:160px">
          <button class="btn btn-primary btn-sm" id="btn-add-driver">+ 기사 추가</button>
        </div>
      </div>`;
  },

  _bindDriverActions(drivers, driverUsers) {
    /* ── 추가 ── */
    document.getElementById('btn-add-driver').addEventListener('click', async () => {
      const name  = document.getElementById('new-driver-name').value.trim();
      const phone = document.getElementById('new-driver-phone').value.trim();
      if (!name) { UI.toast('이름을 입력해 주세요.', 'warning'); return; }
      try {
        await Api.createDriver({ name, phone });
        UI.toast(`"${name}" 기사가 추가되었습니다.`, 'success');
        AdminView.showDrivers();
      } catch(e) { UI.toast(e.message || '추가 실패', 'error'); }
    });

    /* ── 이름·연락처 수정 ── */
    document.querySelectorAll('.d-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
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
            await Api.updateDriver(id, { name: newName, phone: newPhone });
            UI.toast('수정되었습니다.', 'success');
            overlay.classList.remove('show');
            setTimeout(() => { overlay.remove(); AdminView.showDrivers(); }, 300);
          } catch(e) { UI.toast(e.message || '수정 실패', 'error'); }
        });
      });
    });

    /* ── 기사 계정 연결 (driver role + 승인된 user 를 드롭다운으로 선택) ── */
    document.querySelectorAll('.d-cred').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const d  = drivers.find(x => x.id === id);
        if (!d) return;
        const approved = driverUsers.filter(u => u.isApproved);
        /* 다른 기사에 이미 연결된 uid 는 제외 */
        const takenUids = new Set(drivers.filter(x => x.id !== id && x.linkedUserId).map(x => x.linkedUserId));
        const options = approved
          .filter(u => !takenUids.has(u.id))
          .map(u => `<option value="${u.id}" ${u.id === d.linkedUserId ? 'selected' : ''}>${UI.escHtml(u.displayName)} (${UI.escHtml(u.username)})</option>`)
          .join('');

        const overlay = UI.modal({
          title:       `🔗 계정 연결 — ${UI.escHtml(d.name)}`,
          content: `
            <div class="form-group">
              <label class="form-label">연결할 기사 계정</label>
              <select id="cred-link" class="form-control">
                <option value="">— 해제 —</option>
                ${options}
              </select>
              <p class="text-muted" style="font-size:0.82rem;margin-top:0.5rem">
                드롭다운 항목은 <strong>모바일 앱에서 회원가입 → 관리자가 driver 로 승인</strong>한 계정입니다.
                연결이 없으면 이 기사 레코드는 로그인 계정과 매핑되지 않습니다.
              </p>
            </div>`,
          confirmText: '저장',
          cancelText:  '취소',
        });

        overlay.querySelector('.modal-confirm').addEventListener('click', async () => {
          const uid = document.getElementById('cred-link').value || null;
          try {
            await Api.updateDriver(id, { linkedUserId: uid });
            UI.toast(uid ? '계정이 연결되었습니다.' : '연결이 해제되었습니다.', 'success');
            overlay.classList.remove('show');
            setTimeout(() => { overlay.remove(); AdminView.showDrivers(); }, 300);
          } catch(e) { UI.toast(e.message || '처리 실패', 'error'); }
        });
      });
    });

    /* ── 삭제 ── */
    document.querySelectorAll('.d-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
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
        const id = btn.dataset.id;
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

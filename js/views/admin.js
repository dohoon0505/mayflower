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
    const rows = products.map(p => `
      <tr data-id="${p.id}">
        <td>${p.id}</td>
        <td class="td-name">${UI.escHtml(p.name)}</td>
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
        <div><div class="section-title">상품 목록</div><div class="section-sub">${products.filter(p=>p.isActive).length}개 활성</div></div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>상품명</th><th>상태</th><th>관리</th></tr></thead>
          <tbody id="product-tbody">${rows}</tbody>
        </table>
        <div class="add-row-form">
          <input type="text" id="new-product-name" class="inline-input" placeholder="새 상품명" style="max-width:220px">
          <button class="btn btn-primary btn-sm" id="btn-add-product">+ 상품 추가</button>
        </div>
      </div>`;
  },

  _bindProductActions(products) {
    /* 추가 */
    document.getElementById('btn-add-product').addEventListener('click', async () => {
      const nameEl = document.getElementById('new-product-name');
      const name = nameEl.value.trim();
      if (!name) { UI.toast('상품명을 입력해 주세요.', 'warning'); return; }
      try {
        await Api.createProduct({ name });
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
        const td = btn.closest('tr').querySelector('.td-name');
        const oldName = p.name;
        td.innerHTML = `<input type="text" class="inline-input" id="edit-p-${id}" value="${UI.escHtml(oldName)}" style="max-width:200px">`;
        const input = document.getElementById(`edit-p-${id}`);
        input.focus(); input.select();
        btn.textContent = '저장';
        btn.onclick = async () => {
          const newName = input.value.trim();
          if (!newName) { UI.toast('상품명을 입력해 주세요.', 'warning'); return; }
          try {
            await Api.updateProduct(id, { name: newName, isActive: p.isActive });
            UI.toast('상품명이 수정되었습니다.', 'success');
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
          await Api.updateProduct(id, { name: p.name, isActive: true });
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
      UI.setMain(AdminView._renderDriverTable(drivers));
      AdminView._bindDriverActions(drivers);
    } catch(e) {
      UI.toast(e.message || '조회 실패', 'error');
    } finally { UI.loading(false); }
  },

  _renderDriverTable(drivers) {
    const rows = drivers.map(d => `
      <tr data-id="${d.id}">
        <td>${d.id}</td>
        <td class="td-dname">${UI.escHtml(d.name)}</td>
        <td class="td-dphone">${UI.escHtml(d.phone || '-')}</td>
        <td>${d.isActive ? '<span class="badge status-complete">활성</span>' : '<span class="badge status-cancel">비활성</span>'}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-secondary btn-xs d-edit" data-id="${d.id}">수정</button>
            <button class="btn btn-danger btn-xs d-delete" data-id="${d.id}" ${!d.isActive?'disabled':''}>삭제</button>
            ${!d.isActive ? `<button class="btn btn-success btn-xs d-restore" data-id="${d.id}">복원</button>` : ''}
          </div>
        </td>
      </tr>`).join('');

    return `
      <div class="section-header">
        <div><div class="section-title">기사 목록</div><div class="section-sub">${drivers.filter(d=>d.isActive).length}명 활성</div></div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>이름</th><th>연락처</th><th>상태</th><th>관리</th></tr></thead>
          <tbody id="driver-tbody">${rows}</tbody>
        </table>
        <div class="add-row-form">
          <input type="text" id="new-driver-name" class="inline-input" placeholder="이름" style="max-width:120px">
          <input type="tel" id="new-driver-phone" class="inline-input" placeholder="010-0000-0000" style="max-width:150px">
          <button class="btn btn-primary btn-sm" id="btn-add-driver">+ 기사 추가</button>
        </div>
      </div>`;
  },

  _bindDriverActions(drivers) {
    /* 추가 */
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

    /* 수정 */
    document.querySelectorAll('.d-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = +btn.dataset.id;
        const d = drivers.find(x => x.id === id);
        if (!d) return;
        const tr = btn.closest('tr');
        tr.querySelector('.td-dname').innerHTML  = `<input class="inline-input" id="edit-dn-${id}" value="${UI.escHtml(d.name)}" style="max-width:100px">`;
        tr.querySelector('.td-dphone').innerHTML = `<input class="inline-input" id="edit-dp-${id}" value="${UI.escHtml(d.phone||'')}" style="max-width:130px">`;
        btn.textContent = '저장';
        btn.onclick = async () => {
          const newName  = document.getElementById(`edit-dn-${id}`).value.trim();
          const newPhone = document.getElementById(`edit-dp-${id}`).value.trim();
          if (!newName) { UI.toast('이름을 입력해 주세요.', 'warning'); return; }
          try {
            await Api.updateDriver(id, { name: newName, phone: newPhone, isActive: d.isActive });
            UI.toast('수정되었습니다.', 'success');
            AdminView.showDrivers();
          } catch(e) { UI.toast(e.message || '수정 실패', 'error'); }
        };
      });
    });

    /* 삭제 */
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

    /* 복원 */
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
      AdminView._renderStatsTable(data, ['기사명','상품','건수'], r => [r.driverName, r.productName, r.count]);
    } catch(e) { UI.toast(e.message || '통계 조회 실패', 'error'); }
  },

  async _loadDailyStats() {
    const year  = +document.getElementById('st-year')?.value;
    const month = +document.getElementById('st-month')?.value;
    try {
      const data = await Api.getDailyStats(year, month);
      AdminView._renderStatsTable(data, ['날짜','상품','건수'], r => [r.date, r.productName, r.count]);
    } catch(e) { UI.toast(e.message || '통계 조회 실패', 'error'); }
  },

  async _loadMonthlyStats() {
    const year = +document.getElementById('st-year')?.value;
    try {
      const data = await Api.getMonthlyStats(year);
      AdminView._renderStatsTable(data, ['월','상품','건수'], r => [r.month, r.productName, r.count]);
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

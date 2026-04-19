/* ============================================================
   LEDGER.JS — 수주 장부 (floor1 / admin)

   RTDB 경로: /orderLedger/{id}
     - client    : 거래처
     - product   : 'funeral' | 'congrats' (근조화환 | 축하화환)
     - location  : 장소
     - quantity  : 수량
     - createdAt / createdBy / createdByName / updatedAt

   UI:
     [필터] 날짜(전체/오늘/어제/이번달/저번달) · 상품(전체/근조화환/축하화환)
     [간편추가] 거래처 | 상품 토글 | 장소 | 수량 | + 등록
     [리스트] 날짜 / 거래처 / 상품 / 장소 / 수량 / 수정·삭제

   라우트:  'order-ledger'
   ============================================================ */

const LedgerView = {
  _session: null,
  _inited:  false,
  _bound:   false,

  _filter: {
    date:    'all',     /* 'all' | 'today' | 'yesterday' | 'this-month' | 'last-month' */
    product: 'all',     /* 'all' | 'funeral' | 'congrats' */
  },

  PRODUCT_LABEL: {
    funeral:  '근조화환',
    congrats: '축하화환',
  },

  init(session) {
    if (LedgerView._inited) return;
    LedgerView._session = session;
    Router.register('order-ledger', () => LedgerView.showLedger());
    /* 수주 장부 변경 시 현재 뷰면 리렌더 */
    if (Store.onUpdate) {
      Store.onUpdate('ledger', () => {
        if (document.querySelector('[data-view="ledger"]')) LedgerView._renderList();
      });
    }
    LedgerView._inited = true;
  },

  /* ── 날짜 범위 계산 ─────────────────────────────────────── */
  _dateRange(key) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
    const endOfDay   = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);

    if (key === 'today') {
      return { from: startOfDay(now), to: endOfDay(now) };
    }
    if (key === 'yesterday') {
      const yd = new Date(y, m, d - 1);
      return { from: startOfDay(yd), to: endOfDay(yd) };
    }
    if (key === 'this-month') {
      const first = new Date(y, m, 1, 0, 0, 0, 0);
      const last  = new Date(y, m + 1, 0, 23, 59, 59, 999);
      return { from: first, to: last };
    }
    if (key === 'last-month') {
      const first = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const last  = new Date(y, m, 0, 23, 59, 59, 999);
      return { from: first, to: last };
    }
    return null; /* 전체 */
  },

  /* ── 필터링 ─────────────────────────────────────────────── */
  _getFiltered() {
    const all = (Store.getLedger ? Store.getLedger() : []) || [];
    const { date, product } = LedgerView._filter;

    const range = LedgerView._dateRange(date);
    return all.filter(e => {
      if (product !== 'all' && e.product !== product) return false;
      if (range) {
        if (!e.createdAt) return false;
        const t = new Date(e.createdAt).getTime();
        if (isNaN(t)) return false;
        if (t < range.from.getTime() || t > range.to.getTime()) return false;
      }
      return true;
    });
  },

  /* ── Render: shell + filter + quick-add ────────────────── */
  showLedger() {
    UI.setFilter(`
      <div class="filter-section">
        <div class="filter-row">
          <span class="filter-label">조회 기간</span>
          <div class="status-tab-group" id="lg-date-tabs">
            <button class="status-tab-btn ${LedgerView._filter.date === 'all' ? 'active' : ''}"        data-date="all">전체</button>
            <button class="status-tab-btn ${LedgerView._filter.date === 'today' ? 'active' : ''}"      data-date="today">오늘</button>
            <button class="status-tab-btn ${LedgerView._filter.date === 'yesterday' ? 'active' : ''}"  data-date="yesterday">어제</button>
            <button class="status-tab-btn ${LedgerView._filter.date === 'this-month' ? 'active' : ''}" data-date="this-month">이번달</button>
            <button class="status-tab-btn ${LedgerView._filter.date === 'last-month' ? 'active' : ''}" data-date="last-month">저번달</button>
          </div>
          <div class="filter-divider"></div>
          <span class="filter-label">상품</span>
          <div class="status-tab-group" id="lg-product-tabs">
            <button class="status-tab-btn ${LedgerView._filter.product === 'all' ? 'active' : ''}"      data-product="all">전체</button>
            <button class="status-tab-btn ${LedgerView._filter.product === 'funeral' ? 'active' : ''}"  data-product="funeral">근조화환</button>
            <button class="status-tab-btn ${LedgerView._filter.product === 'congrats' ? 'active' : ''}" data-product="congrats">축하화환</button>
          </div>
        </div>
      </div>`);

    UI.setMain(`
      <div data-view="ledger">

        <div class="section-header">
          <div>
            <div class="section-title">간편 추가</div>
            <div class="section-sub">거래처 · 상품 · 장소 · 수량을 입력하고 + 등록</div>
          </div>
        </div>
        <div class="ledger-add-box">
          <div class="ledger-add-grid">
            <div class="ledger-add-field">
              <label class="ledger-add-label">거래처</label>
              <input type="text" class="inline-input" id="lg-in-client" placeholder="예: 우리꽃집" maxlength="40">
            </div>
            <div class="ledger-add-field">
              <label class="ledger-add-label">상품</label>
              <div class="ledger-radio-group" id="lg-in-product">
                <label class="ledger-radio">
                  <input type="radio" name="lg-product" value="funeral" checked>
                  <span>근조화환</span>
                </label>
                <label class="ledger-radio">
                  <input type="radio" name="lg-product" value="congrats">
                  <span>축하화환</span>
                </label>
              </div>
            </div>
            <div class="ledger-add-field">
              <label class="ledger-add-label">장소</label>
              <input type="text" class="inline-input" id="lg-in-location" placeholder="예: 남대구장례식장" maxlength="60">
            </div>
            <div class="ledger-add-field ledger-add-qty">
              <label class="ledger-add-label">수량</label>
              <input type="number" class="inline-input" id="lg-in-qty" min="1" step="1" value="1">
            </div>
            <div class="ledger-add-field ledger-add-actions">
              <button class="btn btn-primary" id="lg-add-btn">+ 등록</button>
            </div>
          </div>
        </div>

        <div class="section-header" style="margin-top:1.25rem">
          <div>
            <div class="section-title">수주 장부</div>
            <div class="section-sub" id="lg-list-sub">0건</div>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="ledger-table">
            <thead>
              <tr>
                <th style="width:140px">일시</th>
                <th>거래처</th>
                <th style="width:120px">상품</th>
                <th>장소</th>
                <th style="width:80px;text-align:right">수량</th>
                <th style="width:140px">작성자</th>
                <th style="width:150px">관리</th>
              </tr>
            </thead>
            <tbody id="lg-tbody"></tbody>
          </table>
        </div>

      </div>`);

    LedgerView._bindFilters();
    LedgerView._bindAddForm();
    LedgerView._renderList();
  },

  /* ── Filters ───────────────────────────────────────────── */
  _bindFilters() {
    const dateTabs = document.getElementById('lg-date-tabs');
    if (dateTabs) {
      dateTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.status-tab-btn');
        if (!btn) return;
        dateTabs.querySelectorAll('.status-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        LedgerView._filter.date = btn.dataset.date || 'all';
        LedgerView._renderList();
      });
    }
    const prodTabs = document.getElementById('lg-product-tabs');
    if (prodTabs) {
      prodTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.status-tab-btn');
        if (!btn) return;
        prodTabs.querySelectorAll('.status-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        LedgerView._filter.product = btn.dataset.product || 'all';
        LedgerView._renderList();
      });
    }
  },

  /* ── Quick-add ─────────────────────────────────────────── */
  _bindAddForm() {
    const addBtn    = document.getElementById('lg-add-btn');
    const clientEl  = document.getElementById('lg-in-client');
    const locEl     = document.getElementById('lg-in-location');
    const qtyEl     = document.getElementById('lg-in-qty');
    if (!addBtn) return;

    const submit = async () => {
      const client   = (clientEl?.value || '').trim();
      const location = (locEl?.value || '').trim();
      const quantity = parseInt(qtyEl?.value, 10) || 0;
      const product  = document.querySelector('#lg-in-product input[name="lg-product"]:checked')?.value || 'funeral';

      if (!client)   { UI.toast('거래처를 입력해 주세요.', 'warning'); clientEl?.focus(); return; }
      if (!location) { UI.toast('장소를 입력해 주세요.',  'warning'); locEl?.focus();    return; }
      if (quantity <= 0) { UI.toast('수량을 1 이상으로 입력해 주세요.', 'warning'); qtyEl?.focus(); return; }

      addBtn.disabled = true;
      const prevText = addBtn.textContent;
      addBtn.textContent = '등록 중...';
      try {
        await Api.createLedgerEntry({ client, product, location, quantity });
        UI.toast('수주 장부에 등록되었습니다.', 'success');
        /* 입력 초기화 (상품 선택은 유지) */
        if (clientEl) clientEl.value = '';
        if (locEl)    locEl.value    = '';
        if (qtyEl)    qtyEl.value    = '1';
        clientEl?.focus();
      } catch (e) {
        UI.toast(e.message || '등록 실패', 'error');
      } finally {
        addBtn.disabled = false;
        addBtn.textContent = prevText;
      }
    };
    addBtn.addEventListener('click', submit);

    /* 엔터키: client / location / qty 에서 submit */
    [clientEl, locEl, qtyEl].forEach(el => {
      if (!el) return;
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
    });
  },

  /* ── List ──────────────────────────────────────────────── */
  _renderList() {
    const tbody = document.getElementById('lg-tbody');
    const sub   = document.getElementById('lg-list-sub');
    if (!tbody) return;

    const list = LedgerView._getFiltered();
    if (sub) sub.textContent = `${list.length}건`;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="ledger-empty">조회된 내역이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(e => {
      const ts       = UI.fmtDatetime(e.createdAt);
      const prodCls  = e.product === 'funeral' ? 'badge-product-funeral' : 'badge-product-congrats';
      const prodLbl  = LedgerView.PRODUCT_LABEL[e.product] || '-';
      const qty      = Number(e.quantity || 0);
      const creator  = e.createdByName || '-';
      return `
        <tr data-id="${UI.escHtml(e.id)}">
          <td>${ts}</td>
          <td class="td-client">${UI.escHtml(e.client || '')}</td>
          <td class="td-product"><span class="badge ${prodCls}">${prodLbl}</span></td>
          <td class="td-location">${UI.escHtml(e.location || '')}</td>
          <td class="td-qty" style="text-align:right">${qty}개</td>
          <td class="td-creator">${UI.escHtml(creator)}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-secondary btn-xs lg-edit"   data-id="${UI.escHtml(e.id)}">수정</button>
              <button class="btn btn-danger btn-xs lg-delete"    data-id="${UI.escHtml(e.id)}">삭제</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    LedgerView._bindRowActions();
  },

  _bindRowActions() {
    /* 수정 */
    document.querySelectorAll('.lg-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const e  = Store.getLedgerById(id);
        if (!e) return;
        LedgerView._openEditModal(e);
      });
    });
    /* 삭제 */
    document.querySelectorAll('.lg-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const e  = Store.getLedgerById(id);
        if (!e) return;
        const ok = await UI.confirm(
          `"${e.client || ''}" / ${LedgerView.PRODUCT_LABEL[e.product] || '-'} / ${e.location || ''} / ${e.quantity || 0}개\n삭제할까요?`,
          '수주 장부 삭제'
        );
        if (!ok) return;
        try {
          await Api.deleteLedgerEntry(id);
          UI.toast('삭제되었습니다.', 'success');
        } catch (err) {
          UI.toast(err.message || '삭제 실패', 'error');
        }
      });
    });
  },

  _openEditModal(e) {
    const content = `
      <div class="form-group">
        <label for="lg-ed-client">거래처</label>
        <input type="text" id="lg-ed-client" class="form-control" maxlength="40" value="${UI.escHtml(e.client || '')}">
      </div>
      <div class="form-group">
        <label>상품</label>
        <div class="ledger-radio-group" id="lg-ed-product">
          <label class="ledger-radio">
            <input type="radio" name="lg-ed-product" value="funeral" ${e.product === 'funeral' ? 'checked' : ''}>
            <span>근조화환</span>
          </label>
          <label class="ledger-radio">
            <input type="radio" name="lg-ed-product" value="congrats" ${e.product === 'congrats' ? 'checked' : ''}>
            <span>축하화환</span>
          </label>
        </div>
      </div>
      <div class="form-group">
        <label for="lg-ed-location">장소</label>
        <input type="text" id="lg-ed-location" class="form-control" maxlength="60" value="${UI.escHtml(e.location || '')}">
      </div>
      <div class="form-group">
        <label for="lg-ed-qty">수량</label>
        <input type="number" id="lg-ed-qty" class="form-control" min="1" step="1" value="${Number(e.quantity || 1)}">
      </div>`;

    const overlay = UI.modal({
      title: '✏️ 수주 장부 수정',
      content,
      confirmText: '저장',
      cancelText: '닫기',
      onConfirm: async (ov) => {
        const client   = (ov.querySelector('#lg-ed-client')?.value || '').trim();
        const location = (ov.querySelector('#lg-ed-location')?.value || '').trim();
        const quantity = parseInt(ov.querySelector('#lg-ed-qty')?.value, 10) || 0;
        const product  = ov.querySelector('#lg-ed-product input[name="lg-ed-product"]:checked')?.value || e.product;

        if (!client)   { UI.toast('거래처를 입력해 주세요.', 'warning'); return; }
        if (!location) { UI.toast('장소를 입력해 주세요.',  'warning'); return; }
        if (quantity <= 0) { UI.toast('수량을 1 이상으로 입력해 주세요.', 'warning'); return; }

        try {
          await Api.updateLedgerEntry(e.id, { client, product, location, quantity });
          UI.toast('수정되었습니다.', 'success');
        } catch (err) {
          UI.toast(err.message || '수정 실패', 'error');
        }
      },
    });

    requestAnimationFrame(() => {
      overlay.querySelector('#lg-ed-client')?.focus();
    });
  },
};

window.LedgerView = LedgerView;

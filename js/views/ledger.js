/* ============================================================
   LEDGER.JS — 수바리 장부 (floor1 / admin)

   RTDB 경로: /orderLedger/{id}
     - client    : 거래처
     - product   : 'funeral' | 'congrats' (근조화환 | 축하화환)
     - location  : 장소
     - quantity  : 수량
     - createdAt / createdBy / createdByName / updatedAt

   UI:
     [필터] 날짜(전체/오늘/어제/이번달/저번달) · 상품(전체/근조화환/축하화환)
     [간편추가] 거래처 | 상품 세그먼트 | 장소 | 수량 스텝퍼 | 등록
     [장부]   검색 + 행별 카드형 그리드 (일시/거래처/상품칩/장소/수량/작성자/관리)

   라우트:  'order-ledger'
   ============================================================ */

const LedgerView = {
  _session: null,
  _inited:  false,

  _filter: {
    date:    'all',     /* 'all' | 'today' | 'yesterday' | 'this-month' | 'last-month' */
    product: 'all',     /* 'all' | 'funeral' | 'congrats' */
    query:   '',        /* 자유 검색어 (거래처/장소) */
  },

  PRODUCT_LABEL: {
    funeral:  '근조화환',
    congrats: '축하화환',
  },

  init(session) {
    if (LedgerView._inited) return;
    LedgerView._session = session;
    Router.register('order-ledger', () => LedgerView.showLedger());
    /* 수바리 장부 변경 시 현재 뷰면 리렌더 */
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
    const { date, product, query } = LedgerView._filter;

    const range = LedgerView._dateRange(date);
    const q = String(query || '').trim().toLowerCase();

    return all.filter(e => {
      if (product !== 'all' && e.product !== product) return false;
      if (range) {
        if (!e.createdAt) return false;
        const t = new Date(e.createdAt).getTime();
        if (isNaN(t)) return false;
        if (t < range.from.getTime() || t > range.to.getTime()) return false;
      }
      if (q) {
        const hay = `${e.client || ''} ${e.location || ''} ${LedgerView.PRODUCT_LABEL[e.product] || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  },

  /* ── Render: filter + shell ────────────────────────────── */
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

        <div class="lg-sec-head">
          <div>
            <div class="lg-sec-title">간편 추가</div>
            <div class="lg-sec-sub">거래처 · 상품 · 장소 · 수량을 입력하고 등록</div>
          </div>
        </div>

        <section class="lg-quickadd" aria-label="간편 추가">
          <div class="lg-qa-grid">
            <div class="lg-qa-field">
              <label for="lg-in-client" class="lg-qa-label">거래처 <span class="lg-req">*</span></label>
              <input type="text" id="lg-in-client" class="lg-input" placeholder="예: 우리꽃집" maxlength="40" autocomplete="off">
            </div>
            <div class="lg-qa-field">
              <span class="lg-qa-label">상품 <span class="lg-req">*</span></span>
              <div class="lg-seg" id="lg-in-product" role="radiogroup" aria-label="상품 종류">
                <button type="button" class="lg-seg-btn lg-seg-j on" data-product="funeral"  role="radio" aria-checked="true">근조화환</button>
                <button type="button" class="lg-seg-btn lg-seg-c"    data-product="congrats" role="radio" aria-checked="false">축하화환</button>
              </div>
            </div>
            <div class="lg-qa-field">
              <label for="lg-in-location" class="lg-qa-label">장소 <span class="lg-req">*</span></label>
              <input type="text" id="lg-in-location" class="lg-input" placeholder="예: 남대구장례식장" maxlength="60" autocomplete="off">
            </div>
            <div class="lg-qa-field">
              <span class="lg-qa-label">수량</span>
              <div class="lg-num">
                <button type="button" id="lg-in-dec" class="lg-num-btn" aria-label="수량 감소">−</button>
                <input type="text" id="lg-in-qty" class="lg-num-input" inputmode="numeric" value="1">
                <button type="button" id="lg-in-inc" class="lg-num-btn" aria-label="수량 증가">+</button>
              </div>
            </div>
            <div class="lg-qa-field lg-qa-action">
              <button class="lg-submit-btn" id="lg-add-btn" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                등록
              </button>
            </div>
          </div>
          <div class="lg-qa-hint">
            <span>각 입력창에서 <span class="lg-kbd">Enter</span> 로 빠르게 등록할 수 있습니다.</span>
          </div>
        </section>

        <div class="lg-sec-head lg-sec-head-mt">
          <div>
            <div class="lg-sec-title">수바리 장부</div>
            <div class="lg-sec-sub">등록된 내역을 조회하고 수정 · 삭제할 수 있습니다.</div>
          </div>
          <span class="lg-count-badge"><b id="lg-count-n">0</b> 건</span>
        </div>

        <div class="lg-toolbar">
          <div class="lg-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="lg-search-input" placeholder="거래처, 장소, 상품으로 검색" autocomplete="off" value="${UI.escHtml(LedgerView._filter.query || '')}">
          </div>
        </div>

        <div class="lg-table">
          <div class="lg-row lg-row-head">
            <div>일시</div>
            <div>거래처</div>
            <div>상품</div>
            <div>장소</div>
            <div class="lg-th-qty">수량</div>
            <div></div>
          </div>
          <div id="lg-body"></div>
        </div>

      </div>`);

    LedgerView._bindFilters();
    LedgerView._bindAddForm();
    LedgerView._bindSearch();
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

  _bindSearch() {
    const input = document.getElementById('lg-search-input');
    if (!input) return;
    input.addEventListener('input', (e) => {
      LedgerView._filter.query = e.target.value || '';
      LedgerView._renderList();
    });
  },

  /* ── Quick-add ─────────────────────────────────────────── */
  _bindAddForm() {
    const addBtn    = document.getElementById('lg-add-btn');
    const clientEl  = document.getElementById('lg-in-client');
    const locEl     = document.getElementById('lg-in-location');
    const qtyEl     = document.getElementById('lg-in-qty');
    const decBtn    = document.getElementById('lg-in-dec');
    const incBtn    = document.getElementById('lg-in-inc');
    const segHost   = document.getElementById('lg-in-product');
    if (!addBtn) return;

    /* 세그먼트 토글 */
    segHost?.addEventListener('click', (e) => {
      const btn = e.target.closest('.lg-seg-btn');
      if (!btn) return;
      segHost.querySelectorAll('.lg-seg-btn').forEach(b => {
        b.classList.remove('on');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('on');
      btn.setAttribute('aria-checked', 'true');
    });

    /* 수량 스텝퍼 */
    const setQty = (v) => { qtyEl.value = String(Math.max(1, Math.min(9999, v | 0))); };
    decBtn?.addEventListener('click', () => setQty((parseInt(qtyEl.value, 10) || 1) - 1));
    incBtn?.addEventListener('click', () => setQty((parseInt(qtyEl.value, 10) || 0) + 1));
    qtyEl?.addEventListener('input', () => {
      qtyEl.value = qtyEl.value.replace(/[^\d]/g, '').slice(0, 4);
    });
    qtyEl?.addEventListener('blur', () => {
      if (!qtyEl.value || parseInt(qtyEl.value, 10) < 1) qtyEl.value = '1';
    });

    const submit = async () => {
      const client   = (clientEl?.value || '').trim();
      const location = (locEl?.value || '').trim();
      const quantity = parseInt(qtyEl?.value, 10) || 0;
      const activeSeg = segHost?.querySelector('.lg-seg-btn.on');
      const product  = activeSeg?.dataset.product || 'funeral';

      if (!client)   { UI.toast('거래처를 입력해 주세요.', 'warning'); clientEl?.focus(); return; }
      if (!location) { UI.toast('장소를 입력해 주세요.',  'warning'); locEl?.focus();    return; }
      if (quantity <= 0) { UI.toast('수량을 1 이상으로 입력해 주세요.', 'warning'); qtyEl?.focus(); return; }

      addBtn.disabled = true;
      const prevHTML = addBtn.innerHTML;
      addBtn.textContent = '등록 중...';
      try {
        await Api.createLedgerEntry({ client, product, location, quantity });
        UI.toast('장부에 등록되었습니다.', 'success');
        /* 입력 초기화 (상품 선택은 유지) */
        if (clientEl) clientEl.value = '';
        if (locEl)    locEl.value    = '';
        if (qtyEl)    qtyEl.value    = '1';
        clientEl?.focus();
      } catch (e) {
        UI.toast(e.message || '등록 실패', 'error');
      } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = prevHTML;
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
    const body  = document.getElementById('lg-body');
    const badge = document.getElementById('lg-count-n');
    if (!body) return;

    const list = LedgerView._getFiltered();
    if (badge) badge.textContent = String(list.length);

    if (!list.length) {
      body.innerHTML = `
        <div class="lg-empty">
          <b>기록이 없습니다</b>
          <span>필터 또는 검색 조건을 바꾸거나, 위에서 새로 등록해 주세요.</span>
        </div>`;
      return;
    }

    body.innerHTML = list.map(e => {
      const ts      = UI.fmtDatetime(e.createdAt);
      const chipCls = e.product === 'funeral' ? 'lg-chip-j' : 'lg-chip-c';
      const prodLbl = LedgerView.PRODUCT_LABEL[e.product] || '-';
      const qty     = Number(e.quantity || 0);
      return `
        <div class="lg-row" data-id="${UI.escHtml(e.id)}">
          <div class="lg-c-date">${ts}</div>
          <div class="lg-c-client">${UI.escHtml(e.client || '')}</div>
          <div class="lg-c-product"><span class="lg-chip ${chipCls}">${prodLbl}</span></div>
          <div class="lg-c-location" title="${UI.escHtml(e.location || '')}">${UI.escHtml(e.location || '')}</div>
          <div class="lg-c-qty"><span class="lg-qty-n">${qty}</span><span class="lg-qty-u">개</span></div>
          <div class="lg-c-act">
            <button class="lg-iconbtn lg-edit" data-id="${UI.escHtml(e.id)}" title="수정">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              수정
            </button>
            <button class="lg-iconbtn lg-iconbtn-danger lg-delete" data-id="${UI.escHtml(e.id)}" title="삭제">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              삭제
            </button>
          </div>
        </div>`;
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
          '수바리 장부 삭제'
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
        <div class="lg-seg" id="lg-ed-product" role="radiogroup">
          <button type="button" class="lg-seg-btn lg-seg-j ${e.product === 'funeral'  ? 'on' : ''}" data-product="funeral"  role="radio" aria-checked="${e.product === 'funeral'}">근조화환</button>
          <button type="button" class="lg-seg-btn lg-seg-c ${e.product === 'congrats' ? 'on' : ''}" data-product="congrats" role="radio" aria-checked="${e.product === 'congrats'}">축하화환</button>
        </div>
      </div>
      <div class="form-group">
        <label for="lg-ed-location">장소</label>
        <input type="text" id="lg-ed-location" class="form-control" maxlength="60" value="${UI.escHtml(e.location || '')}">
      </div>
      <div class="form-group">
        <label>수량</label>
        <div class="lg-num">
          <button type="button" id="lg-ed-dec" class="lg-num-btn" aria-label="수량 감소">−</button>
          <input type="text" id="lg-ed-qty" class="lg-num-input" inputmode="numeric" value="${Number(e.quantity || 1)}">
          <button type="button" id="lg-ed-inc" class="lg-num-btn" aria-label="수량 증가">+</button>
        </div>
      </div>`;

    const overlay = UI.modal({
      title: '✏️ 수바리 장부 수정',
      content,
      confirmText: '저장',
      cancelText: '닫기',
      onConfirm: async (ov) => {
        const client   = (ov.querySelector('#lg-ed-client')?.value || '').trim();
        const location = (ov.querySelector('#lg-ed-location')?.value || '').trim();
        const quantity = parseInt(ov.querySelector('#lg-ed-qty')?.value, 10) || 0;
        const activeSeg = ov.querySelector('#lg-ed-product .lg-seg-btn.on');
        const product  = activeSeg?.dataset.product || e.product;

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

    /* 세그먼트 · 스텝퍼 바인딩 */
    const segHost = overlay.querySelector('#lg-ed-product');
    segHost?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.lg-seg-btn');
      if (!btn) return;
      segHost.querySelectorAll('.lg-seg-btn').forEach(b => {
        b.classList.remove('on');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('on');
      btn.setAttribute('aria-checked', 'true');
    });
    const qtyEl = overlay.querySelector('#lg-ed-qty');
    const setQty = (v) => { qtyEl.value = String(Math.max(1, Math.min(9999, v | 0))); };
    overlay.querySelector('#lg-ed-dec')?.addEventListener('click', () => setQty((parseInt(qtyEl.value, 10) || 1) - 1));
    overlay.querySelector('#lg-ed-inc')?.addEventListener('click', () => setQty((parseInt(qtyEl.value, 10) || 0) + 1));
    qtyEl?.addEventListener('input', () => { qtyEl.value = qtyEl.value.replace(/[^\d]/g, '').slice(0, 4); });

    requestAnimationFrame(() => {
      overlay.querySelector('#lg-ed-client')?.focus();
    });
  },
};

window.LedgerView = LedgerView;

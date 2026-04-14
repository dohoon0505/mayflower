/* ============================================================
   FLOOR1.JS — 1층 제작/배차: 전체 주문 · 상태변경 · 기사배정
   Bug-fixed: single event listener, single visibilitychange handler
   ============================================================ */

const Floor1View = {
  _session:     null,
  _pollTimer:   null,
  _pollFn:      null,
  _visHandler:  null,
  _actionsBound: false,    /* prevent duplicate listeners */

  /* ── Init (called once) ──────────────────────────────────── */
  init(session) {
    Floor1View._session = session;
    Router.register('all-orders', () => Floor1View.showAllOrders());
    Router.default('all-orders');

    /* Set up click delegation ONCE */
    document.getElementById('main-content').addEventListener('click', Floor1View._handleClick);

    /* Set up visibilitychange ONCE */
    Floor1View._visHandler = () => {
      if (!Floor1View._pollFn) return;
      if (document.hidden) {
        clearInterval(Floor1View._pollTimer);
        Floor1View._pollTimer = null;
      } else {
        Floor1View._pollTimer = setInterval(Floor1View._pollFn, 30000);
        Floor1View._pollFn();
      }
    };
    document.addEventListener('visibilitychange', Floor1View._visHandler);
  },

  /* ── Filter state ────────────────────────────────────────── */
  _filterState: {
    statusGroup: '',    /* '', '0', '1,2,3', '4' */
    photoYes: true,
    photoNo: true,
    dateFrom: '',
    dateTo: '',
    searchProfile: '',
    searchRecipient: '',
    searchAddress: '',
  },

  /* ── Show: all orders ────────────────────────────────────── */
  showAllOrders() {
    Floor1View._clearPoll();

    /* Build the new 3-row filter */
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,'0');
    const firstDay = `${y}-${m}-01`;
    const todayStr = UI.fmtDate(today.toISOString());

    UI.setContent('filter-area', `
      <div class="filter-section">

        <!-- Row 1: Status tabs + photo filter + flow -->
        <div class="filter-row">
          <span class="filter-label">주문현황</span>
          <div class="status-tab-group" id="f1-status-tabs">
            <button class="status-tab-btn active" data-sg="">전체</button>
            <button class="status-tab-btn" data-sg="0">접수대기</button>
            <button class="status-tab-btn" data-sg="1,2,3">주문접수</button>
            <button class="status-tab-btn" data-sg="4">배송완료</button>
          </div>
          <div class="filter-divider"></div>
          <span class="filter-label">사진 필터</span>
          <div class="photo-filter-group">
            <label class="photo-check-label">
              <input type="checkbox" id="f1-photo-yes" checked> 이미지 있음
            </label>
            <label class="photo-check-label">
              <input type="checkbox" id="f1-photo-no" checked> 이미지 없음
            </label>
          </div>
          <div class="status-flow">
            <span class="flow-step" id="flow-waiting">접수대기</span>
            <span class="flow-arrow">→</span>
            <span class="flow-step" id="flow-processing">주문접수</span>
            <span class="flow-arrow">→</span>
            <span class="flow-step" id="flow-complete">배송완료</span>
          </div>
        </div>

        <!-- Row 2: Date range -->
        <div class="filter-row">
          <span class="filter-label">배송요청일</span>
          <div class="date-range-box">
            <span class="date-icon">📅</span>
            <input type="date" id="f1-date-from" value="${firstDay}">
            <span class="date-sep">~</span>
            <input type="date" id="f1-date-to" value="${todayStr}">
          </div>
          <div class="quick-date-group">
            <button class="quick-date-btn" data-quick="today">오늘</button>
            <button class="quick-date-btn" data-quick="yesterday">어제</button>
            <button class="quick-date-btn" data-quick="tomorrow">내일</button>
            <button class="quick-date-btn active" data-quick="this-month">이번 달</button>
            <button class="quick-date-btn" data-quick="last-month">지난 달</button>
          </div>
          <button class="btn btn-secondary btn-sm" id="f1-refresh" style="margin-left:auto">↻ 새로고침</button>
        </div>

        <!-- Row 3: Text search -->
        <div class="filter-row" style="padding-top:0.6rem;padding-bottom:0.6rem">
          <div class="search-fields-group">
            <div class="search-field-item">
              <span class="search-field-label">🔍 프로필 검색</span>
              <input type="text" id="f1-search-profile" class="search-field-input" placeholder="이름·문구를 입력해주세요">
            </div>
            <div class="search-field-item">
              <span class="search-field-label">🔍 받는분 검색</span>
              <input type="text" id="f1-search-recipient" class="search-field-input" placeholder="받는 분 성함을 입력해주세요">
            </div>
            <div class="search-field-item">
              <span class="search-field-label">🔍 주소지 검색</span>
              <input type="text" id="f1-search-address" class="search-field-input" placeholder="주소지를 입력해주세요">
            </div>
          </div>
        </div>

      </div>`);

    Floor1View._bindFilterEvents();
    /* initial load with "이번 달" already active */
    Floor1View._applyQuickDate('this-month');
    Floor1View._loadOrders();
    Floor1View._startPoll(() => Floor1View._loadOrders(), 30000);
  },

  /* ── Bind filter events ──────────────────────────────────── */
  _bindFilterEvents() {
    /* Status tabs */
    document.getElementById('f1-status-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.status-tab-btn');
      if (!btn) return;
      document.querySelectorAll('#f1-status-tabs .status-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Floor1View._filterState.statusGroup = btn.dataset.sg;
      Floor1View._updateFlowIndicator(btn.dataset.sg);
      Floor1View._loadOrders();
    });

    /* Photo filter */
    document.getElementById('f1-photo-yes').addEventListener('change', e => {
      Floor1View._filterState.photoYes = e.target.checked;
      Floor1View._loadOrders();
    });
    document.getElementById('f1-photo-no').addEventListener('change', e => {
      Floor1View._filterState.photoNo = e.target.checked;
      Floor1View._loadOrders();
    });

    /* Date range */
    document.getElementById('f1-date-from').addEventListener('change', e => {
      Floor1View._filterState.dateFrom = e.target.value;
      Floor1View._clearQuickActive();
      Floor1View._loadOrders();
    });
    document.getElementById('f1-date-to').addEventListener('change', e => {
      Floor1View._filterState.dateTo = e.target.value;
      Floor1View._clearQuickActive();
      Floor1View._loadOrders();
    });

    /* Quick date buttons */
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Floor1View._applyQuickDate(btn.dataset.quick);
        Floor1View._loadOrders();
      });
    });

    /* Text search — debounced */
    ['f1-search-profile','f1-search-recipient','f1-search-address'].forEach(id => {
      let t;
      document.getElementById(id).addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (id === 'f1-search-profile')   Floor1View._filterState.searchProfile   = e.target.value.trim();
          if (id === 'f1-search-recipient') Floor1View._filterState.searchRecipient = e.target.value.trim();
          if (id === 'f1-search-address')   Floor1View._filterState.searchAddress   = e.target.value.trim();
          Floor1View._loadOrders();
        }, 280);
      });
    });

    /* Refresh */
    document.getElementById('f1-refresh').addEventListener('click', () => Floor1View._loadOrders());
  },

  _applyQuickDate(quick) {
    const today = new Date();
    let from, to;
    const fmt = d => {
      const p = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    };
    if (quick === 'today') {
      from = to = fmt(today);
    } else if (quick === 'yesterday') {
      const d = new Date(today); d.setDate(d.getDate()-1);
      from = to = fmt(d);
    } else if (quick === 'tomorrow') {
      const d = new Date(today); d.setDate(d.getDate()+1);
      from = to = fmt(d);
    } else if (quick === 'this-month') {
      from = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
      to   = fmt(today);
    } else if (quick === 'last-month') {
      const d = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      from = fmt(d); to = fmt(last);
    }
    if (from) { Floor1View._filterState.dateFrom = from; const el = document.getElementById('f1-date-from'); if (el) el.value = from; }
    if (to)   { Floor1View._filterState.dateTo   = to;   const el = document.getElementById('f1-date-to');   if (el) el.value = to; }
  },

  _clearQuickActive() {
    document.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('active'));
  },

  _updateFlowIndicator(sg) {
    const w = document.getElementById('flow-waiting');
    const p = document.getElementById('flow-processing');
    const c = document.getElementById('flow-complete');
    if (!w) return;
    w.className = 'flow-step'; p.className = 'flow-step'; c.className = 'flow-step';
    if (sg === '0')     { w.className = 'flow-step flow-active'; }
    if (sg === '1,2,3') { p.className = 'flow-step flow-active'; }
    if (sg === '4')     { c.className = 'flow-step flow-complete'; }
  },

  /* ── Load & filter orders ────────────────────────────────── */
  async _loadOrders() {
    UI.loading(true);
    try {
      /* Fetch all (floor1/admin get all orders) */
      const all = Store.getOrders();

      /* Client-side filtering */
      const fs = Floor1View._filterState;
      let orders = all;

      /* Status group */
      if (fs.statusGroup !== '') {
        const allowed = fs.statusGroup.split(',').map(Number);
        orders = orders.filter(o => allowed.includes(o.status));
      }

      /* Photo filter */
      if (fs.photoYes && !fs.photoNo)  orders = orders.filter(o => !!o.deliveryPhotoUrl);
      if (!fs.photoYes && fs.photoNo)  orders = orders.filter(o => !o.deliveryPhotoUrl);
      if (!fs.photoYes && !fs.photoNo) orders = [];

      /* Date range */
      if (fs.dateFrom) orders = orders.filter(o => o.deliveryDatetime >= fs.dateFrom);
      if (fs.dateTo)   orders = orders.filter(o => o.deliveryDatetime <= fs.dateTo + 'T23:59:59');

      /* Text search */
      const lc = s => (s || '').toLowerCase();
      if (fs.searchProfile)   orders = orders.filter(o => lc(o.chainName).includes(lc(fs.searchProfile)) || lc(o.ribbonText).includes(lc(fs.searchProfile)));
      if (fs.searchRecipient) orders = orders.filter(o => lc(o.recipientName).includes(lc(fs.searchRecipient)));
      if (fs.searchAddress)   orders = orders.filter(o => lc(o.deliveryAddress).includes(lc(fs.searchAddress)));

      /* Sort by delivery datetime */
      orders.sort((a, b) => new Date(a.deliveryDatetime) - new Date(b.deliveryDatetime));

      Floor1View._renderOrders(orders);
    } catch(e) {
      UI.toast(e.message || '조회 실패', 'error');
    } finally {
      UI.loading(false);
    }
  },

  _renderOrders(orders) {
    if (!orders.length) {
      UI.setMain(`<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">조건에 맞는 주문이 없습니다.</div></div>`);
      Floor1View._removeBulkBar();
      return;
    }
    const role = Floor1View._session?.role;
    const showActions = role === 'floor1' || role === 'admin';
    UI.setMain(`<div class="order-list">${orders.map(o => Floor1View._orderCard(o, showActions)).join('')}</div>`);
    Floor1View._updateBulkBar();
  },

  /* ── Order card ──────────────────────────────────────────── */
  _orderCard(o, showActions) {
    const dt = UI.fmtDatetime(o.deliveryDatetime);
    const created = UI.fmtDatetime(o.createdAt);
    const immediate = o.isImmediate ? '<span class="order-immediate">즉시</span>' : '';
    const driverTag = o.assignedDriverName
      ? `<span class="order-driver-tag">🚚 ${UI.escHtml(o.assignedDriverName)}</span>` : '';
    const photo = o.deliveryPhotoUrl
      ? `<img src="${o.deliveryPhotoUrl}" class="order-photo-thumb" title="배송 사진 보기" onclick="window.open(this.src)">` : '';

    let actionBtns = '';
    if (showActions) {
      const s = o.status;
      /* Show only contextually relevant buttons */
      if (s === 0) {
        actionBtns = `
          <button class="btn btn-secondary btn-sm f1-action" data-id="${o.id}" data-action="ribbon">리본출력완료</button>
          <button class="btn btn-ghost btn-sm f1-action" data-id="${o.id}" data-action="assign">기사배정</button>
          <button class="btn btn-danger btn-sm f1-action" data-id="${o.id}" data-action="cancel">취소</button>`;
      } else if (s === 1) {
        actionBtns = `
          <button class="btn btn-secondary btn-sm f1-action" data-id="${o.id}" data-action="prod">제작완료</button>
          <button class="btn btn-ghost btn-sm f1-action" data-id="${o.id}" data-action="assign">기사배정</button>
          <button class="btn btn-danger btn-sm f1-action" data-id="${o.id}" data-action="cancel">취소</button>`;
      } else if (s === 2) {
        actionBtns = `
          <button class="btn btn-warning btn-sm f1-action" data-id="${o.id}" data-action="deliv">배송출발</button>
          <button class="btn btn-primary btn-sm f1-action" data-id="${o.id}" data-action="assign">기사배정</button>
          <button class="btn btn-danger btn-sm f1-action" data-id="${o.id}" data-action="cancel">취소</button>`;
      } else if (s === 3) {
        actionBtns = `
          <button class="btn btn-danger btn-sm f1-action" data-id="${o.id}" data-action="return">반품</button>`;
      }
      /* status 4,5,6 — no actions */
    }

    return `
      <div class="order-card" data-id="${o.id}" data-status="${o.status}">
        <div class="order-card-check">
          <input type="checkbox" class="order-checkbox" data-id="${o.id}" title="선택">
        </div>
        <div class="order-info">
          <div class="order-top">
            <span class="order-chain">${UI.escHtml(o.chainName || '-')}</span>
            <span class="order-product">${UI.escHtml(o.productName)}</span>
            ${immediate}
            ${UI.statusBadge(o.status)}
          </div>
          <div class="order-meta">
            <span class="order-meta-item"><span class="order-meta-icon">📍</span>${UI.escHtml(o.deliveryAddress)}</span>
            <span class="order-meta-item"><span class="order-meta-icon">👤</span>${UI.escHtml(o.recipientName)}${o.recipientPhone ? ' / ' + UI.escHtml(o.recipientPhone) : ''}</span>
            <span class="order-meta-item"><span class="order-meta-icon">🕐</span>${dt}</span>
          </div>
          ${o.ribbonText ? `<div class="order-ribbon" data-ribbon="${UI.escHtml(o.ribbonText)}" title="클릭 시 클립보드 복사" style="cursor:pointer">🎀 ${UI.escHtml(o.ribbonText)}</div>` : ''}
          <div class="order-footer">
            ${driverTag}
            ${photo}
            <span class="order-created">접수: ${UI.escHtml(o.createdByName)} / ${created}</span>
          </div>
        </div>
        ${showActions && actionBtns ? `<div class="order-actions">${actionBtns}</div>` : '<div style="width:0.5rem"></div>'}
      </div>`;
  },

  /* ── Click handler (single, delegated) ───────────────────── */
  _handleClick: async function(e) {
    /* Action buttons */
    const actionBtn = e.target.closest('.f1-action');
    if (actionBtn) {
      await Floor1View._handleAction(+actionBtn.dataset.id, actionBtn.dataset.action, actionBtn);
      return;
    }

    /* Ribbon copy */
    const ribbon = e.target.closest('[data-ribbon]');
    if (ribbon) {
      try {
        await navigator.clipboard.writeText(ribbon.dataset.ribbon);
        UI.toast('리본 문구를 클립보드에 복사했습니다.', 'success', 2000);
      } catch { UI.toast('클립보드 복사 실패', 'error'); }
      return;
    }

    /* Checkbox — update bulk bar */
    const checkbox = e.target.closest('.order-checkbox');
    if (checkbox) {
      Floor1View._updateBulkBar();
      return;
    }
  },

  /* ── Action handler ──────────────────────────────────────── */
  async _handleAction(id, action, btn) {
    if (action === 'assign') {
      await Floor1View._openAssignModal([id]);
      return;
    }
    const statusMap = { ribbon: 1, prod: 2, deliv: 3, cancel: 5, return: 6 };
    const labelMap  = { ribbon: '리본출력완료', prod: '제작완료', deliv: '배송출발', cancel: '취소', return: '반품' };
    const status = statusMap[action];
    const ok = await UI.confirm(`주문 #${id}을 [${labelMap[action]}] 상태로 변경할까요?`);
    if (!ok) return;
    btn.disabled = true;
    try {
      await Api.updateOrderStatus(id, status);
      UI.toast(`[${labelMap[action]}] 처리되었습니다.`, 'success');
      Floor1View._loadOrders();
    } catch(e) {
      UI.toast(e.message || '상태 변경 실패', 'error');
      btn.disabled = false;
    }
  },

  /* ── Bulk bar ────────────────────────────────────────────── */
  _getCheckedIds() {
    return [...document.querySelectorAll('.order-checkbox:checked')].map(cb => +cb.dataset.id);
  },

  _updateBulkBar() {
    const ids = Floor1View._getCheckedIds();
    let bar = document.getElementById('bulk-action-bar');

    if (!ids.length) {
      if (bar) bar.remove();
      return;
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bulk-action-bar';
      bar.className = 'bulk-action-bar';
      document.body.appendChild(bar);
    }

    bar.innerHTML = `
      <span class="bulk-count-text">${ids.length}건 선택됨</span>
      <button class="btn btn-primary btn-sm" id="bulk-assign-btn">기사 배정</button>
      <button class="btn btn-ghost btn-sm" id="bulk-clear-btn" style="color:#fff;border-color:rgba(255,255,255,0.25)">선택 해제</button>`;

    document.getElementById('bulk-assign-btn').onclick = () => Floor1View._openAssignModal(Floor1View._getCheckedIds());
    document.getElementById('bulk-clear-btn').onclick  = () => {
      document.querySelectorAll('.order-checkbox:checked').forEach(cb => { cb.checked = false; });
      Floor1View._updateBulkBar();
    };
  },

  _removeBulkBar() {
    const bar = document.getElementById('bulk-action-bar');
    if (bar) bar.remove();
  },

  /* ── Driver assign modal ─────────────────────────────────── */
  async _openAssignModal(orderIds) {
    let drivers = [];
    try { drivers = await Api.getDrivers(); } catch(e) { UI.toast('기사 목록 로드 실패', 'error'); return; }

    const plural = orderIds.length > 1 ? `${orderIds.length}건의 주문` : `주문 #${orderIds[0]}`;
    const items = drivers.length
      ? drivers.map(d => `
          <div class="driver-modal-item">
            <div>
              <div class="driver-modal-name">${UI.escHtml(d.name)}</div>
              <div class="driver-modal-phone">${UI.escHtml(d.phone || '-')}</div>
            </div>
            <button class="btn btn-primary btn-sm" data-assign="${d.id}">배정</button>
          </div>`)
          .join('')
      : '<p style="color:var(--text-muted);text-align:center">등록된 기사가 없습니다.</p>';

    const overlay = UI.modal({
      title: `기사 배정 — ${plural}`,
      content: `<div class="driver-list-modal">${items}</div>`,
      confirmText: '', cancelText: '닫기',
    });
    overlay.querySelector('.modal-footer').innerHTML =
      `<button class="btn btn-ghost modal-cancel">닫기</button>`;
    overlay.querySelector('.modal-cancel').onclick = () => {
      overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelectorAll('[data-assign]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const driverId = +btn.dataset.assign;
        btn.disabled = true; btn.textContent = '배정 중...';
        try {
          for (const id of orderIds) {
            await Api.assignDriver(id, driverId);
          }
          UI.toast(`${orderIds.length}건 기사 배정 완료!`, 'success');
          overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 250);
          /* Clear checkboxes */
          document.querySelectorAll('.order-checkbox:checked').forEach(cb => { cb.checked = false; });
          Floor1View._removeBulkBar();
          Floor1View._loadOrders();
        } catch(e) {
          UI.toast(e.message || '배정 실패', 'error');
          btn.disabled = false; btn.textContent = '배정';
        }
      });
    });
  },

  /* ── Polling ─────────────────────────────────────────────── */
  _startPoll(fn, ms) {
    Floor1View._pollFn = fn;
    clearInterval(Floor1View._pollTimer);
    Floor1View._pollTimer = setInterval(fn, ms);
  },
  _clearPoll() {
    Floor1View._pollFn = null;
    clearInterval(Floor1View._pollTimer);
    Floor1View._pollTimer = null;
  },
};

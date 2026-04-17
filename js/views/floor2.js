/* ============================================================
   FLOOR2.JS — 2층 수주/CS: 내 주문 · 신규 접수 (모달)
   v2: 3-row filter + modal new order
   ============================================================ */

const Floor2View = {
  _session:     null,
  _pollTimer:   null,
  _pollFn:      null,
  _visHandler:  null,

  /* ── Filter state ────────────────────────────────────────── */
  _filterState: {
    statusGroup: '',
    dateFrom: '',
    dateTo: '',
    searchAddress: '',
    searchRecipient: '',
    searchRibbon: '',
  },

  init(session) {
    Floor2View._session = session;
    Router.register('my-orders',  () => Floor2View.showMyOrders());
    Router.register('new-order',  () => Floor2View.openNewOrderModal());
    Router.default('my-orders');



    /* Delegated click — set up once */
    document.getElementById('main-content').addEventListener('click', async e => {
      const copyEl = e.target.closest('[data-copy]');
      if (copyEl) {
        try {
          await navigator.clipboard.writeText(copyEl.dataset.copy);
          UI.toast('클립보드에 복사했습니다.', 'success', 2000);
        } catch { UI.toast('클립보드 복사 실패', 'error'); }
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id     = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit') {
        try { await Floor1View._openEditModal(id); }
        catch(e) { UI.toast(e.message || '수정 중 오류가 발생했습니다.', 'error'); }
      }
      else if (action === 'store-photo') { await Floor1View._openStorePhotoModal(id); }
      else if (action === 'view-store-photo') {
        const o = Store.getOrderById(id);
        if (o?.storePhotoUrl) window.open(o.storePhotoUrl);
      }
      else if (action === 'receipt')     { Floor1View._openReceiptModal(id); }
    });
  },

  /* ── 내 주문 ──────────────────────────────────────────────── */
  async showMyOrders() {
    Floor2View._clearPoll();

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,'0');
    const firstDay = `${y}-${m}-01`;
    const todayStr = UI.fmtDate(today.toISOString());

    UI.setContent('filter-area', `
      <div class="filter-section">

        <!-- Row 1: Status tabs -->
        <div class="filter-row">
          <span class="filter-label">주문 상태</span>
          <div class="status-tab-group" id="f2-status-tabs">
            <button class="status-tab-btn active" data-sg="">전체</button>
            <button class="status-tab-btn" data-sg="0,1,2">주문접수</button>
            <button class="status-tab-btn" data-sg="3">배송중</button>
            <button class="status-tab-btn" data-sg="4">배송완료</button>
            <button class="status-tab-btn" data-sg="5,6">주문취소</button>
          </div>
          <button class="btn btn-secondary btn-sm" id="f2-refresh" style="margin-left:auto">↻ 새로고침</button>
        </div>

        <!-- Row 2: Date range -->
        <div class="filter-row">
          <span class="filter-label">배송요청일</span>
          <div class="date-range-box">
            <span class="date-icon">📅</span>
            <input type="date" id="f2-date-from" value="${firstDay}">
            <span class="date-sep">~</span>
            <input type="date" id="f2-date-to" value="${todayStr}">
          </div>
          <div class="quick-date-group">
            <button class="quick-date-btn f2-quick" data-quick="today">오늘</button>
            <button class="quick-date-btn f2-quick" data-quick="yesterday">어제</button>
            <button class="quick-date-btn f2-quick" data-quick="tomorrow">내일</button>
            <button class="quick-date-btn f2-quick active" data-quick="this-month">이번 달</button>
            <button class="quick-date-btn f2-quick" data-quick="last-month">지난 달</button>
            <button class="quick-date-btn f2-quick" data-quick="future">예약건</button>
          </div>
        </div>

        <!-- Row 3: Text search -->
        <div class="filter-row" style="padding-top:0.6rem;padding-bottom:0.6rem">
          <div class="search-fields-group">
            <div class="search-field-item">
              <span class="search-field-label">🔍 주소지 검색</span>
              <input type="text" id="f2-search-address" class="search-field-input" placeholder="배송지 주소">
            </div>
            <div class="search-field-item">
              <span class="search-field-label">🔍 받는분 검색</span>
              <input type="text" id="f2-search-recipient" class="search-field-input" placeholder="받는 분 성함">
            </div>
            <div class="search-field-item">
              <span class="search-field-label">🔍 보낸문구 검색</span>
              <input type="text" id="f2-search-ribbon" class="search-field-input" placeholder="리본 문구를 입력해주세요">
            </div>
          </div>
        </div>

      </div>`);

    Floor2View._bindFilterEvents();
    Floor2View._applyQuickDate('this-month');
    await Floor2View._loadMyOrders();
  },

  _bindFilterEvents() {
    /* Status tabs */
    document.getElementById('f2-status-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.status-tab-btn');
      if (!btn) return;
      document.querySelectorAll('#f2-status-tabs .status-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Floor2View._filterState.statusGroup = btn.dataset.sg;
      Floor2View._loadMyOrders();
    });

    /* Date range */
    document.getElementById('f2-date-from').addEventListener('change', e => {
      Floor2View._filterState.dateFrom = e.target.value;
      Floor2View._clearQuickActive();
      Floor2View._loadMyOrders();
    });
    document.getElementById('f2-date-to').addEventListener('change', e => {
      Floor2View._filterState.dateTo = e.target.value;
      Floor2View._clearQuickActive();
      Floor2View._loadMyOrders();
    });

    /* Quick date */
    document.querySelectorAll('.f2-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.f2-quick').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Floor2View._applyQuickDate(btn.dataset.quick);
        Floor2View._loadMyOrders();
      });
    });

    /* Text search — debounced */
    ['f2-search-address','f2-search-recipient','f2-search-ribbon'].forEach(id => {
      let t;
      document.getElementById(id).addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (id === 'f2-search-address')   Floor2View._filterState.searchAddress   = e.target.value.trim();
          if (id === 'f2-search-recipient') Floor2View._filterState.searchRecipient = e.target.value.trim();
          if (id === 'f2-search-ribbon')    Floor2View._filterState.searchRibbon    = e.target.value.trim();
          Floor2View._loadMyOrders();
        }, 280);
      });
    });

    /* Refresh */
    document.getElementById('f2-refresh').addEventListener('click', () => Floor2View._loadMyOrders());
  },

  _applyQuickDate(quick) {
    const today = new Date();
    let from, to;
    const fmt = d => {
      const p = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    };
    if (quick === 'today')      { from = to = fmt(today); }
    else if (quick === 'yesterday') { const d = new Date(today); d.setDate(d.getDate()-1); from = to = fmt(d); }
    else if (quick === 'tomorrow')  { const d = new Date(today); d.setDate(d.getDate()+1); from = to = fmt(d); }
    else if (quick === 'this-month') {
      from = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
      to   = fmt(today);
    } else if (quick === 'last-month') {
      const d    = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      from = fmt(d); to = fmt(last);
    } else if (quick === 'future') {
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
      const farFuture = new Date(today); farFuture.setFullYear(today.getFullYear()+1);
      from = fmt(tomorrow); to = fmt(farFuture);
    }
    if (from) { Floor2View._filterState.dateFrom = from; const el = document.getElementById('f2-date-from'); if (el) el.value = from; }
    if (to)   { Floor2View._filterState.dateTo   = to;   const el = document.getElementById('f2-date-to');   if (el) el.value = to; }
  },

  _clearQuickActive() {
    document.querySelectorAll('.f2-quick').forEach(b => b.classList.remove('active'));
  },

  async _loadMyOrders() {
    UI.loading(true);
    try {
      const all = await Api.getOrders();
      const fs = Floor2View._filterState;
      let orders = all;

      /* Status group */
      if (fs.statusGroup !== '') {
        const allowed = fs.statusGroup.split(',').map(Number);
        orders = orders.filter(o => allowed.includes(o.status));
      }

      /* Date range */
      if (fs.dateFrom) orders = orders.filter(o => o.deliveryDatetime >= fs.dateFrom);
      if (fs.dateTo)   orders = orders.filter(o => o.deliveryDatetime <= fs.dateTo + 'T23:59:59');

      /* Text search */
      const lc = s => (s || '').toLowerCase();
      if (fs.searchAddress)   orders = orders.filter(o => lc(o.deliveryAddress).includes(lc(fs.searchAddress)));
      if (fs.searchRecipient) orders = orders.filter(o => lc(o.recipientName).includes(lc(fs.searchRecipient)));
      if (fs.searchRibbon)    orders = orders.filter(o => lc(o.ribbonText).includes(lc(fs.searchRibbon)));

      const _cg = s => s === 3 ? 1 : s === 4 ? 2 : s >= 5 ? 3 : 0;
      orders.sort((a, b) => {
        const g = _cg(a.status) - _cg(b.status);
        return g !== 0 ? g : new Date(a.deliveryDatetime) - new Date(b.deliveryDatetime);
      });
      UI.setMain(Floor2View._renderOrderList(orders));
    } catch(e) {
      UI.toast(e.message || '주문 조회 실패', 'error');
    } finally { UI.loading(false); }
  },

  _renderOrderList(orders) {
    if (!orders.length) return `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">조건에 맞는 주문이 없습니다.</div>
      </div>`;
    return `<div class="order-list">${orders.map(o => Floor2View._orderCard(o)).join('')}</div>`;
  },

  _orderCard(o) {
    const dt = UI.fmtDatetime(o.deliveryDatetime);

    const ribbonHtml = o.ribbonText
      ? `<span class="ocard-field-icon">🎀</span><span data-copy="${UI.escHtml(o.ribbonText)}" class="ocard-field-copy" title="클릭 시 클립보드 복사">${UI.escHtml(o.ribbonText)}</span>`
      : `<span class="ocard-field-icon">🎀</span><span style="color:var(--text-muted);font-style:italic">문구 없음</span>`;

    const occasionHtml = o.occasionText
      ? `<span class="ocard-field-icon">📝</span><span data-copy="${UI.escHtml(o.occasionText)}" class="ocard-field-copy" title="클릭 시 클립보드 복사">${UI.escHtml(o.occasionText)}</span>`
      : `<span class="ocard-field-icon">📝</span><span style="color:var(--text-muted);font-style:italic">경조사어 없음</span>`;

    const driverHtml = o.assignedDriverName
      ? `<span class="ocard-field-icon">🚚</span><span class="ocard-driver-tag">${UI.escHtml(o.assignedDriverName)}</span>${o.assignedAt ? `<span class="ocard-assign-time">(${UI.fmtDatetime(o.assignedAt)} 배차)</span>` : ''}`
      : `<span class="ocard-field-icon">🚚</span><span class="ocard-driver-none">배차 전</span>`;
    const driverFieldCls = o.assignedDriverName ? 'ocard-field--assigned' : '';

    const _today = new Date().toISOString().slice(0, 10);
    const _delivDay = (o.deliveryDatetime || '').slice(0, 10);
    const dayBadge = _delivDay === _today
      ? '<span class="ocard-day-badge ocard-day-today">당일건</span>'
      : _delivDay > _today
        ? '<span class="ocard-day-badge ocard-day-future">예약건</span>'
        : '';

    const _chainCodes = ['ㄲㅌ','ㅂㅎㄷ','ㄷㅍㄹㅇ','ㄷㄹ','ㅇㅎ','ㅄㅌ'];
    const _chainIdx = String(o.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const chainCode = _chainCodes[_chainIdx % _chainCodes.length];

    const _prod = Store.getProductById(o.productId);
    const _cat  = _prod ? Store.getCategoryById(_prod.category) : null;
    const categoryName = _cat ? _cat.name : o.productName;

    let timeFieldCls, timeText;
    if (o.status === 4 && o.createdAt && o.updatedAt) {
      const _el = new Date(o.updatedAt) - new Date(o.createdAt);
      const _eh = Math.floor(_el / 3600000), _em = Math.floor((_el % 3600000) / 60000);
      timeText = (_eh > 0 ? `${_eh}시간 ` : '') + `${_em}분 경과 후 배송완료`;
      timeFieldCls = 'ocard-field--done';
    } else {
      const _tms = new Date(o.deliveryDatetime) - Date.now();
      const _tmins = _tms / 60000;
      timeFieldCls = _tmins < 0 ? 'ocard-field--late' : _tmins < 60 ? 'ocard-field--soon' : _tmins < 180 ? 'ocard-field--warn' : 'ocard-field--ok';
      timeText = UI.timeRemaining(o.deliveryDatetime);
    }

    const storePhotoAction = o.storePhotoUrl ? 'view-store-photo' : 'store-photo';
    const storePhotoCls    = o.storePhotoUrl ? 'oa-success' : 'oa-muted';
    const storePhotoLabel  = o.storePhotoUrl ? '🏪<br><span style="font-size:0.7rem">매장사진 보기</span>' : '🏪<br><span style="font-size:0.7rem">매장사진 없음</span>';

    return `
      <div class="order-card" data-id="${o.id}" data-status="${o.status}">
        <div class="ocard-body">
          <div class="ocard-header">
            ${dayBadge}
            <span class="ocard-datetime">🕐 ${dt}</span>
            <span class="ocard-product">${UI.escHtml(categoryName)}</span>
            <span class="ocard-chain">${chainCode}</span>
          </div>
          <div class="ocard-2col">
            <div class="ocard-field">
              <span class="ocard-field-icon">📍</span>
              <span>${UI.escHtml(o.deliveryAddress)}</span>
            </div>
            <div class="ocard-field">
              <span class="ocard-field-icon">👤</span>
              <span>${UI.escHtml(o.recipientName)}${o.recipientPhone ? ' / ' + UI.escHtml(o.recipientPhone) : ''}</span>
            </div>
          </div>
          <div class="ocard-2col">
            <div class="ocard-field ${!o.ribbonText ? 'ocard-empty' : ''}">
              ${ribbonHtml}
            </div>
            <div class="ocard-field ${!o.occasionText ? 'ocard-empty' : ''}">
              ${occasionHtml}
            </div>
          </div>
          <div class="ocard-2col">
            <div class="ocard-field ${driverFieldCls}">${driverHtml}</div>
            <div class="ocard-field ${timeFieldCls}">
              <span class="ocard-field-icon">⏱</span>
              <span>${timeText}</span>
            </div>
          </div>
        </div>
        <div class="ocard-actions">
          <button class="ocard-action oa-primary" data-id="${o.id}" data-action="edit">✏️<br>주문서 수정</button>
          <button class="ocard-action ${storePhotoCls}" data-id="${o.id}" data-action="${storePhotoAction}">${storePhotoLabel}</button>
          <button class="ocard-action oa-warning" data-id="${o.id}" data-action="receipt">🧾<br>인수증 출력</button>
        </div>
      </div>`;
  },

  /* ── 신규 접수 (모달) ─────────────────────────────────────── */
  async openNewOrderModal() {
    let products = [];
    try { products = await Api.getProducts(); }
    catch(e) { UI.toast('상품 목록 로드 실패', 'error'); }

    const productOptions = products.map(p =>
      `<option value="${p.id}">${UI.escHtml(p.name)}</option>`).join('');

    const defDt = (() => {
      const d = new Date(); d.setHours(d.getHours() + 1);
      d.setSeconds(0, 0);
      d.setMinutes(Math.round(d.getMinutes() / 10) * 10);
      const p = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    })();

    const content = `
      <div class="form-row" style="margin-bottom:0.75rem">
        <div class="form-group">
          <label class="form-label">체인명 (꽃집 상호) <span class="form-required">*</span></label>
          <input type="text" id="no-chain" class="form-control" placeholder="예: 행복꽃집">
        </div>
        <div class="form-group">
          <label class="form-label">상품 <span class="form-required">*</span></label>
          <select id="no-product" class="form-control">
            <option value="">선택하세요</option>
            ${productOptions}
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0.75rem">
        <label class="form-check">
          <input type="checkbox" id="no-immediate">
          <span class="form-check-label">즉시배송 (배송일시를 현재 + 3시간으로 자동 설정)</span>
        </label>
      </div>
      <div class="form-group" id="no-dt-group" style="margin-bottom:0.75rem">
        <label class="form-label">배송 예정 일시 <span class="form-required">*</span></label>
        <input type="datetime-local" id="no-datetime" class="form-control" value="${defDt}" step="600">
      </div>
      <div class="form-group" style="margin-bottom:0.75rem">
        <label class="form-label">배송지 주소 <span class="form-required">*</span></label>
        <input type="text" id="no-address" class="form-control" placeholder="배송지 주소">
      </div>
      <div class="form-row" style="margin-bottom:0.75rem">
        <div class="form-group">
          <label class="form-label">받는 분 성함 <span class="form-required">*</span></label>
          <input type="text" id="no-name" class="form-control" placeholder="받는 분 성함">
        </div>
        <div class="form-group">
          <label class="form-label">받는 분 연락처</label>
          <input type="tel" id="no-phone" class="form-control" placeholder="010-0000-0000">
        </div>
      </div>
      <div class="form-row" style="margin-bottom:0.75rem">
        <div class="form-group">
          <label class="form-label">보내는분 문구 (리본)</label>
          <input type="text" id="no-ribbon" class="form-control" placeholder="예: 개업을 진심으로 축하합니다">
        </div>
        <div class="form-group">
          <label class="form-label">경조사어 문구</label>
          <input type="text" id="no-occasion" class="form-control" placeholder="예: 삼가 고인의 명복을 빕니다">
        </div>
      </div>`;

    const overlay = UI.modal({
      title: '신규 주문 접수',
      content,
      confirmText: '접수하기',
      cancelText: '취소',
      size: 'modal-lg',
    });

    /* Immediate checkbox toggle */
    overlay.querySelector('#no-immediate').addEventListener('change', function() {
      const group   = overlay.querySelector('#no-dt-group');
      const dtInput = overlay.querySelector('#no-datetime');
      group.style.opacity = this.checked ? '0.4' : '1';
      dtInput.disabled = this.checked;
    });

    const confirmBtn = overlay.querySelector('.modal-confirm');
    confirmBtn.onclick = async () => {
      const isImmediate = overlay.querySelector('#no-immediate').checked;
      let deliveryDatetime;
      if (isImmediate) {
        const d = new Date(); d.setHours(d.getHours() + 3);
        d.setMinutes(Math.round(d.getMinutes() / 10) * 10); d.setSeconds(0, 0);
        deliveryDatetime = d.toISOString();
      } else {
        const raw = overlay.querySelector('#no-datetime').value;
        if (!raw) { UI.toast('배송 일시를 선택해 주세요.', 'warning'); return; }
        const d = new Date(raw);
        d.setMinutes(Math.round(d.getMinutes() / 10) * 10); d.setSeconds(0, 0);
        deliveryDatetime = d.toISOString();
      }
      const data = {
        chainName:       overlay.querySelector('#no-chain').value.trim(),
        productId:       overlay.querySelector('#no-product').value,
        deliveryDatetime, isImmediate,
        deliveryAddress: overlay.querySelector('#no-address').value.trim(),
        recipientName:   overlay.querySelector('#no-name').value.trim(),
        recipientPhone:  overlay.querySelector('#no-phone').value.trim(),
        ribbonText:      overlay.querySelector('#no-ribbon').value.trim(),
        occasionText:    overlay.querySelector('#no-occasion').value.trim(),
      };

      confirmBtn.disabled = true; confirmBtn.textContent = '접수 중...';
      try {
        await Api.createOrder(data);
        UI.toast('주문이 접수되었습니다! 🎉', 'success');
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
        /* Navigate to my-orders and reload */
        Router.navigate('my-orders');
      } catch(err) {
        UI.toast(err.message || '접수 실패', 'error');
        confirmBtn.disabled = false; confirmBtn.textContent = '접수하기';
      }
    };
  },

  /* ── Polling ─────────────────────────────────────────────── */
  _startPoll(fn, ms) {
    Floor2View._pollFn = fn;
    clearInterval(Floor2View._pollTimer);
    Floor2View._pollTimer = setInterval(fn, ms);
  },
  _clearPoll() {
    Floor2View._pollFn = null;
    clearInterval(Floor2View._pollTimer);
    Floor2View._pollTimer = null;
  },
};

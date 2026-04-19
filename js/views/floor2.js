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
      else if (action === 'receipt' || action === 'print-receipt') {
        Floor1View._openReceiptModal(id);
        Api.markReceiptPrinted(id).catch(err => console.warn('[Floor2] markReceiptPrinted:', err));
      }
      else if (action === 'assign') {
        try { await Floor1View._openAssignModal([id]); }
        catch(e) { UI.toast(e.message || '배정 실패', 'error'); }
      }
      else if (action === 'force-complete') {
        try { await Floor1View._forceComplete(id); }
        catch(e) { UI.toast(e.message || '처리 실패', 'error'); }
      }
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
            <input type="date" id="f2-date-from" value="">
            <span class="date-sep">~</span>
            <input type="date" id="f2-date-to" value="">
          </div>
          <div class="quick-date-group">
            <button class="quick-date-btn f2-quick active" data-quick="all">전체</button>
            <button class="quick-date-btn f2-quick" data-quick="today">오늘</button>
            <button class="quick-date-btn f2-quick" data-quick="yesterday">어제</button>
            <button class="quick-date-btn f2-quick" data-quick="tomorrow">내일</button>
            <button class="quick-date-btn f2-quick" data-quick="this-month">이번 달</button>
            <button class="quick-date-btn f2-quick" data-quick="last-month">지난 달</button>
            <button class="quick-date-btn f2-quick" data-quick="future">예약건</button>
          </div>
        </div>

        <!-- Row 3: Text search -->
        <div class="filter-row" style="padding-top:0.6rem;padding-bottom:0.6rem">
          <div class="search-fields-group">
            <div class="search-field-item">
              <span class="search-field-label">🔍 배송지</span>
              <input type="text" id="f2-search-address" class="search-field-input" placeholder="배송지 주소">
            </div>
            <div class="search-field-item">
              <span class="search-field-label">🔍 받는분</span>
              <input type="text" id="f2-search-recipient" class="search-field-input" placeholder="받는 분 성함">
            </div>
            <div class="search-field-item">
              <span class="search-field-label">🔍 보내는분</span>
              <input type="text" id="f2-search-ribbon" class="search-field-input" placeholder="리본 문구를 입력해주세요">
            </div>
          </div>
        </div>

      </div>`);

    Floor2View._bindFilterEvents();
    Floor2View._applyQuickDate('all');
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
    if (quick === 'all') {
      Floor2View._filterState.dateFrom = '';
      Floor2View._filterState.dateTo   = '';
      const elF = document.getElementById('f2-date-from'); if (elF) elF.value = '';
      const elT = document.getElementById('f2-date-to');   if (elT) elT.value = '';
      return;
    }
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

      /* Date range — 로컬(KST) 기준 YYYY-MM-DD 로 정규화 비교 */
      const _toLocalDate = iso => {
        if (!iso) return '';
        const d = new Date(iso);
        const p = n => String(n).padStart(2,'0');
        return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
      };
      if (fs.dateFrom) orders = orders.filter(o => _toLocalDate(o.deliveryDatetime) >= fs.dateFrom);
      if (fs.dateTo)   orders = orders.filter(o => _toLocalDate(o.deliveryDatetime) <= fs.dateTo);

      /* Text search */
      const lc = s => (s || '').toLowerCase();
      if (fs.searchAddress)   orders = orders.filter(o => lc(o.deliveryAddress).includes(lc(fs.searchAddress)));
      if (fs.searchRecipient) orders = orders.filter(o => lc(o.recipientName).includes(lc(fs.searchRecipient)));
      if (fs.searchRibbon)    orders = orders.filter(o => lc(o.ribbonText).includes(lc(fs.searchRibbon)));

      const _p = n => String(n).padStart(2,'0');
      const _n = new Date();
      const _today = `${_n.getFullYear()}-${_p(_n.getMonth()+1)}-${_p(_n.getDate())}`;
      const _bucket = o => {
        if (o.status === 4) return 2;
        const dd = o.deliveryDatetime ? new Date(o.deliveryDatetime) : null;
        const dday = dd ? `${dd.getFullYear()}-${_p(dd.getMonth()+1)}-${_p(dd.getDate())}` : '';
        if (dday === _today) return 0;
        if (dday > _today)   return 1;
        return 3;
      };
      orders.sort((a, b) => {
        const g = _bucket(a) - _bucket(b);
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

    /* 받는 분 정보 (row3 좌측) */
    const recipientHtml = o.recipientName
      ? `<span class="ocard-field-icon">👤</span><span>${UI.escHtml(o.recipientName)}</span>${o.recipientPhone ? `<span class="ocard-recipient-phone" data-copy="${UI.escHtml(o.recipientPhone)}" title="클릭 시 연락처 복사">${UI.escHtml(o.recipientPhone)}</span>` : ''}`
      : `<span class="ocard-field-icon">👤</span><span style="color:var(--text-muted);font-style:italic">받는 분 미입력</span>`;
    const recipientFieldCls = o.recipientName ? 'ocard-field--recipient' : '';

    const _n = new Date(), _pad = n => String(n).padStart(2, '0');
    const _today = `${_n.getFullYear()}-${_pad(_n.getMonth()+1)}-${_pad(_n.getDate())}`;
    const _dd = o.deliveryDatetime ? new Date(o.deliveryDatetime) : null;
    const _delivDay = _dd ? `${_dd.getFullYear()}-${_pad(_dd.getMonth()+1)}-${_pad(_dd.getDate())}` : '';
    const dayBadge = o.status === 4
      ? '<span class="ocard-day-badge ocard-day-done">완료건</span>'
      : _delivDay === _today
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
    const priceBadge = o.price != null
      ? `<span class="ocard-price">${Number(o.price).toLocaleString('ko-KR')}원</span>` : '';

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

    /* ── 업무 흐름도 3단계 상태 계산 ── */
    const step1Done = !!o.receiptPrintedAt;
    const step2Done = !!o.storePhotoUrl;
    const step3Done = !!o.assignedDriverId;
    const step1State = step1Done ? 'fs-done' : 'fs-active';
    const step2State = step2Done ? 'fs-done' : (step1Done ? 'fs-active' : 'fs-locked');
    const step3State = step3Done ? 'fs-done' : (step2Done ? 'fs-active' : 'fs-locked');
    const step1Label = step1Done ? '인수증 인쇄 완료' : '인수증 인쇄';
    const step2Label = step2Done ? '매장사진 업로드 완료' : '매장사진 업로드';
    const step2Action = step2Done ? 'view-store-photo' : 'store-photo';
    const step3Label = step3Done
      ? `${UI.escHtml(o.assignedDriverName || '기사')} 배차 완료`
      : '배송기사 배차';
    const step2Disabled = step2State === 'fs-locked' ? 'disabled' : '';
    const step3Disabled = step3State === 'fs-locked' ? 'disabled' : '';
    const step1Sub = step1Done && o.receiptPrintedAt
      ? `<div class="fs-sub">${UI.fmtDatetime(o.receiptPrintedAt)}</div>` : '';
    const step3Sub = step3Done && o.assignedAt
      ? `<div class="fs-sub">${UI.fmtDatetime(o.assignedAt)}</div>` : '';

    const terminated = o.status === 4 || o.status >= 5;
    const forceCompleteBtn = !terminated
      ? `<button type="button" class="ocard-flow-mini-btn" data-id="${o.id}" data-action="force-complete" title="강제 배송완료">✓ 강제완료</button>`
      : '';

    return `
      <div class="order-card" data-id="${o.id}" data-status="${o.status}">
        <div class="ocard-body">
          <div class="ocard-header">
            ${dayBadge}
            <span class="ocard-datetime">🕐 ${dt}</span>
            <span class="ocard-product">${UI.escHtml(categoryName)}</span>
            <span class="ocard-chain">${chainCode}</span>
            ${priceBadge}
            <button type="button" class="ocard-header-edit" data-id="${o.id}" data-action="edit" title="주문서 수정">✏️</button>
          </div>
          <div class="ocard-1col">
            <div class="ocard-field">
              <span class="ocard-field-icon">📍</span>
              <span>${UI.escHtml(o.deliveryAddress)}</span>
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
            <div class="ocard-field ${recipientFieldCls}">${recipientHtml}</div>
            <div class="ocard-field ${timeFieldCls}">
              <span class="ocard-field-icon">⏱</span>
              <span>${timeText}</span>
            </div>
          </div>
        </div>
        <div class="ocard-flow">
          <div class="ocard-flow-topbar">
            <span class="ocard-flow-title">업무 흐름도</span>
            ${forceCompleteBtn}
          </div>
          <button type="button" class="ocard-flow-step ${step1State}" data-id="${o.id}" data-action="print-receipt">
            <span class="fs-num">01</span>
            <div class="fs-body">
              <div class="fs-label">${step1Label}</div>
              ${step1Sub}
            </div>
            <span class="fs-state">${step1Done ? '✓' : '→'}</span>
          </button>
          <button type="button" class="ocard-flow-step ${step2State}" data-id="${o.id}" data-action="${step2Action}" ${step2Disabled}>
            <span class="fs-num">02</span>
            <div class="fs-body">
              <div class="fs-label">${step2Label}</div>
              ${step2Done ? '<div class="fs-sub">클릭해서 보기</div>' : ''}
            </div>
            <span class="fs-state">${step2Done ? '✓' : (step2State === 'fs-active' ? '→' : '🔒')}</span>
          </button>
          <div class="ocard-flow-step ${step3State} fs-readonly">
            <span class="fs-num">03</span>
            <div class="fs-body">
              <div class="fs-label">${step3Label}</div>
              ${step3Sub}
            </div>
            <span class="fs-state">${step3Done ? '✓' : (step3State === 'fs-active' ? '⋯' : '🔒')}</span>
          </div>
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
      </div>
      <div class="form-group" style="margin-bottom:0.75rem">
        <label class="form-label">금액 (원)</label>
        <input type="number" id="no-price" class="form-control" placeholder="예: 80000" min="0" step="1000">
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
        price:           overlay.querySelector('#no-price').value,
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

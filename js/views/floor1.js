/* ============================================================
   FLOOR1.JS — 1층 제작/배차: 전체 주문 · 상태변경 · 기사배정 · 주문수정
   Bug-fixed: single event listener, single visibilitychange handler
   ============================================================ */

const Floor1View = {
  _session:     null,
  _pollTimer:   null,
  _pollFn:      null,
  _visHandler:  null,
  _actionsBound: false,

  /* ── Init (called once) ──────────────────────────────────── */
  init(session) {
    Floor1View._session = session;
    Router.register('all-orders', () => Floor1View.showAllOrders());
    Router.default('all-orders');

    /* Set up click delegation ONCE */
    document.getElementById('main-content').addEventListener('click', Floor1View._handleClick);


  },

  /* ── Filter state ────────────────────────────────────────── */
  _filterState: {
    statusGroup: '',
    driverFilter: '',    /* '' = 전체, driverId = 해당 기사 배차건만 */
    photoYes: true,
    photoNo: true,
    dateFrom: '',
    dateTo: '',
    searchAddress: '',
    searchRecipient: '',
    searchRibbon: '',
  },

  _driverStatusSubscribed: false,

  /* ── Show: all orders ────────────────────────────────────── */
  showAllOrders() {
    Floor1View._clearPoll();

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
            <button class="status-tab-btn" data-sg="0,1,2">주문접수</button>
            <button class="status-tab-btn" data-sg="unassigned">배차전</button>
            <button class="status-tab-btn" data-sg="assigned">배차완료</button>
            <button class="status-tab-btn" data-sg="3">배송중</button>
            <button class="status-tab-btn" data-sg="4">배송완료</button>
            <button class="status-tab-btn" data-sg="5,6">주문취소</button>
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
        </div>

        <!-- Row 2: Date range -->
        <div class="filter-row">
          <span class="filter-label">배송요청일</span>
          <div class="date-range-box">
            <span class="date-icon">📅</span>
            <input type="date" id="f1-date-from" value="">
            <span class="date-sep">~</span>
            <input type="date" id="f1-date-to" value="">
          </div>
          <div class="status-tab-group" id="f1-quick-dates">
            <button class="status-tab-btn active" data-quick="all">전체</button>
            <button class="status-tab-btn" data-quick="today">당일건</button>
            <button class="status-tab-btn" data-quick="tomorrow">내일</button>
            <button class="status-tab-btn" data-quick="yesterday">어제</button>
            <button class="status-tab-btn" data-quick="future">예약건</button>
            <button class="status-tab-btn" data-quick="this-month">이번달</button>
            <button class="status-tab-btn" data-quick="last-month">지난달</button>
          </div>
        </div>

        <!-- Row 3: Driver filter (출근처리 기사만) -->
        <div class="filter-row">
          <span class="filter-label">기사별조회</span>
          <div class="status-tab-group" id="f1-driver-tabs">
            <!-- rendered by _renderDriverFilter() -->
          </div>
        </div>

        <!-- Row 4: Text search -->
        <div class="filter-row" style="padding-top:0.6rem;padding-bottom:0.6rem">
          <div class="search-fields-group">
            <div class="search-field-item">
              <span class="search-field-label">🔍 배송지</span>
              <input type="text" id="f1-search-address" class="search-field-input" placeholder="주소지를 입력해주세요">
            </div>
            <div class="search-field-item">
              <span class="search-field-label">🔍 받는분</span>
              <input type="text" id="f1-search-recipient" class="search-field-input" placeholder="받는 분 성함을 입력해주세요">
            </div>
            <div class="search-field-item">
              <span class="search-field-label">🔍 보내는분</span>
              <input type="text" id="f1-search-ribbon" class="search-field-input" placeholder="리본 문구를 입력해주세요">
            </div>
          </div>
        </div>

      </div>`);

    Floor1View._bindFilterEvents();
    Floor1View._applyQuickDate('all');
    Floor1View._renderDriverFilter();
    Floor1View._ensureDriverStatusSub();
    Floor1View._loadOrders();
  },

  /* ── 출근처리된 기사 목록 렌더 ─────────────────────────────
     "출근처리" 정의: isActive === true 이면서 휴무(off-duty) 아님.
     - remote /driverStatus.badge === 'off' 또는 offduty === true → 제외
     - 그 외엔 localStorage 'maydaegu.driver.offduty.{id}' === '1' 이면 제외 */
  _isDriverOnDuty(d) {
    if (!d || d.isActive === false) return false;
    const ds = (typeof DeliveryPanel !== 'undefined') ? (DeliveryPanel._driverStatus || {}) : {};
    const rs = ds[d.id];
    if (rs?.badge === 'off') return false;
    if (rs?.offduty === true) return false;
    try {
      if (localStorage.getItem(`maydaegu.driver.offduty.${d.id}`) === '1') return false;
    } catch (_) {}
    return true;
  },

  _renderDriverFilter() {
    const host = document.getElementById('f1-driver-tabs');
    if (!host) return;

    const drivers = (Store.getDrivers ? Store.getDrivers() : []) || [];
    const active = drivers.filter(Floor1View._isDriverOnDuty);

    const current = Floor1View._filterState.driverFilter || '';
    const allActive = current === '' ? 'active' : '';

    const driverBtns = active.map(d => {
      const on = current === d.id ? 'active' : '';
      return `<button class="status-tab-btn ${on}" data-driver-id="${UI.escHtml(d.id)}">${UI.escHtml(d.name || '-')}</button>`;
    }).join('');

    const emptyHint = active.length
      ? ''
      : `<span style="color:var(--text-muted);font-size:0.825rem;margin-left:0.25rem">출근처리된 기사가 없습니다.</span>`;

    host.innerHTML = `
      <button class="status-tab-btn ${allActive}" data-driver-id="">전체</button>
      ${driverBtns}
      ${emptyHint}`;

    /* 선택한 기사가 출근 목록에서 빠진 경우 자동 해제 */
    if (current && !active.some(d => d.id === current)) {
      Floor1View._filterState.driverFilter = '';
    }
  },

  _ensureDriverStatusSub() {
    if (Floor1View._driverStatusSubscribed) return;
    if (!window.FirebaseDB) return;
    Floor1View._driverStatusSubscribed = true;
    /* driverStatus 변경 → 기사별조회 필터 버튼 재구성 */
    window.FirebaseDB.ref('driverStatus').on('value', () => {
      if (document.getElementById('f1-driver-tabs')) {
        Floor1View._renderDriverFilter();
      }
    });
    /* 기사 마스터(/drivers) 변경 → 재구성 */
    if (Store.onUpdate) {
      Store.onUpdate('drivers', () => {
        if (document.getElementById('f1-driver-tabs')) Floor1View._renderDriverFilter();
      });
    }
  },

  /* ── Bind filter events ──────────────────────────────────── */
  _bindFilterEvents() {
    document.getElementById('f1-status-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.status-tab-btn');
      if (!btn) return;
      document.querySelectorAll('#f1-status-tabs .status-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Floor1View._filterState.statusGroup = btn.dataset.sg;
      Floor1View._loadOrders();
    });

    document.getElementById('f1-photo-yes').addEventListener('change', e => {
      Floor1View._filterState.photoYes = e.target.checked;
      Floor1View._loadOrders();
    });
    document.getElementById('f1-photo-no').addEventListener('change', e => {
      Floor1View._filterState.photoNo = e.target.checked;
      Floor1View._loadOrders();
    });

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

    document.getElementById('f1-quick-dates').addEventListener('click', e => {
      const btn = e.target.closest('.status-tab-btn');
      if (!btn) return;
      document.querySelectorAll('#f1-quick-dates .status-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Floor1View._applyQuickDate(btn.dataset.quick);
      Floor1View._loadOrders();
    });

    document.getElementById('f1-driver-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.status-tab-btn');
      if (!btn) return;
      document.querySelectorAll('#f1-driver-tabs .status-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Floor1View._filterState.driverFilter = btn.dataset.driverId || '';
      Floor1View._loadOrders();
    });

    ['f1-search-address','f1-search-recipient','f1-search-ribbon'].forEach(id => {
      let t;
      document.getElementById(id).addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (id === 'f1-search-address')   Floor1View._filterState.searchAddress   = e.target.value.trim();
          if (id === 'f1-search-recipient') Floor1View._filterState.searchRecipient = e.target.value.trim();
          if (id === 'f1-search-ribbon')    Floor1View._filterState.searchRibbon    = e.target.value.trim();
          Floor1View._loadOrders();
        }, 280);
      });
    });

  },

  _applyQuickDate(quick) {
    const today = new Date();
    let from, to;
    const fmt = d => {
      const p = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    };
    if (quick === 'all') {
      Floor1View._filterState.dateFrom = '';
      Floor1View._filterState.dateTo   = '';
      const elF = document.getElementById('f1-date-from'); if (elF) elF.value = '';
      const elT = document.getElementById('f1-date-to');   if (elT) elT.value = '';
      return;
    }
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
      const d    = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      from = fmt(d); to = fmt(last);
    } else if (quick === 'future') {
      const d = new Date(today); d.setDate(d.getDate()+1);
      const far = new Date(today); far.setFullYear(far.getFullYear()+1);
      from = fmt(d); to = fmt(far);
    }
    if (from) { Floor1View._filterState.dateFrom = from; const el = document.getElementById('f1-date-from'); if (el) el.value = from; }
    if (to)   { Floor1View._filterState.dateTo   = to;   const el = document.getElementById('f1-date-to');   if (el) el.value = to; }
  },

  _clearQuickActive() {
    document.querySelectorAll('#f1-quick-dates .status-tab-btn').forEach(b => b.classList.remove('active'));
  },

  /* ── Load & filter orders ────────────────────────────────── */
  async _loadOrders() {
    UI.loading(true);
    try {
      const all = Store.getOrders();
      const fs = Floor1View._filterState;
      let orders = all;

      if (fs.statusGroup === 'unassigned') {
        /* 배차전: 배차되지 않은 미완료 건 (취소/반품/완료 제외) */
        orders = orders.filter(o =>
          !o.assignedDriverId &&
          o.status !== 4 && o.status !== 5 && o.status !== 6
        );
      } else if (fs.statusGroup === 'assigned') {
        /* 배차완료: 기사에게 배차되었으나 아직 배송완료/취소 전 */
        orders = orders.filter(o =>
          !!o.assignedDriverId &&
          o.status !== 4 && o.status !== 5 && o.status !== 6
        );
      } else if (fs.statusGroup !== '') {
        const allowed = fs.statusGroup.split(',').map(Number);
        orders = orders.filter(o => allowed.includes(o.status));
      }

      if (fs.driverFilter) {
        orders = orders.filter(o => o.assignedDriverId === fs.driverFilter);
      }

      if (fs.photoYes && !fs.photoNo)  orders = orders.filter(o => !!o.deliveryPhotoUrl);
      if (!fs.photoYes && fs.photoNo)  orders = orders.filter(o => !o.deliveryPhotoUrl);
      if (!fs.photoYes && !fs.photoNo) orders = [];

      const _toLocalDate = iso => {
        if (!iso) return '';
        const d = new Date(iso);
        const p = n => String(n).padStart(2,'0');
        return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
      };
      if (fs.dateFrom) orders = orders.filter(o => _toLocalDate(o.deliveryDatetime) >= fs.dateFrom);
      if (fs.dateTo)   orders = orders.filter(o => _toLocalDate(o.deliveryDatetime) <= fs.dateTo);

      const lc = s => (s || '').toLowerCase();
      if (fs.searchAddress)   orders = orders.filter(o => lc(o.deliveryAddress).includes(lc(fs.searchAddress)));
      if (fs.searchRecipient) orders = orders.filter(o => lc(o.recipientName).includes(lc(fs.searchRecipient)));
      if (fs.searchRibbon)    orders = orders.filter(o => lc(o.ribbonText).includes(lc(fs.searchRibbon)));

      /* Sort: 당일건 → 예약건 → 완료건 → 기타 (과거/취소) */
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

      Floor1View._renderOrders(orders);
      if (typeof DeliveryPanel !== 'undefined') DeliveryPanel.render();
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
    UI.setMain(`<div class="order-list">${orders.map(o => Floor1View._orderCard(o, true)).join('')}</div>`);
    Floor1View._updateBulkBar();
  },

  /* ── Order card (3 fixed action buttons) ────────────────── */
  _orderCard(o, showActions) {
    const dt = UI.fmtDatetime(o.deliveryDatetime);

    /* Ribbon field */
    const ribbonHtml = o.ribbonText
      ? `<span class="ocard-field-icon">🎀</span><span data-copy="${UI.escHtml(o.ribbonText)}" class="ocard-field-copy" title="클릭 시 클립보드 복사">${UI.escHtml(o.ribbonText)}</span>`
      : `<span class="ocard-field-icon">🎀</span><span style="color:var(--text-muted);font-style:italic">문구 없음</span>`;

    /* Occasion field */
    const occasionHtml = o.occasionText
      ? `<span class="ocard-field-icon">📝</span><span data-copy="${UI.escHtml(o.occasionText)}" class="ocard-field-copy" title="클릭 시 클립보드 복사">${UI.escHtml(o.occasionText)}</span>`
      : `<span class="ocard-field-icon">📝</span><span style="color:var(--text-muted);font-style:italic">경조사어 없음</span>`;

    /* 받는 분 정보 (row3 좌측) — Address 와 동일 스타일 (노란 배경/복사 없음) */
    const recipientHtml = o.recipientName
      ? `<span class="ocard-field-icon">👤</span><span>${UI.escHtml(o.recipientName)}${o.recipientPhone ? ` / ${UI.escHtml(o.recipientPhone)}` : ''}</span>`
      : `<span class="ocard-field-icon">👤</span><span style="color:var(--text-muted);font-style:italic">받는 분 미입력</span>`;

    /* Day badge */
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

    /* Chain code (deterministic per order id — string hash) */
    const _chainCodes = ['ㄲㅌ','ㅂㅎㄷ','ㄷㅍㄹㅇ','ㄷㄹ','ㅇㅎ','ㅄㅌ'];
    const _chainIdx = String(o.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const chainCode = _chainCodes[_chainIdx % _chainCodes.length];

    const _prod = Store.getProductById(o.productId);
    const _cat  = _prod ? Store.getCategoryById(_prod.category) : null;
    const categoryName = _cat ? _cat.name : o.productName;
    const priceBadge = o.price != null
      ? `<span class="ocard-price">${Number(o.price).toLocaleString('ko-KR')}원</span>` : '';

    /* Time field */
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
    const step3Sub = step3Done && o.assignedAt
      ? `<div class="fs-sub">${UI.fmtDatetime(o.assignedAt)}</div>`
      : '';

    const step1Disabled = '';
    const step2Disabled = step2State === 'fs-locked' ? 'disabled' : '';
    const step3Disabled = step3State === 'fs-locked' ? 'disabled' : '';

    /* 인쇄 완료 timestamp 표시 */
    const step1Sub = step1Done && o.receiptPrintedAt
      ? `<div class="fs-sub">${UI.fmtDatetime(o.receiptPrintedAt)}</div>`
      : '';

    /* 주문 종료 상태 (완료/취소) → 전체 흐름 읽기전용 */
    const terminated = o.status === 4 || o.status >= 5;
    const forceCompleteBtn = !terminated
      ? `<button type="button" class="ocard-flow-mini-btn f1-action" data-id="${o.id}" data-action="force-complete" title="강제 배송완료">✓ 강제완료</button>`
      : '';

    return `
      <div class="order-card" data-id="${o.id}" data-status="${o.status}">
        <div class="ocard-body">
          <!-- Header: checkbox · chain · product · datetime · edit -->
          <div class="ocard-header">
            <input type="checkbox" class="ocard-checkbox order-checkbox" data-id="${o.id}" title="선택">
            ${dayBadge}
            <span class="ocard-datetime">🕐 ${dt}</span>
            <span class="ocard-product">${UI.escHtml(categoryName)}</span>
            ${Floor1View._session?.role === 'floor1' ? '' : `<span class="ocard-chain">${chainCode}</span>`}
            ${priceBadge}
            <button type="button" class="ocard-header-edit f1-action" data-id="${o.id}" data-action="edit" title="주문서 수정">✏️</button>
          </div>
          <!-- Row 1: Address (full width, 클릭 시 복사) -->
          <div class="ocard-1col">
            <div class="ocard-field">
              <span class="ocard-field-icon">📍</span>
              <span data-copy="${UI.escHtml(o.deliveryAddress)}" class="ocard-field-copy" title="클릭 시 클립보드 복사">${UI.escHtml(o.deliveryAddress)}</span>
            </div>
          </div>
          <!-- Row 2: Ribbon | Occasion (2-col) -->
          <div class="ocard-2col">
            <div class="ocard-field ${!o.ribbonText ? 'ocard-empty' : ''}">
              ${ribbonHtml}
            </div>
            <div class="ocard-field ${!o.occasionText ? 'ocard-empty' : ''}">
              ${occasionHtml}
            </div>
          </div>
          <!-- Row 3: Recipient | Time -->
          <div class="ocard-2col">
            <div class="ocard-field">${recipientHtml}</div>
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
          <button type="button" class="ocard-flow-step ${step1State} f1-action" data-id="${o.id}" data-action="print-receipt" ${step1Disabled}>
            <span class="fs-num">01</span>
            <div class="fs-body">
              <div class="fs-label">${step1Label}</div>
              ${step1Sub}
            </div>
            <span class="fs-state">${step1Done ? '✓' : '→'}</span>
          </button>
          <button type="button" class="ocard-flow-step ${step2State} f1-action" data-id="${o.id}" data-action="${step2Action}" ${step2Disabled}>
            <span class="fs-num">02</span>
            <div class="fs-body">
              <div class="fs-label">${step2Label}</div>
              ${step2Done ? '<div class="fs-sub">클릭해서 보기</div>' : ''}
            </div>
            <span class="fs-state">${step2Done ? '✓' : (step2State === 'fs-active' ? '→' : '🔒')}</span>
          </button>
          <button type="button" class="ocard-flow-step ${step3State} f1-action" data-id="${o.id}" data-action="assign" ${step3Disabled}>
            <span class="fs-num">03</span>
            <div class="fs-body">
              <div class="fs-label">${step3Label}</div>
              ${step3Sub}
            </div>
            <span class="fs-state">${step3Done ? '✓' : (step3State === 'fs-active' ? '→' : '🔒')}</span>
          </button>
        </div>
      </div>`;
  },

  /* ── Click handler (single, delegated) ───────────────────── */
  _handleClick: async function(e) {
    const actionBtn = e.target.closest('.f1-action');
    if (actionBtn) {
      try { await Floor1View._handleAction(actionBtn.dataset.id, actionBtn.dataset.action, actionBtn); }
      catch(e) { UI.toast(e.message || '처리 중 오류가 발생했습니다.', 'error'); }
      return;
    }
    const copyEl = e.target.closest('[data-copy]');
    if (copyEl) {
      try {
        await navigator.clipboard.writeText(copyEl.dataset.copy);
        UI.toast('클립보드에 복사했습니다.', 'success', 2000);
      } catch { UI.toast('클립보드 복사 실패', 'error'); }
      return;
    }
    const checkbox = e.target.closest('.order-checkbox');
    if (checkbox) {
      Floor1View._updateBulkBar();
      return;
    }
  },

  /* ── Receipt / Print Modal ──────────────────────────────── */
  _openReceiptModal(orderId) {
    const session = Auth.getSession();
    const o = Store.getOrderById(orderId);
    if (!o) { UI.toast('주문 정보를 찾을 수 없습니다.', 'error'); return; }

    /* Driver role: open completion modal instead */
    if (session?.role === 'driver' && o.status < 4) {
      DriverView._openCompleteModal(orderId);
      return;
    }

    Floor1View._openBulkReceiptPrint([orderId]);
  },

  /* ── Bulk receipt print (one order per page) ─────────────
     각 주문을 한 장씩 분리 출력 — 추후 Chrome Kiosk / Local Print Agent 연동 대비. */
  _openBulkReceiptPrint(orderIds) {
    if (!Array.isArray(orderIds) || !orderIds.length) {
      UI.toast('선택된 주문이 없습니다.', 'warning'); return;
    }

    const orders = orderIds
      .map(id => Store.getOrderById(id))
      .filter(Boolean);

    if (!orders.length) { UI.toast('선택 주문 정보를 찾을 수 없습니다.', 'error'); return; }

    const printWin = window.open('', '_blank', 'width=720,height=900');
    if (!printWin) { UI.toast('팝업 창 허용 후 다시 시도해 주세요.', 'warning'); return; }

    const printDate = new Date().toLocaleString('ko-KR');
    const pages = orders.map((o, idx) => Floor1View._buildReceiptPageHtml(o, idx === orders.length - 1, printDate)).join('');

    printWin.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>배송 인수증 — ${orders.length}건</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #f1f5f9; }
    body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1e293b; font-size: 14px; }
    .page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      margin: 10px auto;
      padding: 40px;
      background: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    h1  { font-size: 1.4rem; text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 0.75rem; margin-bottom: 1.25rem; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; background: #eff6ff; color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
    th { background: #f1f5f9; text-align: left; padding: 9px 14px; width: 110px; font-size: 13px; border: 1px solid #e2e8f0; color: #475569; }
    td { padding: 9px 14px; border: 1px solid #e2e8f0; font-size: 14px; line-height: 1.5; }
    .footer { text-align: center; margin-top: 2rem; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 1rem; }
    .sign-area { margin-top: 2rem; display: flex; justify-content: flex-end; gap: 3rem; font-size: 13px; }
    .sign-box  { text-align: center; }
    .sign-line { border-bottom: 1px solid #1e293b; width: 120px; margin-top: 2rem; }
    @media print {
      html, body { background: #fff; }
      .page {
        margin: 0;
        box-shadow: none;
        width: auto;
        min-height: auto;
        padding: 20mm 15mm;
      }
    }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>
${pages}
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    printWin.document.close();
  },

  _buildReceiptPageHtml(o, _isLast, printDate) {
    const statusLabels = ['접수대기','리본출력완료','제작완료','배송중','배송완료','취소','반품'];
    const statusLabel  = statusLabels[o.status] || '-';
    const dt = UI.fmtDatetime(o.deliveryDatetime);
    const esc = (s) => UI.escHtml(String(s ?? ''));

    return `
<section class="page">
  <h1>🌸 배송 인수증</h1>
  <table>
    <tr><th>주문번호</th><td>#${esc(o.id)} &nbsp; <span class="badge">${esc(statusLabel)}</span></td></tr>
    <tr><th>체인명</th><td>${esc(o.chainName || '-')}</td></tr>
    <tr><th>상품</th><td>${esc(o.productName || '-')}</td></tr>
    <tr><th>배송 일시</th><td>${esc(dt)}</td></tr>
    <tr><th>배송지</th><td>${esc(o.deliveryAddress || '-')}</td></tr>
    <tr><th>받는 분</th><td>${esc(o.recipientName || '-')}${o.recipientPhone ? ' / ' + esc(o.recipientPhone) : ''}</td></tr>
    <tr><th>보내는분 문구</th><td>${esc(o.ribbonText || '-')}</td></tr>
    <tr><th>경조사어</th><td>${esc(o.occasionText || '-')}</td></tr>
    <tr><th>배송기사</th><td>${esc(o.assignedDriverName || '-')}</td></tr>
    <tr><th>접수자</th><td>${esc(o.createdByName || '-')}</td></tr>
  </table>
  <div class="sign-area">
    <div class="sign-box"><div class="sign-line"></div><div style="margin-top:6px">배송기사 서명</div></div>
    <div class="sign-box"><div class="sign-line"></div><div style="margin-top:6px">수령인 서명</div></div>
  </div>
  <div class="footer">메이대구 &nbsp;|&nbsp; ${esc(printDate)}</div>
</section>`;
  },

  /* ── Action handler ──────────────────────────────────────── */
  async _handleAction(id, action, btn) {
    if (action === 'edit')             { await Floor1View._openEditModal(id);       return; }
    if (action === 'store-photo')      { await Floor1View._openStorePhotoModal(id); return; }
    if (action === 'view-store-photo') {
      const o = Store.getOrderById(id);
      if (o?.storePhotoUrl) window.open(o.storePhotoUrl);
      return;
    }
    if (action === 'receipt' || action === 'print-receipt') {
      Floor1View._openReceiptModal(id);
      /* 인수증 인쇄 버튼 클릭 시점을 기록 (업무 흐름도 1단계 완료) */
      Api.markReceiptPrinted(id).catch(err => console.warn('[Floor1] markReceiptPrinted:', err));
      return;
    }
    if (action === 'force-complete')   { await Floor1View._forceComplete(id);       return; }
    if (action === 'assign')           { await Floor1View._openAssignModal([id]);   return; }
  },

  async _forceComplete(orderId) {
    const o = Store.getOrderById(orderId);
    if (!o) { UI.toast('주문 정보를 찾을 수 없습니다.', 'error'); return; }
    if (o.status === 4) { UI.toast('이미 배송완료 상태입니다.', 'info'); return; }
    if (o.status >= 5)  { UI.toast('취소된 주문은 변경할 수 없습니다.', 'warning'); return; }
    if (!confirm('강제로 배송완료 처리하시겠습니까?\n사진 업로드 없이 상태가 변경됩니다.')) return;
    await Api.updateOrderStatus(orderId, 4);
    UI.toast('배송완료 처리되었습니다.', 'success');
  },

  /* ── Store Photo Upload Modal ────────────────────────────── */
  _openStorePhotoModal(orderId) {
    const o = Store.getOrderById(orderId);
    if (!o) { UI.toast('주문 정보를 찾을 수 없습니다.', 'error'); return; }

    let selectedFile = null;
    let objectUrl = null;

    const content = `
      <p style="color:var(--text-secondary);margin-bottom:0.75rem">
        <strong>#${orderId}</strong> — ${UI.escHtml(o.chainName || '-')}
      </p>
      <label class="photo-drop-zone-portrait" id="sp-drop-zone" for="sp-input">
        <input type="file" id="sp-input" accept="image/jpeg,image/png">
        <div class="sp-msg-inner" id="sp-msg">
          <div style="font-size:2rem">🏪</div>
          <div style="font-size:0.9rem">클릭 또는 드래그</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">jpg, png / 최대 5MB</div>
        </div>
        <img id="sp-preview" style="display:none" alt="미리보기">
      </label>
      <div id="sp-info" style="font-size:0.825rem;color:var(--text-muted);margin-top:0.5rem;text-align:center"></div>`;

    const overlay = UI.modal({ title: `매장사진 등록 — #${orderId}`, content, confirmText: '저장', cancelText: '취소' });

    const handleFile = file => {
      if (!file) return;
      if (file.size > 5*1024*1024) { UI.toast('5MB 이하 파일만 허용됩니다.', 'error'); return; }
      if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) { UI.toast('jpg, png만 허용됩니다.', 'error'); return; }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      selectedFile = file;
      const preview = overlay.querySelector('#sp-preview');
      overlay.querySelector('#sp-msg').style.display = 'none';
      preview.src = objectUrl; preview.style.display = 'block';
      overlay.querySelector('#sp-info').textContent = `${file.name} (${(file.size/1024).toFixed(0)} KB)`;
    };

    overlay.querySelector('#sp-input').addEventListener('change', e => handleFile(e.target.files[0]));
    const dz = overlay.querySelector('#sp-drop-zone');
    dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });

    const confirmBtn = overlay.querySelector('.modal-confirm');
    confirmBtn.onclick = async () => {
      if (!selectedFile) { UI.toast('사진을 선택해 주세요.', 'warning'); return; }
      confirmBtn.disabled = true; confirmBtn.textContent = '저장 중...';
      try {
        const { url } = await Api.uploadStorePhoto(selectedFile, orderId);
        await Api.updateOrder(orderId, { storePhotoUrl: url });
        UI.toast('매장사진이 등록되었습니다.', 'success');
        overlay.classList.remove('show');
        setTimeout(() => { overlay.remove(); if (objectUrl) URL.revokeObjectURL(objectUrl); }, 300);
        if (typeof Floor1View !== 'undefined' && Floor1View._loadOrders) Floor1View._loadOrders();
        if (typeof Floor2View !== 'undefined' && Floor2View._loadMyOrders) Floor2View._loadMyOrders();
      } catch(e) {
        UI.toast(e.message || '저장 실패', 'error');
        confirmBtn.disabled = false; confirmBtn.textContent = '저장';
      }
    };
  },

  /* ── Order Edit Modal (role-aware) ──────────────────────── */
  async _openEditModal(orderId) {
    const o = Store.getOrderById(orderId);
    if (!o) { UI.toast('주문 정보를 찾을 수 없습니다.', 'error'); return; }

    const session = Auth.getSession();
    const role    = session?.role || '';
    const isFloor1Admin = role === 'floor1' || role === 'admin';
    const isDriver      = role === 'driver';
    const rdonly = s => isDriver ? `readonly title="${s}"` : '';

    let products = [], drivers = [];
    try { [products, drivers] = await Promise.all([Api.getProducts(true), Api.getDrivers()]); }
    catch(e) { UI.toast('데이터 로드 실패', 'error'); return; }

    const productOpts = products.map(p =>
      `<option value="${p.id}" ${p.id === o.productId ? 'selected' : ''}>${UI.escHtml(p.name)}${p.isActive === false ? ' (비활성)' : ''}</option>`
    ).join('');

    const _pad2 = n => String(n).padStart(2,'0');
    const _DOW_KR = ['일','월','화','수','목','금','토'];
    const toLocalDT = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      return `${d.getFullYear()}-${_pad2(d.getMonth()+1)}-${_pad2(d.getDate())}T${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`;
    };
    const fmtKorDT = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      return `${d.getFullYear()}년 ${_pad2(d.getMonth()+1)}월 ${_pad2(d.getDate())}일 ${_DOW_KR[d.getDay()]}요일 ${_pad2(d.getHours())}시 ${_pad2(d.getMinutes())}분`;
    };

    let storeFile = null, delivFile = null;
    let storeObjectUrl = o.storePhotoUrl || null;
    let delivObjectUrl = o.deliveryPhotoUrl || null;

    /* ── Status stepper (auto-derived from data; read-only) ──
       단계별 활성 조건은 DB 필드로 자동 판정 — 사용자 편집 불가.
        1) 주문접수    : 항상 완료 (주문이 존재)
        2) 리본 인쇄   : o.status >= 1 (리본출력완료 상태 이상)
        3) 인수증 인쇄 : !!o.receiptPrintedAt
        4) 제작완료    : !!o.storePhotoUrl (매장사진 업로드 시)
        5) 배차대기/배차완료 : !!o.assignedDriverId 이면 '배차완료' 로 라벨 교체
        6) 배송완료    : !!o.deliveryPhotoUrl || o.status === 4 */
    const isAssigned = !!o.assignedDriverId;
    const stepDefs = [
      { label: '주문접수',    done: true },
      { label: '리본 인쇄',   done: (o.status ?? 0) >= 1 },
      { label: '인수증 인쇄', done: !!o.receiptPrintedAt },
      { label: '제작완료',    done: !!o.storePhotoUrl },
      { label: isAssigned ? '배차완료' : '배차대기', done: isAssigned },
      { label: '배송완료',    done: !!o.deliveryPhotoUrl || o.status === 4 },
    ];
    const isCancelled = o.status === 5 || o.status === 6;
    const cancelLabel = o.status === 5 ? '주문취소' : o.status === 6 ? '반품' : '';
    const firstUndoneIdx = stepDefs.findIndex(s => !s.done);
    const stepsHtml = stepDefs.map((s, i) => {
      let cls = '';
      if (isCancelled) cls = 'eo-step-void';
      else if (s.done) cls = 'eo-step-done';
      else if (i === firstUndoneIdx) cls = 'eo-step-current';
      return `
        <div class="eo-step ${cls}" aria-label="${s.label}">
          <span class="eo-step-num">${String(i+1).padStart(2,'0')}</span>
          <span class="eo-step-nm">${s.label}</span>
        </div>`;
    }).join('');
    const currentStatusLabel = isCancelled
      ? cancelLabel
      : (firstUndoneIdx === -1 ? '배송완료' : stepDefs[firstUndoneIdx].label);

    /* 가격 초기값 (금액 input value 에 사용) */
    const initPrice = o.price != null ? Number(o.price).toLocaleString('ko-KR') : '';

    const stepperHtml = `
      <div class="eo-status-wrap">
        <div class="eo-status-head">
          <span class="eo-status-lbl">현재 상태 <span class="eo-status-auto">· 자동 반영</span></span>
          <span class="eo-status-current ${isCancelled ? 'eo-status-void' : ''}">${UI.escHtml(currentStatusLabel)}</span>
        </div>
        <div class="eo-stepper">${stepsHtml}</div>
      </div>`;

    /* ── Activity log (compact, derived from timestamps) ── */
    const activityItems = [];
    if (o.createdAt) activityItems.push({ dot: 'ink', title: '주문 접수', by: o.createdByName || '시스템', ts: o.createdAt });
    if (o.storePhotoUrl && o.updatedAt) activityItems.push({ dot: 'acc', title: '매장사진 업로드', by: '담당자', ts: o.updatedAt });
    if (o.assignedAt) activityItems.push({ dot: 'acc', title: `${UI.escHtml(o.assignedDriverName || '기사')} 배차`, by: '담당자', ts: o.assignedAt });
    if (o.memoCreatedAt) activityItems.push({ dot: 'acc', title: '메모 작성', by: o.memoCreatedBy || '담당자', ts: o.memoCreatedAt });
    if (o.memoUpdatedAt && o.memoUpdatedAt !== o.memoCreatedAt) activityItems.push({ dot: 'acc', title: '메모 변경', by: o.memoUpdatedBy || '담당자', ts: o.memoUpdatedAt });
    if (o.status === 4 && o.deliveryPhotoUrl && o.updatedAt) activityItems.push({ dot: 'ok', title: '배송 완료', by: o.assignedDriverName || '기사', ts: o.updatedAt });
    /* 타임스탬프 순 정렬 */
    activityItems.sort((a,b) => String(a.ts || '').localeCompare(String(b.ts || '')));
    const fmtActTs = iso => {
      try { const d = new Date(iso); const p = n => String(n).padStart(2,'0');
        return `${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
      } catch (_) { return ''; }
    };
    const actHtml = activityItems.length ? activityItems.slice(-12).reverse().map(a => `
      <li class="eo-act-item">
        <span class="eo-act-dot eo-act-dot-${a.dot}"></span>
        <div class="eo-act-body">
          <div class="eo-act-title">${a.title}</div>
          <div class="eo-act-meta">${UI.escHtml(a.by)} · ${fmtActTs(a.ts)}</div>
        </div>
      </li>`).join('') : `<li class="eo-act-empty">활동 내역 없음</li>`;

    /* ── 메모 (담당자 작성용 — 단일 문자열 필드, 저장 시 함께 반영) ── */
    const memoInit = typeof o.memo === 'string' ? o.memo : '';

    /* ── Middle panel: 이미지 업로드 + 메세지 ── */
    const middlePanel = isDriver ? `
      <section class="eo-section">
        <div class="eo-sec-head"><h3>이미지 업로드</h3><span class="eo-sec-sep"></span></div>
        <div class="eo-photo-card" style="max-width:260px;margin:0 auto">
          <div class="eo-ph-head">
            <span class="eo-ph-title">📷 배송완료 사진</span>
            <span class="eo-timebadge eo-tb-post">배송 후</span>
          </div>
          <label class="eo-photo-area" id="drv-drop-zone" for="drv-complete-input">
            <input type="file" id="drv-complete-input" accept="image/jpeg,image/png">
            <div class="eo-photo-placeholder" id="drv-drop-msg">
              <div style="font-size:1.75rem">📷</div>
              <div>클릭 또는 드래그</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">jpg · png · 최대 5MB</div>
            </div>
            <img id="drv-complete-preview" style="display:none" alt="미리보기">
          </label>
          <div id="drv-complete-info" class="eo-ph-note"></div>
        </div>
      </section>` : `
      <section class="eo-section">
        <div class="eo-sec-head"><h3>이미지 업로드</h3><span class="eo-sec-sep"></span><span class="eo-sec-meta">2장</span></div>
        <div class="eo-photos">
          <div class="eo-photo-card">
            <div class="eo-ph-head">
              <span class="eo-ph-title">🏪 매장사진</span>
              <span class="eo-timebadge eo-tb-pre">배송 전</span>
            </div>
            <label class="eo-photo-area" id="eo-store-box" for="eo-store-file">
              <input type="file" id="eo-store-file" accept="image/jpeg,image/png">
              <div class="eo-photo-placeholder" id="eo-store-ph" ${storeObjectUrl ? 'style="display:none"' : ''}>
                <div style="font-size:1.5rem">🏪</div>
                <div>클릭 또는 드래그</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">jpg · png · 5MB</div>
              </div>
              <img id="eo-store-preview" ${storeObjectUrl ? `src="${storeObjectUrl}"` : 'style="display:none"'} alt="매장사진">
            </label>
          </div>
          <div class="eo-photo-card">
            <div class="eo-ph-head">
              <span class="eo-ph-title">📷 현장사진</span>
              <span class="eo-timebadge eo-tb-post">배송 후</span>
            </div>
            <label class="eo-photo-area" id="eo-deliv-box" for="eo-deliv-file">
              <input type="file" id="eo-deliv-file" accept="image/jpeg,image/png">
              <div class="eo-photo-placeholder" id="eo-deliv-ph" ${delivObjectUrl ? 'style="display:none"' : ''}>
                <div style="font-size:1.5rem">📷</div>
                <div>클릭 또는 드래그</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">jpg · png · 5MB</div>
              </div>
              <img id="eo-deliv-preview" ${delivObjectUrl ? `src="${delivObjectUrl}"` : 'style="display:none"'} alt="현장사진">
            </label>
          </div>
        </div>
      </section>
      <section class="eo-section eo-memo-section">
        <div class="eo-sec-head">
          <h3>메모</h3>
          <span class="eo-sec-sep"></span>
        </div>
        <textarea id="eo-memo" class="eo-memo-textarea" maxlength="1000" placeholder="주문과 관련한 메모를 자유롭게 적어두세요. 저장 버튼을 누르면 함께 반영됩니다.">${UI.escHtml(memoInit)}</textarea>
      </section>`;

    /* ── Right-far panel: 최근 활동 (세로 길이 길게) ── */
    const rightFarPanel = `
      <section class="eo-section eo-activity-section">
        <div class="eo-sec-head"><h3>최근 활동</h3><span class="eo-sec-sep"></span></div>
        <ul class="eo-act-list eo-act-list-tall">${actHtml}</ul>
      </section>`;

    /* ── Driver view photo link buttons (read-only) ── */
    const driverPhotoLinks = isDriver ? `
      <section class="eo-section">
        <div class="eo-sec-head"><h3>기존 사진</h3><span class="eo-sec-sep"></span></div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          ${storeObjectUrl ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${storeObjectUrl}')">🏪 매장사진 보기</button>` : '<span style="color:var(--text-muted);font-size:0.85rem">매장사진 없음</span>'}
          ${delivObjectUrl ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${delivObjectUrl}')">📷 현장사진 보기</button>` : ''}
        </div>
      </section>` : '';

    const content = `
      ${stepperHtml}
      <div class="eo-split">
        <div class="eo-left">

          <section class="eo-section">
            <div class="eo-sec-head"><h3>주문 정보</h3><span class="eo-sec-sep"></span></div>
            <div class="eo-grid eo-grid-chain-dt">
              <div class="eo-field">
                <label>체인명 <span class="eo-req">*</span></label>
                <input type="text" id="eo-chain" class="form-control" value="${UI.escHtml(o.chainName || '')}" maxlength="5" ${rdonly('조회 전용')}>
              </div>
              <div class="eo-field">
                <label>배송 일시 <span class="eo-req">*</span></label>
                <div class="eo-dt-wrap" id="eo-dt-wrap">
                  <input type="text" id="eo-dt-display" class="form-control eo-dt-display" readonly value="${UI.escHtml(fmtKorDT(o.deliveryDatetime))}" placeholder="클릭하여 날짜/시간 선택" ${isDriver?'disabled':'tabindex="0"'}>
                  <input type="hidden" id="eo-datetime" value="${toLocalDT(o.deliveryDatetime)}">
                  <span class="eo-dt-icon" aria-hidden="true">📅</span>
                </div>
              </div>
            </div>
            <div class="eo-grid eo-grid-2">
              <div class="eo-field">
                <label>상품명 <span class="eo-req">*</span></label>
                <select id="eo-product" class="form-control" ${isDriver?'disabled':''}>
                  ${productOpts}
                </select>
              </div>
              <div class="eo-field">
                <label>금액 <span class="eo-req">*</span></label>
                <div class="eo-input-row eo-has-prefix eo-has-suffix">
                  <span class="eo-prefix">₩</span>
                  <input type="text" id="eo-price" class="form-control" inputmode="numeric" value="${UI.escHtml(initPrice)}" placeholder="80,000" ${rdonly('조회 전용')}>
                  <span class="eo-suffix" id="eo-price-suffix">${initPrice ? '원' : ''}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="eo-section">
            <div class="eo-sec-head"><h3>배송</h3><span class="eo-sec-sep"></span></div>
            <div class="eo-grid eo-grid-1">
              <div class="eo-field">
                <label>배송지 주소 <span class="eo-req">*</span></label>
                <input type="text" id="eo-address" class="form-control" value="${UI.escHtml(o.deliveryAddress || '')}" ${rdonly('조회 전용')}>
              </div>
            </div>
            <div class="eo-grid eo-grid-2">
              <div class="eo-field">
                <label>받는 분 성함 <span class="eo-req">*</span></label>
                <input type="text" id="eo-name" class="form-control" value="${UI.escHtml(o.recipientName || '')}" ${rdonly('조회 전용')}>
              </div>
              <div class="eo-field">
                <label>받는 분 연락처 <span class="eo-opt">선택</span></label>
                <input type="tel" id="eo-phone" class="form-control" value="${UI.escHtml(o.recipientPhone || '')}" placeholder="010-0000-0000" ${rdonly('조회 전용')}>
              </div>
            </div>
          </section>

          <section class="eo-section">
            <div class="eo-sec-head"><h3>문구</h3><span class="eo-sec-sep"></span></div>
            <div class="eo-grid eo-grid-2">
              <div class="eo-field">
                <label>보내는분 문구 (리본) <span class="eo-req">*</span></label>
                <input type="text" id="eo-ribbon" class="form-control" value="${UI.escHtml(o.ribbonText || '')}" ${rdonly('조회 전용')}>
              </div>
              <div class="eo-field">
                <label>경조사어 문구 <span class="eo-req">*</span></label>
                <input type="text" id="eo-occasion" class="form-control" value="${UI.escHtml(o.occasionText || '')}" ${rdonly('조회 전용')} placeholder="예: 근조, 축화환, 승진축하">
              </div>
            </div>
          </section>

          ${driverPhotoLinks}
        </div>
        <div class="eo-middle">
          ${middlePanel}
        </div>
        <div class="eo-right-far">
          ${rightFarPanel}
        </div>
      </div>`;

    /* 헤더 제목: 주문서 수정 + 주문번호 · 접수자 chip */
    const titleHtml = `
      <span class="eo-title-dot" aria-hidden="true"></span>
      <span class="eo-title-main">주문서 ${isDriver ? '조회' : '수정'}</span>
      <span class="eo-title-meta">
        <button type="button" class="eo-title-chip eo-chip-id" id="eo-idchip" title="주문 ID 복사">
          <span id="eo-idtext">#${UI.escHtml(String(orderId))}</span>
          <span class="eo-chip-copy">⧉</span>
        </button>
        <span class="eo-title-chip eo-chip-user" title="접수자">
          <span class="eo-chip-label">접수자</span>
          <span class="eo-chip-value">${UI.escHtml(o.createdByName || '-')}</span>
        </span>
      </span>`;

    const overlay = UI.modal({
      title: titleHtml,
      content,
      confirmText: isDriver ? '닫기' : '저장',
      cancelText: isDriver ? '' : '취소',
      size: 'modal-edit',
    });

    /* ── ID chip copy ── */
    const idChip = overlay.querySelector('#eo-idchip');
    if (idChip) {
      idChip.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(String(orderId));
          idChip.classList.add('eo-chip-copied');
          const t = overlay.querySelector('#eo-idtext');
          const orig = t.textContent;
          t.textContent = '복사됨 ✓';
          setTimeout(() => { t.textContent = orig; idChip.classList.remove('eo-chip-copied'); }, 1200);
        } catch (_) { UI.toast('복사 실패', 'error'); }
      });
    }

    /* ── Amount live KRW formatting + suffix toggle ── */
    const priceEl = overlay.querySelector('#eo-price');
    if (priceEl && !isDriver) {
      priceEl.addEventListener('input', e => {
        const raw = e.target.value.replace(/[^\d]/g,'');
        const formatted = raw ? Number(raw).toLocaleString('ko-KR') : '';
        e.target.value = formatted;
        const sfx = overlay.querySelector('#eo-price-suffix');
        if (sfx) sfx.textContent = formatted ? '원' : '';
      });
    }

    /* ── Dirty tracking (non-driver only) ── */
    let footStatus = null, btnSaveRef = null;
    const initialSnap = {};
    const trackedSel = ['#eo-chain','#eo-product','#eo-datetime','#eo-price','#eo-address','#eo-name','#eo-phone','#eo-ribbon','#eo-occasion','#eo-memo'];
    if (!isDriver) {
      trackedSel.forEach(s => { const el = overlay.querySelector(s); if (el) initialSnap[s] = el.value; });

      /* Footer status indicator (insert before confirm button) */
      const footer = overlay.querySelector('.modal-footer');
      if (footer) {
        footStatus = document.createElement('div');
        footStatus.className = 'eo-foot-status';
        footStatus.innerHTML = `<span class="eo-foot-dot"></span><span class="eo-foot-text">모든 변경 사항 저장됨</span><span class="eo-kbd-hint"><span class="eo-kbd">Ctrl</span>+<span class="eo-kbd">S</span> 저장 · <span class="eo-kbd">Esc</span> 닫기</span>`;
        footer.insertBefore(footStatus, footer.firstChild);
      }
      btnSaveRef = overlay.querySelector('.modal-confirm');

      const isDirty = () => trackedSel.some(s => { const el = overlay.querySelector(s); return el && el.value !== initialSnap[s]; });
      const refreshFoot = () => {
        if (!footStatus) return;
        const dirty = isDirty();
        footStatus.classList.toggle('eo-foot-dirty', dirty);
        const txt = footStatus.querySelector('.eo-foot-text');
        if (txt) txt.textContent = dirty ? '저장되지 않은 변경 사항' : '모든 변경 사항 저장됨';
      };
      overlay._eoRefreshFoot = refreshFoot;
      overlay._eoSnapshotReset = () => { trackedSel.forEach(s => { const el = overlay.querySelector(s); if (el) initialSnap[s] = el.value; }); refreshFoot(); };

      trackedSel.forEach(s => {
        const el = overlay.querySelector(s);
        if (!el) return;
        const ev = (el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(ev, refreshFoot);
        el.addEventListener('change', refreshFoot);
      });
      refreshFoot();
    }

    /* ── 배송일시: 커스텀 datepicker (월 달력 + 시/분 select) ── */
    if (!isDriver) {
      Floor1View._mountDatePicker(overlay);
    }

    /* ── Keyboard shortcuts: Ctrl+S save / Esc close ── */
    const onKeydown = (e) => {
      if (!document.body.contains(overlay)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        const btn = overlay.querySelector('.modal-confirm');
        if (btn && !btn.disabled) btn.click();
      } else if (e.key === 'Escape') {
        const btn = overlay.querySelector('.modal-cancel') || overlay.querySelector('.modal-close');
        if (btn) btn.click();
      }
    };
    document.addEventListener('keydown', onKeydown);
    const _origRemove = overlay.remove.bind(overlay);
    overlay.remove = function () { document.removeEventListener('keydown', onKeydown); return _origRemove(); };

    if (isDriver) {
      /* For driver: confirm btn = close; set up photo upload for completion */
      const confirmBtn = overlay.querySelector('.modal-confirm');
      if (overlay.querySelector('.modal-cancel')) overlay.querySelector('.modal-cancel').style.display = 'none';
      confirmBtn.onclick = () => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
      };

      /* Completion photo handler */
      let drvFile = null, drvObjUrl = null;
      const handleDrvFile = file => {
        if (!file) return;
        if (file.size > 5*1024*1024) { UI.toast('파일 크기는 5MB 이하여야 합니다.', 'error'); return; }
        if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) { UI.toast('jpg, png 파일만 허용됩니다.', 'error'); return; }
        if (drvObjUrl) URL.revokeObjectURL(drvObjUrl);
        drvObjUrl = URL.createObjectURL(file);
        drvFile = file;
        const preview = overlay.querySelector('#drv-complete-preview');
        overlay.querySelector('#drv-drop-msg').style.display = 'none';
        preview.src = drvObjUrl; preview.style.display = 'block';
        overlay.querySelector('#drv-complete-info').textContent = `${file.name} (${(file.size/1024).toFixed(0)} KB)`;
      };

      const input = overlay.querySelector('#drv-complete-input');
      if (input) {
        input.addEventListener('change', e => handleDrvFile(e.target.files[0]));
        const dz = overlay.querySelector('#drv-drop-zone');
        dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
        dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); handleDrvFile(e.dataTransfer.files[0]); });
      }

      /* Add a separate "완료 처리" button inside the modal footer */
      const footer = overlay.querySelector('.modal-footer');
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn btn-success btn-sm';
      doneBtn.textContent = '📷 배송 완료 처리';
      doneBtn.style.marginRight = 'auto';
      footer.insertBefore(doneBtn, footer.firstChild);
      doneBtn.addEventListener('click', async () => {
        if (!drvFile) { UI.toast('배송 완료 사진을 첨부해 주세요.', 'warning'); return; }
        doneBtn.disabled = true; doneBtn.textContent = '처리 중...';
        try {
          const { url } = await Api.uploadDeliveryPhoto(drvFile, orderId);
          await Api.completeOrder(orderId, url);
          UI.toast('배송이 완료 처리되었습니다! 🎉', 'success');
          overlay.classList.remove('show');
          setTimeout(() => { overlay.remove(); if (drvObjUrl) URL.revokeObjectURL(drvObjUrl); }, 300);
          if (typeof DriverView !== 'undefined') DriverView._loadDeliveries?.();
        } catch(e) {
          UI.toast(e.message || '완료 처리 실패', 'error');
          doneBtn.disabled = false; doneBtn.textContent = '📷 배송 완료 처리';
        }
      });
      return;
    }

    /* ── Non-driver: photo file handlers ── */
    const handlePhotoFile = (file, previewId, placeholderId, which) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { UI.toast('5MB 이하 파일만 허용됩니다.', 'error'); return; }
      if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) { UI.toast('jpg, png 파일만 허용됩니다.', 'error'); return; }
      const url = URL.createObjectURL(file);
      const preview = overlay.querySelector(`#${previewId}`);
      const ph = overlay.querySelector(`#${placeholderId}`);
      if (ph) ph.style.display = 'none';
      preview.src = url; preview.style.display = 'block';
      if (which === 'store') { storeFile = file; storeObjectUrl = url; }
      else                   { delivFile = file; delivObjectUrl = url; }
    };

    overlay.querySelector('#eo-store-file').addEventListener('change', e => handlePhotoFile(e.target.files[0], 'eo-store-preview', 'eo-store-ph', 'store'));
    overlay.querySelector('#eo-deliv-file').addEventListener('change', e => handlePhotoFile(e.target.files[0], 'eo-deliv-preview', 'eo-deliv-ph', 'deliv'));

    /* Drag-drop for .eo-photo-area boxes */
    [['eo-store-box','eo-store-preview','eo-store-ph','store'],['eo-deliv-box','eo-deliv-preview','eo-deliv-ph','deliv']].forEach(([boxId, prevId, phId, which]) => {
      const box = overlay.querySelector(`#${boxId}`);
      if (!box) return;
      box.addEventListener('dragover',  e => { e.preventDefault(); box.classList.add('drag-over'); });
      box.addEventListener('dragleave', () => box.classList.remove('drag-over'));
      box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('drag-over'); handlePhotoFile(e.dataTransfer.files[0], prevId, phId, which); });
    });

    const confirmBtn = overlay.querySelector('.modal-confirm');
    confirmBtn.onclick = async () => {
      const chainName      = overlay.querySelector('#eo-chain').value.trim();
      const productId      = overlay.querySelector('#eo-product').value;
      const rawDT          = overlay.querySelector('#eo-datetime').value;
      const deliveryAddress= overlay.querySelector('#eo-address').value.trim();
      const recipientName  = overlay.querySelector('#eo-name').value.trim();
      const recipientPhone = overlay.querySelector('#eo-phone').value.trim();
      const ribbonText     = overlay.querySelector('#eo-ribbon').value.trim();
      const occasionText   = overlay.querySelector('#eo-occasion').value.trim();
      const priceRaw       = (overlay.querySelector('#eo-price')?.value || '').replace(/[^\d]/g, '');
      const memoText       = (overlay.querySelector('#eo-memo')?.value || '').slice(0, 1000);

      if (!chainName)       { UI.toast('체인명을 입력해 주세요.', 'warning'); return; }
      if (chainName.length > 5) { UI.toast('체인명은 최대 5자까지 입력 가능합니다.', 'warning'); return; }
      if (!productId)       { UI.toast('상품을 선택해 주세요.', 'warning'); return; }
      if (!rawDT)           { UI.toast('배송 일시를 선택해 주세요.', 'warning'); return; }
      if (!deliveryAddress) { UI.toast('배송지를 입력해 주세요.', 'warning'); return; }
      if (!recipientName)   { UI.toast('받는 분 성함을 입력해 주세요.', 'warning'); return; }
      if (!priceRaw)        { UI.toast('금액을 입력해 주세요.', 'warning'); return; }
      if (!ribbonText)      { UI.toast('보내는분 문구(리본)를 입력해 주세요.', 'warning'); return; }
      if (!occasionText)    { UI.toast('경조사어 문구를 입력해 주세요.', 'warning'); return; }

      const d = new Date(rawDT);
      if (isNaN(d.getTime())) { UI.toast('배송 일시가 올바르지 않습니다.', 'warning'); return; }
      d.setMinutes(Math.round(d.getMinutes()/10)*10); d.setSeconds(0,0);
      const deliveryDatetime = d.toISOString();

      confirmBtn.disabled = true; confirmBtn.textContent = '저장 중...';
      try {
        let newStoreUrl = o.storePhotoUrl ?? null;
        let newDelivUrl = o.deliveryPhotoUrl ?? null;
        if (storeFile) { const r = await Api.uploadStorePhoto(storeFile, orderId);   newStoreUrl = r.url; }
        if (delivFile) { const r = await Api.uploadDeliveryPhoto(delivFile, orderId); newDelivUrl = r.url; }

        /* 메모 변경 감지 → 활동 로그용 타임스탬프 + 작성자 기록 */
        const prevMemo = (o.memo || '').trim();
        const nextMemo = (memoText || '').trim();
        const memoChanged = prevMemo !== nextMemo;
        const session = Auth.getSession();
        const author  = session?.displayName || session?.username || '담당자';
        const patch = {
          chainName, productId, deliveryDatetime,
          deliveryAddress, recipientName, recipientPhone,
          ribbonText, occasionText,
          storePhotoUrl:    newStoreUrl,
          deliveryPhotoUrl: newDelivUrl,
          price: priceRaw ? Number(priceRaw) : null,
          memo: nextMemo || null,
        };
        if (memoChanged) {
          const nowIso = new Date().toISOString();
          if (!o.memoCreatedAt && nextMemo) {
            patch.memoCreatedAt = nowIso;
            patch.memoCreatedBy = author;
          }
          patch.memoUpdatedAt = nowIso;
          patch.memoUpdatedBy = author;
        }
        await Api.updateOrder(orderId, patch);

        UI.toast('주문서가 수정되었습니다.', 'success');
        /* Snapshot reset: 저장 성공 후 "저장됨" 상태로 복귀 */
        if (overlay._eoSnapshotReset) overlay._eoSnapshotReset();
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
        /* Reload the appropriate view */
        if (typeof Floor1View !== 'undefined' && Floor1View._loadOrders) Floor1View._loadOrders();
        if (typeof Floor2View !== 'undefined' && Floor2View._loadMyOrders) Floor2View._loadMyOrders();
      } catch(e) {
        UI.toast(e.message || '수정 실패', 'error');
        confirmBtn.disabled = false; confirmBtn.textContent = '저장';
      }
    };
  },

  /* ── Bulk bar ────────────────────────────────────────────── */
  _getCheckedIds() {
    return [...document.querySelectorAll('.order-checkbox:checked')].map(cb => cb.dataset.id);
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

    const session = Auth.getSession();
    const isAdmin = session && session.role === 'admin';
    const deleteBtnHtml = isAdmin
      ? `<button class="btn btn-danger btn-sm" id="bulk-delete-btn">삭제</button>`
      : '';

    bar.innerHTML = `
      <span class="bulk-count-text">${ids.length}건 선택됨</span>
      <button class="btn btn-primary btn-sm" id="bulk-assign-btn">기사 배정</button>
      <button class="btn btn-secondary btn-sm" id="bulk-print-btn">인수증 출력</button>
      ${deleteBtnHtml}
      <button class="btn btn-ghost btn-sm" id="bulk-clear-btn" style="color:#fff;border-color:rgba(255,255,255,0.25)">선택 해제</button>`;

    document.getElementById('bulk-assign-btn').onclick = () => Floor1View._openAssignModal(Floor1View._getCheckedIds());
    document.getElementById('bulk-print-btn').onclick  = () => Floor1View._openBulkReceiptPrint(Floor1View._getCheckedIds());
    document.getElementById('bulk-clear-btn').onclick  = () => {
      document.querySelectorAll('.order-checkbox:checked').forEach(cb => { cb.checked = false; });
      Floor1View._updateBulkBar();
    };
    if (isAdmin) {
      document.getElementById('bulk-delete-btn').onclick = () => Floor1View._confirmBulkDelete(Floor1View._getCheckedIds());
    }
  },

  /* 선택된 주문 일괄 삭제 (admin 전용). Storage 사진도 함께 정리. */
  async _confirmBulkDelete(ids) {
    if (!ids || !ids.length) return;
    const msg = `선택한 <b>${ids.length}건</b>의 주문을 삭제하시겠습니까?<br>
      <small style="color:var(--text-muted)">이 작업은 되돌릴 수 없으며, 매장/배송 사진도 함께 삭제됩니다.</small>`;
    const ok = await UI.confirm(msg, '주문 삭제');
    if (!ok) return;

    try {
      const res = await Api.deleteOrders(ids);
      /* 체크박스 해제 → _updateBulkBar 가 이전 선택을 다시 잡지 않도록 */
      document.querySelectorAll('.order-checkbox:checked').forEach(cb => { cb.checked = false; });
      Floor1View._removeBulkBar();

      if (res.ok && !res.failed.length) {
        UI.toast(`${res.ok}건 삭제 완료`, 'success');
      } else if (res.ok && res.failed.length) {
        UI.toast(`${res.ok}건 삭제, ${res.failed.length}건 실패`, 'warning');
        console.warn('[bulk-delete] 일부 실패', res.failed);
      } else {
        const first = res.failed[0]?.error || '알 수 없는 오류';
        UI.toast(`삭제 실패: ${first}`, 'error');
      }
      /* RTDB 구독이 자동 리렌더하지만, 혹시 렌더 타이밍이 어긋나면 강제 재조회 */
      Floor1View._loadOrders();
    } catch (e) {
      console.warn('[bulk-delete] 실패', e);
      UI.toast(e?.message || '삭제 중 오류가 발생했습니다.', 'error');
    }
  },

  _removeBulkBar() {
    const bar = document.getElementById('bulk-action-bar');
    if (bar) bar.remove();
  },

  /* ── 커스텀 날짜/시간 피커 (네이티브 datepicker 대체) ───── */
  _mountDatePicker(overlay) {
    const wrap    = overlay.querySelector('#eo-dt-wrap');
    const disp    = overlay.querySelector('#eo-dt-display');
    const hidden  = overlay.querySelector('#eo-datetime');
    if (!wrap || !disp || !hidden) return;

    const WEEKDAYS = ['일','월','화','수','목','금','토'];
    const pad = n => String(n).padStart(2, '0');
    const toLocalISO = (d) => {
      const y = d.getFullYear(), m = pad(d.getMonth()+1), day = pad(d.getDate());
      const h = pad(d.getHours()), mm = pad(d.getMinutes());
      return `${y}-${m}-${day}T${h}:${mm}`;
    };
    const parseLocal = (s) => {
      if (!s) return null;
      /* "YYYY-MM-DDTHH:MM" format */
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
      if (!m) return null;
      return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], 0, 0);
    };
    const fmtKorDT = (iso) => {
      if (!iso) return '';
      try {
        const d = (iso instanceof Date) ? iso : new Date(iso);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}년 ${pad(d.getMonth()+1)}월 ${pad(d.getDate())}일 ${WEEKDAYS[d.getDay()]}요일 ${pad(d.getHours())}시 ${pad(d.getMinutes())}분`;
      } catch (_) { return ''; }
    };

    /* 현재 값 */
    let current = parseLocal(hidden.value) || new Date();
    let viewY = current.getFullYear(), viewM = current.getMonth();

    let popup = null;

    const close = () => {
      if (!popup) return;
      popup.remove();
      popup = null;
      document.removeEventListener('mousedown', outsideClick, true);
      document.removeEventListener('keydown', onEsc, true);
    };
    const outsideClick = (e) => {
      if (!popup) return;
      if (popup.contains(e.target) || wrap.contains(e.target)) return;
      close();
    };
    const onEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };

    const apply = () => {
      hidden.value = toLocalISO(current);
      disp.value = fmtKorDT(current);
      /* 저장 상태 추적 업데이트 */
      if (overlay._eoRefreshFoot) overlay._eoRefreshFoot();
      close();
    };

    const buildGrid = () => {
      const first = new Date(viewY, viewM, 1);
      const startDow = first.getDay();
      const lastDay = new Date(viewY, viewM + 1, 0).getDate();
      const prevLast = new Date(viewY, viewM, 0).getDate();
      const cells = [];
      /* 앞쪽 여백: 이전달 날짜 (비활성) */
      for (let i = startDow - 1; i >= 0; i--) {
        cells.push({ day: prevLast - i, muted: true, disabled: true });
      }
      for (let d = 1; d <= lastDay; d++) cells.push({ day: d, muted: false });
      while (cells.length < 42) cells.push({ day: cells.length - (startDow + lastDay) + 1, muted: true, disabled: true });

      const today = new Date();
      return cells.map((c, idx) => {
        const dow = idx % 7;
        const isToday = !c.muted && viewY === today.getFullYear() && viewM === today.getMonth() && c.day === today.getDate();
        const isSel   = !c.muted && viewY === current.getFullYear() && viewM === current.getMonth() && c.day === current.getDate();
        const cls = ['eo-dp-day'];
        if (c.muted) cls.push('eo-dp-day-muted');
        if (isSel)   cls.push('eo-dp-day-sel');
        if (isToday) cls.push('eo-dp-day-today');
        if (dow === 0) cls.push('eo-dp-day-sun');
        if (dow === 6) cls.push('eo-dp-day-sat');
        const attr = c.disabled ? '' : `data-day="${c.day}"`;
        return `<button type="button" class="${cls.join(' ')}" ${attr} ${c.disabled?'tabindex="-1"':''}>${c.day}</button>`;
      }).join('');
    };

    const hourOpts = Array.from({length:24}, (_,h) => `<option value="${h}" ${h===current.getHours()?'selected':''}>${pad(h)}</option>`).join('');
    const minOpts  = Array.from({length:6},  (_,i) => { const m=i*10; return `<option value="${m}" ${m===Math.floor(current.getMinutes()/10)*10?'selected':''}>${pad(m)}</option>`; }).join('');

    const render = () => {
      if (!popup) return;
      popup.querySelector('.eo-dp-title').textContent = `${viewY}년 ${pad(viewM+1)}월`;
      popup.querySelector('.eo-dp-grid').innerHTML = buildGrid();
      /* cell 클릭 바인딩 */
      popup.querySelectorAll('.eo-dp-day[data-day]').forEach(btn => {
        btn.addEventListener('click', () => {
          current = new Date(viewY, viewM, +btn.dataset.day, current.getHours(), current.getMinutes(), 0, 0);
          render();
        });
      });
    };

    const open = () => {
      if (popup) return;
      /* 현재 값 재동기화 (외부 업데이트 대응) */
      current = parseLocal(hidden.value) || new Date();
      viewY = current.getFullYear(); viewM = current.getMonth();

      popup = document.createElement('div');
      popup.className = 'eo-dp-popup';
      popup.innerHTML = `
        <div class="eo-dp-head">
          <button type="button" class="eo-dp-nav" data-nav="prev" aria-label="이전 달">‹</button>
          <span class="eo-dp-title">${viewY}년 ${pad(viewM+1)}월</span>
          <button type="button" class="eo-dp-nav" data-nav="next" aria-label="다음 달">›</button>
        </div>
        <div class="eo-dp-dow">
          ${WEEKDAYS.map((w,i)=>`<span class="eo-dp-dow-cell ${i===0?'eo-dp-dow-sun':''} ${i===6?'eo-dp-dow-sat':''}">${w}</span>`).join('')}
        </div>
        <div class="eo-dp-grid">${buildGrid()}</div>
        <div class="eo-dp-time">
          <label>시간</label>
          <select class="eo-dp-hour">${hourOpts}</select>
          <span>시</span>
          <select class="eo-dp-min">${minOpts}</select>
          <span>분</span>
        </div>
        <div class="eo-dp-foot">
          <button type="button" class="btn btn-ghost btn-sm eo-dp-today">오늘</button>
          <div style="flex:1"></div>
          <button type="button" class="btn btn-ghost btn-sm eo-dp-cancel">취소</button>
          <button type="button" class="btn btn-primary btn-sm eo-dp-apply">적용</button>
        </div>`;
      wrap.appendChild(popup);

      popup.querySelector('[data-nav="prev"]').addEventListener('click', () => { viewM--; if (viewM<0) { viewM=11; viewY--; } render(); });
      popup.querySelector('[data-nav="next"]').addEventListener('click', () => { viewM++; if (viewM>11) { viewM=0; viewY++; } render(); });
      popup.querySelector('.eo-dp-hour').addEventListener('change', e => {
        current = new Date(current.getFullYear(), current.getMonth(), current.getDate(), +e.target.value, current.getMinutes(), 0, 0);
      });
      popup.querySelector('.eo-dp-min').addEventListener('change', e => {
        current = new Date(current.getFullYear(), current.getMonth(), current.getDate(), current.getHours(), +e.target.value, 0, 0);
      });
      popup.querySelector('.eo-dp-today').addEventListener('click', () => {
        const t = new Date();
        current = new Date(t.getFullYear(), t.getMonth(), t.getDate(), current.getHours(), current.getMinutes(), 0, 0);
        viewY = current.getFullYear(); viewM = current.getMonth();
        render();
      });
      popup.querySelector('.eo-dp-cancel').addEventListener('click', close);
      popup.querySelector('.eo-dp-apply').addEventListener('click', apply);

      render();

      /* 바깥 클릭 / ESC 닫기 — 다음 틱에 등록 (현재 클릭 이벤트 충돌 방지) */
      setTimeout(() => {
        document.addEventListener('mousedown', outsideClick, true);
        document.addEventListener('keydown', onEsc, true);
      }, 0);
    };

    const openClick = (e) => { e.preventDefault(); open(); };
    disp.addEventListener('click', openClick);
    disp.addEventListener('focus', openClick);
    /* icon 영역 클릭 시에도 열기 */
    const icon = wrap.querySelector('.eo-dt-icon');
    if (icon) icon.addEventListener('click', openClick);
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
      overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 300);
    };

    overlay.querySelectorAll('[data-assign]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const driverId = btn.dataset.assign;
        btn.disabled = true; btn.textContent = '배정 중...';
        try {
          for (const id of orderIds) {
            await Api.assignDriver(id, driverId);
          }
          UI.toast(`${orderIds.length}건 기사 배정 완료!`, 'success');
          overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 300);
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

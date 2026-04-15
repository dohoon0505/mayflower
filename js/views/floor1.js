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
    Floor1View._applyQuickDate('this-month');
    Floor1View._loadOrders();
  },

  /* ── Bind filter events ──────────────────────────────────── */
  _bindFilterEvents() {
    document.getElementById('f1-status-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.status-tab-btn');
      if (!btn) return;
      document.querySelectorAll('#f1-status-tabs .status-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Floor1View._filterState.statusGroup = btn.dataset.sg;
      Floor1View._updateFlowIndicator(btn.dataset.sg);
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

    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Floor1View._applyQuickDate(btn.dataset.quick);
        Floor1View._loadOrders();
      });
    });

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
      const d    = new Date(today.getFullYear(), today.getMonth()-1, 1);
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
      const all = Store.getOrders();
      const fs = Floor1View._filterState;
      let orders = all;

      if (fs.statusGroup !== '') {
        const allowed = fs.statusGroup.split(',').map(Number);
        orders = orders.filter(o => allowed.includes(o.status));
      }

      if (fs.photoYes && !fs.photoNo)  orders = orders.filter(o => !!o.deliveryPhotoUrl);
      if (!fs.photoYes && fs.photoNo)  orders = orders.filter(o => !o.deliveryPhotoUrl);
      if (!fs.photoYes && !fs.photoNo) orders = [];

      if (fs.dateFrom) orders = orders.filter(o => o.deliveryDatetime >= fs.dateFrom);
      if (fs.dateTo)   orders = orders.filter(o => o.deliveryDatetime <= fs.dateTo + 'T23:59:59');

      const lc = s => (s || '').toLowerCase();
      if (fs.searchProfile)   orders = orders.filter(o => lc(o.chainName).includes(lc(fs.searchProfile)) || lc(o.ribbonText).includes(lc(fs.searchProfile)));
      if (fs.searchRecipient) orders = orders.filter(o => lc(o.recipientName).includes(lc(fs.searchRecipient)));
      if (fs.searchAddress)   orders = orders.filter(o => lc(o.deliveryAddress).includes(lc(fs.searchAddress)));

      /* Sort: black(배차전 0-2) → blue(배송중 3) → green(배송완료 4) → red(취소/반품 5-6) */
      const _cg = s => s === 3 ? 1 : s === 4 ? 2 : s >= 5 ? 3 : 0;
      orders.sort((a, b) => {
        const g = _cg(a.status) - _cg(b.status);
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
      ? `<span class="ocard-field-icon">🎀</span><span data-ribbon="${UI.escHtml(o.ribbonText)}" class="ocard-field-ribbon" title="클릭 시 클립보드 복사">${UI.escHtml(o.ribbonText)}</span>`
      : `<span class="ocard-field-icon">🎀</span><span style="color:var(--text-muted);font-style:italic">문구 없음</span>`;

    /* Occasion field */
    const occasionHtml = o.occasionText
      ? `<span class="ocard-field-icon">📝</span><span>${UI.escHtml(o.occasionText)}</span>`
      : `<span class="ocard-field-icon">📝</span><span style="color:var(--text-muted);font-style:italic">경조사어 없음</span>`;

    /* Driver footer */
    const driverHtml = o.assignedDriverName
      ? `<span class="ocard-field-icon">🚚</span><span class="ocard-driver-tag">${UI.escHtml(o.assignedDriverName)}</span>${o.assignedAt ? `<span class="ocard-assign-time">(${UI.fmtDatetime(o.assignedAt)} 배차)</span>` : ''}`
      : `<span class="ocard-field-icon">🚚</span><span class="ocard-driver-none">배차 전</span>`;

    /* Store photo slot label */
    const storePhotoLabel = o.storePhotoUrl ? '🏪<br><span style="font-size:0.7rem">매장사진 보기</span>' : '🏪<br><span style="font-size:0.7rem">매장사진 없음</span>';
    const storePhotoAction = o.storePhotoUrl ? 'view-store-photo' : 'store-photo';
    const storePhotoCls    = o.storePhotoUrl ? 'oa-success' : 'oa-muted';

    return `
      <div class="order-card" data-id="${o.id}" data-status="${o.status}">
        <div class="ocard-body">
          <!-- Header: checkbox · chain · product · datetime -->
          <div class="ocard-header">
            <input type="checkbox" class="ocard-checkbox order-checkbox" data-id="${o.id}" title="선택">
            <span class="ocard-chain">${UI.escHtml(o.chainName || '-')}</span>
            <span class="ocard-product">${UI.escHtml(o.productName)}</span>
            <span class="ocard-datetime">🕐 ${dt}</span>
          </div>
          <!-- Row 1: Address | Recipient (2-col) -->
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
          <!-- Row 2: Ribbon | Occasion (2-col) -->
          <div class="ocard-2col">
            <div class="ocard-field ${!o.ribbonText ? 'ocard-empty' : ''}">
              ${ribbonHtml}
            </div>
            <div class="ocard-field ${!o.occasionText ? 'ocard-empty' : ''}">
              ${occasionHtml}
            </div>
          </div>
          <!-- Footer: Driver | Time remaining -->
          <div class="ocard-footer">
            <span class="ocard-footer-left">${driverHtml}</span>
            <span class="ocard-timer ${new Date(o.deliveryDatetime) < new Date() ? 'ocard-timer-late' : ''}"
              >⏱ ${UI.timeRemaining(o.deliveryDatetime)}</span>
          </div>
        </div>
        <div class="ocard-actions">
          <button class="ocard-action oa-primary f1-action" data-id="${o.id}" data-action="edit">✏️<br>주문서 수정</button>
          <button class="ocard-action ${storePhotoCls} f1-action" data-id="${o.id}" data-action="${storePhotoAction}">${storePhotoLabel}</button>
          <button class="ocard-action oa-warning f1-action" data-id="${o.id}" data-action="receipt">🧾<br>인수증 출력</button>
        </div>
      </div>`;
  },

  /* ── Click handler (single, delegated) ───────────────────── */
  _handleClick: async function(e) {
    const actionBtn = e.target.closest('.f1-action');
    if (actionBtn) {
      await Floor1View._handleAction(+actionBtn.dataset.id, actionBtn.dataset.action, actionBtn);
      return;
    }
    const ribbon = e.target.closest('[data-ribbon]') || e.target.closest('.ocard-field-ribbon');
    if (ribbon) {
      const text = ribbon.dataset.ribbon || ribbon.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        UI.toast('리본 문구를 클립보드에 복사했습니다.', 'success', 2000);
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

    const statusLabels = ['접수대기','리본출력완료','제작완료','배송중','배송완료','취소','반품'];
    const statusLabel  = statusLabels[o.status] || '-';
    const dt = UI.fmtDatetime(o.deliveryDatetime);
    const printDate = new Date().toLocaleString('ko-KR');

    const printWin = window.open('', '_blank', 'width=620,height=780');
    if (!printWin) { UI.toast('팝업 창 허용 후 다시 시도해 주세요.', 'warning'); return; }
    printWin.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>배송 인수증 #${o.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; padding: 40px; color: #1e293b; font-size: 14px; }
    h1  { font-size: 1.4rem; text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 0.75rem; margin-bottom: 1.25rem; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; background: #eff6ff; color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
    th { background: #f1f5f9; text-align: left; padding: 9px 14px; width: 110px; font-size: 13px; border: 1px solid #e2e8f0; color: #475569; }
    td { padding: 9px 14px; border: 1px solid #e2e8f0; font-size: 14px; line-height: 1.5; }
    .footer { text-align: center; margin-top: 2rem; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 1rem; }
    .sign-area { margin-top: 2rem; display: flex; justify-content: flex-end; gap: 3rem; font-size: 13px; }
    .sign-box  { text-align: center; }
    .sign-line { border-bottom: 1px solid #1e293b; width: 120px; margin-top: 2rem; }
    @media print { body { padding: 20px; } button { display:none; } }
  </style>
</head>
<body>
  <h1>🌸 배송 인수증</h1>
  <table>
    <tr><th>주문번호</th><td>#${o.id} &nbsp; <span class="badge">${statusLabel}</span></td></tr>
    <tr><th>체인명</th><td>${o.chainName || '-'}</td></tr>
    <tr><th>상품</th><td>${o.productName}</td></tr>
    <tr><th>배송 일시</th><td>${dt}</td></tr>
    <tr><th>배송지</th><td>${o.deliveryAddress}</td></tr>
    <tr><th>받는 분</th><td>${o.recipientName}${o.recipientPhone ? ' / ' + o.recipientPhone : ''}</td></tr>
    <tr><th>보내는분 문구</th><td>${o.ribbonText || '-'}</td></tr>
    <tr><th>경조사어</th><td>${o.occasionText || '-'}</td></tr>
    <tr><th>배송기사</th><td>${o.assignedDriverName || '-'}</td></tr>
    <tr><th>접수자</th><td>${o.createdByName}</td></tr>
  </table>
  <div class="sign-area">
    <div class="sign-box"><div class="sign-line"></div><div style="margin-top:6px">배송기사 서명</div></div>
    <div class="sign-box"><div class="sign-line"></div><div style="margin-top:6px">수령인 서명</div></div>
  </div>
  <div class="footer">메이대구 &nbsp;|&nbsp; ${printDate}</div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    printWin.document.close();
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
    if (action === 'receipt')          { Floor1View._openReceiptModal(id);          return; }
    /* Legacy bulk-assign from bulk bar still supported */
    if (action === 'assign')           { await Floor1View._openAssignModal([id]);   return; }
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
        const { url } = await Api.uploadStorePhoto(selectedFile);
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
    const rdonly = s => isDriver ? `readonly style="opacity:0.6;background:var(--bg-elevated)" title="${s}"` : '';

    let products = [], drivers = [];
    try { [products, drivers] = await Promise.all([Api.getProducts(), Api.getDrivers()]); }
    catch(e) { UI.toast('데이터 로드 실패', 'error'); return; }

    const productOpts = products.map(p =>
      `<option value="${p.id}" ${p.id === o.productId ? 'selected' : ''}>${UI.escHtml(p.name)}</option>`
    ).join('');
    const driverOpts = `<option value="0" ${!o.assignedDriverId ? 'selected' : ''}>— 미배정 —</option>` +
      drivers.map(d =>
        `<option value="${d.id}" ${d.id === o.assignedDriverId ? 'selected' : ''}>${UI.escHtml(d.name)}</option>`
      ).join('');

    const statusLabels = ['접수대기','리본출력완료','제작완료','배송중','배송완료','취소','반품'];
    const statusOpts   = statusLabels.map((l, i) =>
      `<option value="${i}" ${o.status===i?'selected':''}>${l}</option>`
    ).join('');

    const toLocalDT = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      const p = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    let storeFile = null, delivFile = null;
    let storeObjectUrl = o.storePhotoUrl || null;
    let delivObjectUrl = o.deliveryPhotoUrl || null;

    /* ── Status & driver row ── */
    const statusRow = isFloor1Admin
      ? `<div class="form-group">
          <label class="form-label">현재 상태</label>
          <select id="eo-status" class="form-control">${statusOpts}</select>
        </div>`
      : `<div class="form-group">
          <label class="form-label">현재 상태</label>
          <div style="padding:0.5rem 0">${UI.statusBadge(o.status)}</div>
        </div>`;

    const driverRow = (isFloor1Admin)
      ? `<div class="form-group" style="margin-bottom:0.75rem">
          <label class="form-label">배송기사 배차</label>
          <select id="eo-driver" class="form-control">${driverOpts}</select>
        </div>`
      : `<div class="form-group" style="margin-bottom:0.75rem">
          <label class="form-label">배송기사</label>
          <input type="text" class="form-control" value="${UI.escHtml(o.assignedDriverName || '미배정')}" readonly style="opacity:0.6">
        </div>`;

    /* ── Photo section ── */
    const photoSection = !isDriver ? `
      <div class="form-group" style="margin-bottom:0.5rem">
        <label class="form-label">사진 첨부</label>
        <div class="edit-photo-row">
          <div class="edit-photo-box" id="eo-store-box">
            <input type="file" id="eo-store-file" accept="image/jpeg,image/png">
            ${storeObjectUrl ? `<img id="eo-store-preview" src="${storeObjectUrl}" alt="매장사진">` : `<img id="eo-store-preview" style="display:none">`}
            <span class="edit-photo-label">${storeObjectUrl ? '🏪 매장사진 변경' : '🏪 매장사진 업로드'}</span>
          </div>
          <div class="edit-photo-box" id="eo-deliv-box">
            <input type="file" id="eo-deliv-file" accept="image/jpeg,image/png">
            ${delivObjectUrl ? `<img id="eo-deliv-preview" src="${delivObjectUrl}" alt="현장사진">` : `<img id="eo-deliv-preview" style="display:none">`}
            <span class="edit-photo-label">${delivObjectUrl ? '📷 현장사진 변경' : '📷 현장사진 업로드'}</span>
          </div>
        </div>
      </div>` : `
      <div class="form-group" style="margin-bottom:0.5rem">
        <label class="form-label">사진</label>
        <div style="display:flex;gap:0.75rem">
          ${storeObjectUrl ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${storeObjectUrl}')">🏪 매장사진 보기</button>` : '<span style="color:var(--text-muted);font-size:0.875rem">매장사진 없음</span>'}
          ${delivObjectUrl ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${delivObjectUrl}')">📷 현장사진 보기</button>` : ''}
        </div>
      </div>`;

    /* ── Driver completion section ── */
    const completionSection = isDriver ? `
      <div style="border-top:2px solid var(--primary);padding-top:0.875rem;margin-top:0.5rem">
        <div class="form-label" style="font-weight:700;color:var(--primary);margin-bottom:0.5rem">📷 배송 완료 처리</div>
        <label class="photo-drop-zone" id="drv-drop-zone" for="drv-complete-input">
          <input type="file" id="drv-complete-input" accept="image/jpeg,image/png">
          <div id="drv-drop-msg">
            <div style="font-size:2rem;margin-bottom:0.5rem">📷</div>
            <div style="font-size:0.9rem">클릭 또는 이미지를 드래그하여 업로드</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.25rem">jpg, png / 최대 5MB</div>
          </div>
          <img id="drv-complete-preview" class="photo-preview" style="display:none" alt="미리보기">
        </label>
        <div id="drv-complete-info" style="font-size:0.8rem;color:var(--text-muted);margin-top:0.35rem"></div>
      </div>` : '';

    const content = `
      <div class="form-row" style="margin-bottom:0.75rem">
        ${statusRow}
        <div class="form-group">
          <label class="form-label">접수자</label>
          <input type="text" class="form-control" value="${UI.escHtml(o.createdByName)}" readonly style="opacity:0.6">
        </div>
      </div>
      <div class="form-row" style="margin-bottom:0.75rem">
        <div class="form-group">
          <label class="form-label">체인명 <span class="form-required">*</span></label>
          <input type="text" id="eo-chain" class="form-control" value="${UI.escHtml(o.chainName || '')}" ${rdonly('조회 전용')}>
        </div>
        <div class="form-group">
          <label class="form-label">상품명 <span class="form-required">*</span></label>
          <select id="eo-product" class="form-control" ${isDriver?'disabled style="opacity:0.6"':''}>
            ${productOpts}
          </select>
        </div>
      </div>
      <div class="form-row" style="margin-bottom:0.75rem">
        <div class="form-group">
          <label class="form-label">배송 일시 <span class="form-required">*</span></label>
          <input type="datetime-local" id="eo-datetime" class="form-control" value="${toLocalDT(o.deliveryDatetime)}" step="600" ${rdonly('조회 전용')}>
        </div>
        <div class="form-group">
          <label class="form-label">배송지 주소 <span class="form-required">*</span></label>
          <input type="text" id="eo-address" class="form-control" value="${UI.escHtml(o.deliveryAddress || '')}" ${rdonly('조회 전용')}>
        </div>
      </div>
      <div class="form-row" style="margin-bottom:0.75rem">
        <div class="form-group">
          <label class="form-label">받는 분 성함 <span class="form-required">*</span></label>
          <input type="text" id="eo-name" class="form-control" value="${UI.escHtml(o.recipientName || '')}" ${rdonly('조회 전용')}>
        </div>
        <div class="form-group">
          <label class="form-label">받는 분 연락처</label>
          <input type="tel" id="eo-phone" class="form-control" value="${UI.escHtml(o.recipientPhone || '')}" ${rdonly('조회 전용')}>
        </div>
      </div>
      <div class="form-row" style="margin-bottom:0.75rem">
        <div class="form-group">
          <label class="form-label">보내는분 문구 (리본)</label>
          <input type="text" id="eo-ribbon" class="form-control" value="${UI.escHtml(o.ribbonText || '')}" ${rdonly('조회 전용')}>
        </div>
        <div class="form-group">
          <label class="form-label">경조사어 문구</label>
          <input type="text" id="eo-occasion" class="form-control" value="${UI.escHtml(o.occasionText || '')}" ${rdonly('조회 전용')} placeholder="예: 삼가 고인의 명복을 빕니다">
        </div>
      </div>
      ${driverRow}
      ${photoSection}
      ${completionSection}`;

    const overlay = UI.modal({
      title: `주문서 ${isDriver ? '조회' : '수정'} — #${orderId}`,
      content,
      confirmText: isDriver ? '닫기' : '저장',
      cancelText: isDriver ? '' : '취소',
      size: 'modal-edit',
    });

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
          const { url } = await Api.uploadDeliveryPhoto(drvFile);
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
    const handlePhotoFile = (file, previewId, which) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { UI.toast('5MB 이하 파일만 허용됩니다.', 'error'); return; }
      if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) { UI.toast('jpg, png 파일만 허용됩니다.', 'error'); return; }
      const url = URL.createObjectURL(file);
      const preview = overlay.querySelector(`#${previewId}`);
      preview.src = url; preview.style.display = 'block';
      if (which === 'store') { storeFile = file; storeObjectUrl = url; }
      else                   { delivFile = file; delivObjectUrl = url; }
    };

    overlay.querySelector('#eo-store-file').addEventListener('change', e => handlePhotoFile(e.target.files[0], 'eo-store-preview', 'store'));
    overlay.querySelector('#eo-deliv-file').addEventListener('change', e => handlePhotoFile(e.target.files[0], 'eo-deliv-preview', 'deliv'));

    const confirmBtn = overlay.querySelector('.modal-confirm');
    confirmBtn.onclick = async () => {
      const chainName      = overlay.querySelector('#eo-chain').value.trim();
      const productId      = +overlay.querySelector('#eo-product').value;
      const rawDT          = overlay.querySelector('#eo-datetime').value;
      const deliveryAddress= overlay.querySelector('#eo-address').value.trim();
      const recipientName  = overlay.querySelector('#eo-name').value.trim();
      const recipientPhone = overlay.querySelector('#eo-phone').value.trim();
      const ribbonText     = overlay.querySelector('#eo-ribbon').value.trim();
      const occasionText   = overlay.querySelector('#eo-occasion').value.trim();
      const driverIdRaw    = overlay.querySelector('#eo-driver')?.value || String(o.assignedDriverId || '0');
      const newStatus      = overlay.querySelector('#eo-status') ? +overlay.querySelector('#eo-status').value : o.status;

      if (!chainName)       { UI.toast('체인명을 입력해 주세요.', 'warning'); return; }
      if (!productId)       { UI.toast('상품을 선택해 주세요.', 'warning'); return; }
      if (!rawDT)           { UI.toast('배송 일시를 선택해 주세요.', 'warning'); return; }
      if (!deliveryAddress) { UI.toast('배송지를 입력해 주세요.', 'warning'); return; }
      if (!recipientName)   { UI.toast('받는 분 성함을 입력해 주세요.', 'warning'); return; }

      const d = new Date(rawDT);
      d.setMinutes(Math.round(d.getMinutes()/10)*10); d.setSeconds(0,0);
      const deliveryDatetime = d.toISOString();

      confirmBtn.disabled = true; confirmBtn.textContent = '저장 중...';
      try {
        let newStoreUrl = o.storePhotoUrl;
        let newDelivUrl = o.deliveryPhotoUrl;
        if (storeFile) { const r = await Api.uploadStorePhoto(storeFile);   newStoreUrl = r.url; }
        if (delivFile) { const r = await Api.uploadDeliveryPhoto(delivFile); newDelivUrl = r.url; }

        await Api.updateOrder(orderId, {
          chainName, productId, deliveryDatetime,
          deliveryAddress, recipientName, recipientPhone,
          ribbonText, occasionText,
          assignedDriverId: driverIdRaw,
          storePhotoUrl:    newStoreUrl,
          deliveryPhotoUrl: newDelivUrl,
        });

        /* Status change (floor1/admin only) */
        if (isFloor1Admin && newStatus !== o.status) {
          await Api.updateOrderStatus(orderId, newStatus);
        }

        UI.toast('주문서가 수정되었습니다.', 'success');
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
      overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 300);
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

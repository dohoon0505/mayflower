/* ============================================================
   DRIVER.JS — 배송기사: 내 배송 · 완료처리 · 사진 업로드
   v2: date range + text search filter
   ============================================================ */

const DriverView = {
  _session:    null,
  _pollTimer:  null,
  _pollFn:     null,
  _visHandler: null,

  /* ── Filter state ────────────────────────────────────────── */
  _filterState: {
    dateFrom: '',
    dateTo: '',
    searchRecipient: '',
    searchAddress: '',
  },

  init(session) {
    DriverView._session = session;
    Router.register('my-deliveries', () => DriverView.showMyDeliveries());
    Router.default('my-deliveries');

    /* Set up visibilitychange ONCE */
    DriverView._visHandler = () => {
      if (!DriverView._pollFn) return;
      if (document.hidden) {
        clearInterval(DriverView._pollTimer);
        DriverView._pollTimer = null;
      } else {
        DriverView._pollTimer = setInterval(DriverView._pollFn, 60000);
        DriverView._pollFn();
      }
    };
    document.addEventListener('visibilitychange', DriverView._visHandler);

    /* Delegated click — set up once */
    document.getElementById('main-content').addEventListener('click', e => {
      const btn = e.target.closest('.drv-complete');
      if (btn) DriverView._openCompleteModal(+btn.dataset.id);
    });
  },

  async showMyDeliveries() {
    DriverView._clearPoll();

    const today = new Date();
    const todayStr = UI.fmtDate(today.toISOString());

    UI.setContent('filter-area', `
      <div class="filter-section">

        <!-- Row 1: Date range + refresh -->
        <div class="filter-row">
          <span class="filter-label">배송요청일</span>
          <div class="date-range-box">
            <span class="date-icon">📅</span>
            <input type="date" id="drv-date-from">
            <span class="date-sep">~</span>
            <input type="date" id="drv-date-to">
          </div>
          <div class="quick-date-group">
            <button class="quick-date-btn drv-quick" data-quick="today">오늘</button>
            <button class="quick-date-btn drv-quick" data-quick="tomorrow">내일</button>
            <button class="quick-date-btn drv-quick" data-quick="this-month">이번 달</button>
          </div>
          <button class="btn btn-ghost btn-sm" id="drv-clear-date" title="날짜 필터 해제">✕ 날짜 해제</button>
          <button class="btn btn-secondary btn-sm" id="drv-refresh" style="margin-left:auto">↻ 새로고침</button>
        </div>

        <!-- Row 2: Text search -->
        <div class="filter-row" style="padding-top:0.6rem;padding-bottom:0.6rem">
          <div class="search-fields-group" style="grid-template-columns:1fr 1fr">
            <div class="search-field-item">
              <span class="search-field-label">🔍 받는분 검색</span>
              <input type="text" id="drv-search-recipient" class="search-field-input" placeholder="받는 분 성함">
            </div>
            <div class="search-field-item">
              <span class="search-field-label">🔍 주소지 검색</span>
              <input type="text" id="drv-search-address" class="search-field-input" placeholder="배송지 주소">
            </div>
          </div>
        </div>

      </div>`);

    DriverView._bindFilterEvents();
    await DriverView._loadDeliveries();
    DriverView._startPoll(() => DriverView._loadDeliveries(), 60000);
  },

  _bindFilterEvents() {
    document.getElementById('drv-date-from').addEventListener('change', e => {
      DriverView._filterState.dateFrom = e.target.value;
      DriverView._clearQuickActive();
      DriverView._loadDeliveries();
    });
    document.getElementById('drv-date-to').addEventListener('change', e => {
      DriverView._filterState.dateTo = e.target.value;
      DriverView._clearQuickActive();
      DriverView._loadDeliveries();
    });
    document.getElementById('drv-clear-date').addEventListener('click', () => {
      DriverView._filterState.dateFrom = '';
      DriverView._filterState.dateTo = '';
      document.getElementById('drv-date-from').value = '';
      document.getElementById('drv-date-to').value = '';
      DriverView._clearQuickActive();
      DriverView._loadDeliveries();
    });
    document.querySelectorAll('.drv-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.drv-quick').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        DriverView._applyQuickDate(btn.dataset.quick);
        DriverView._loadDeliveries();
      });
    });
    ['drv-search-recipient','drv-search-address'].forEach(id => {
      let t;
      document.getElementById(id).addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (id === 'drv-search-recipient') DriverView._filterState.searchRecipient = e.target.value.trim();
          if (id === 'drv-search-address')   DriverView._filterState.searchAddress   = e.target.value.trim();
          DriverView._loadDeliveries();
        }, 280);
      });
    });
    document.getElementById('drv-refresh').addEventListener('click', () => DriverView._loadDeliveries());
  },

  _applyQuickDate(quick) {
    const today = new Date();
    let from, to;
    const fmt = d => {
      const p = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    };
    if (quick === 'today')      { from = to = fmt(today); }
    else if (quick === 'tomorrow')   { const d = new Date(today); d.setDate(d.getDate()+1); from = to = fmt(d); }
    else if (quick === 'this-month') {
      from = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
      to   = fmt(today);
    }
    if (from) { DriverView._filterState.dateFrom = from; const el = document.getElementById('drv-date-from'); if (el) el.value = from; }
    if (to)   { DriverView._filterState.dateTo   = to;   const el = document.getElementById('drv-date-to');   if (el) el.value = to; }
  },

  _clearQuickActive() {
    document.querySelectorAll('.drv-quick').forEach(b => b.classList.remove('active'));
  },

  async _loadDeliveries() {
    UI.loading(true);
    try {
      const all = await Api.getMyDeliveries();
      const fs = DriverView._filterState;
      let orders = all;

      if (fs.dateFrom) orders = orders.filter(o => o.deliveryDatetime >= fs.dateFrom);
      if (fs.dateTo)   orders = orders.filter(o => o.deliveryDatetime <= fs.dateTo + 'T23:59:59');

      const lc = s => (s || '').toLowerCase();
      if (fs.searchRecipient) orders = orders.filter(o => lc(o.recipientName).includes(lc(fs.searchRecipient)));
      if (fs.searchAddress)   orders = orders.filter(o => lc(o.deliveryAddress).includes(lc(fs.searchAddress)));

      orders.sort((a, b) => new Date(a.deliveryDatetime) - new Date(b.deliveryDatetime));

      if (!orders.length) {
        UI.setMain(`<div class="empty-state"><div class="empty-icon">🚚</div><div class="empty-text">조건에 맞는 배송이 없습니다.</div></div>`);
        return;
      }
      UI.setMain(`<div class="order-list">${orders.map(o => DriverView._orderCard(o)).join('')}</div>`);
    } catch(e) {
      UI.toast(e.message || '조회 실패', 'error');
    } finally { UI.loading(false); }
  },

  _orderCard(o) {
    const dt = UI.fmtDatetime(o.deliveryDatetime);
    const immediate = o.isImmediate ? '<span class="order-immediate">즉시</span>' : '';

    const textContent = o.occasionText || o.ribbonText || '';
    const textHtml = textContent
      ? `<span class="ocard-field-icon">${o.occasionText ? '📝' : '🎀'}</span><span>${UI.escHtml(textContent)}</span>`
      : `<span class="ocard-field-icon">🎀</span><span style="color:var(--text-muted);font-style:italic">문구 없음</span>`;

    const storePhotoSlot = o.storePhotoUrl
      ? `<button class="ocard-action oa-muted" onclick="window.open('${o.storePhotoUrl}')">
           <img src="${o.storePhotoUrl}" alt="매장사진"><span style="font-size:0.7rem">매장사진 보기</span>
         </button>`
      : `<div class="ocard-action oa-muted" style="cursor:default">🏪<br><span style="font-size:0.7rem">매장사진 없음</span></div>`;

    return `
      <div class="order-card" data-id="${o.id}" data-status="${o.status}">
        <div class="ocard-body">
          <div class="ocard-header">
            ${UI.statusBadge(o.status)}
            <span class="order-product">${UI.escHtml(o.productName)}</span>
            ${immediate}
            <span class="ocard-datetime">🕐 ${dt}</span>
            <span class="ocard-chain">${UI.escHtml(o.chainName || '-')}</span>
            <span class="ocard-id">#${o.id}</span>
          </div>
          <div class="ocard-field">
            <span class="ocard-field-icon">📍</span>
            <span>${UI.escHtml(o.deliveryAddress)}</span>
          </div>
          <div class="ocard-2col">
            <div class="ocard-field">
              <span class="ocard-field-icon">👤</span>
              <span>${UI.escHtml(o.recipientName)}${o.recipientPhone ? ' / ' + UI.escHtml(o.recipientPhone) : ''}</span>
            </div>
            <div class="ocard-field ${!textContent ? 'ocard-empty' : ''}">
              ${textHtml}
            </div>
          </div>
        </div>
        <div class="ocard-actions">
          ${storePhotoSlot}
          <button class="ocard-action oa-success drv-complete" data-id="${o.id}">📷<br>완료 처리</button>
        </div>
      </div>`;
  },

  _openCompleteModal(orderId) {
    const order = Store.getOrderById(orderId);
    if (!order) { UI.toast('주문 정보를 찾을 수 없습니다.', 'error'); return; }

    let selectedFile = null;
    let objectUrl = null;

    const content = `
      <p style="color:var(--text-secondary);margin-bottom:0.5rem">
        <strong>#${orderId}</strong> — ${UI.escHtml(order.chainName || '-')} / ${UI.escHtml(order.recipientName)}
      </p>
      <label class="photo-drop-zone" id="drop-zone" for="photo-input">
        <input type="file" id="photo-input" accept="image/jpeg,image/png">
        <div id="drop-msg">
          <div style="font-size:2rem;margin-bottom:0.5rem">📷</div>
          <div style="font-size:0.95rem">클릭 또는 이미지를 드래그하여 업로드</div>
          <div style="font-size:0.825rem;color:var(--text-muted);margin-top:0.25rem">jpg, png / 최대 5MB</div>
        </div>
        <img id="photo-preview" class="photo-preview" style="display:none" alt="미리보기">
      </label>
      <div id="photo-info" style="font-size:0.825rem;color:var(--text-muted);margin-top:0.35rem"></div>`;

    const overlay = UI.modal({
      title: '배송 완료 처리',
      content,
      confirmText: '완료 처리', cancelText: '취소',
    });

    const handleFile = file => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { UI.toast('파일 크기는 5MB 이하여야 합니다.', 'error'); return; }
      if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) {
        UI.toast('jpg, png 파일만 허용됩니다.', 'error'); return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      selectedFile = file;
      const preview = overlay.querySelector('#photo-preview');
      overlay.querySelector('#drop-msg').style.display = 'none';
      preview.src = objectUrl; preview.style.display = 'block';
      overlay.querySelector('#photo-info').textContent = `${file.name} (${(file.size/1024).toFixed(0)} KB)`;
    };

    overlay.querySelector('#photo-input').addEventListener('change', e => handleFile(e.target.files[0]));
    const dz = overlay.querySelector('#drop-zone');
    dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });

    const confirmBtn = overlay.querySelector('.modal-confirm');
    confirmBtn.onclick = async () => {
      if (!selectedFile) { UI.toast('배송 완료 사진을 첨부해 주세요.', 'warning'); return; }
      confirmBtn.disabled = true; confirmBtn.textContent = '처리 중...';
      try {
        const { url } = await Api.uploadDeliveryPhoto(selectedFile);
        await Api.completeOrder(orderId, url);
        UI.toast('배송이 완료 처리되었습니다! 🎉', 'success');
        overlay.classList.remove('show');
        setTimeout(() => { overlay.remove(); if (objectUrl) URL.revokeObjectURL(objectUrl); }, 300);
        DriverView._loadDeliveries();
      } catch(e) {
        UI.toast(e.message || '완료 처리 실패', 'error');
        confirmBtn.disabled = false; confirmBtn.textContent = '완료 처리';
      }
    };
  },

  /* ── Polling ─────────────────────────────────────────────── */
  _startPoll(fn, ms) {
    DriverView._pollFn = fn;
    clearInterval(DriverView._pollTimer);
    DriverView._pollTimer = setInterval(fn, ms);
  },
  _clearPoll() {
    DriverView._pollFn = null;
    clearInterval(DriverView._pollTimer);
    DriverView._pollTimer = null;
  },
};

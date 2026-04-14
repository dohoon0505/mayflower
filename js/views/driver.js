/* ============================================================
   DRIVER.JS — 배송기사: 내 배송 · 완료처리 · 사진 업로드
   Bug-fixed: single visibilitychange handler
   ============================================================ */

const DriverView = {
  _session:    null,
  _pollTimer:  null,
  _pollFn:     null,
  _visHandler: null,

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
  },

  async showMyDeliveries() {
    DriverView._clearPoll();
    UI.setContent('filter-area', `
      <div class="filter-area-inner">
        <span class="filter-label">내 배송 목록</span>
        <span class="text-muted text-sm">(완료·취소·반품 제외)</span>
        <button class="btn btn-secondary btn-sm" id="drv-refresh" style="margin-left:auto">↻ 새로고침</button>
      </div>`);
    document.getElementById('drv-refresh').addEventListener('click', () => DriverView._loadDeliveries());
    await DriverView._loadDeliveries();
    DriverView._startPoll(() => DriverView._loadDeliveries(), 60000);
  },

  async _loadDeliveries() {
    UI.loading(true);
    try {
      const orders = await Api.getMyDeliveries();
      orders.sort((a, b) => new Date(a.deliveryDatetime) - new Date(b.deliveryDatetime));
      if (!orders.length) {
        UI.setMain(`<div class="empty-state"><div class="empty-icon">🚚</div><div class="empty-text">배정된 배송이 없습니다.</div></div>`);
        return;
      }
      UI.setMain(`<div class="order-list">${orders.map(o => DriverView._orderCard(o)).join('')}</div>`);
      DriverView._bindActions();
    } catch(e) {
      UI.toast(e.message || '조회 실패', 'error');
    } finally { UI.loading(false); }
  },

  _actionsBound: false,
  _bindActions() {
    if (DriverView._actionsBound) return;
    DriverView._actionsBound = true;
    document.getElementById('main-content').addEventListener('click', e => {
      const btn = e.target.closest('.drv-complete');
      if (btn) DriverView._openCompleteModal(+btn.dataset.id);
    });
  },

  _orderCard(o) {
    const dt = UI.fmtDatetime(o.deliveryDatetime);
    const immediate = o.isImmediate ? '<span class="order-immediate">즉시</span>' : '';
    return `
      <div class="order-card" data-id="${o.id}" data-status="${o.status}">
        <div class="order-card-check">
          <span style="font-size:0.9rem;color:var(--text-muted);font-weight:600">#${o.id}</span>
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
          ${o.ribbonText ? `<div class="order-ribbon">🎀 ${UI.escHtml(o.ribbonText)}</div>` : ''}
        </div>
        <div class="order-actions">
          <button class="btn btn-success drv-complete" data-id="${o.id}">📷 완료 처리</button>
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
        setTimeout(() => { overlay.remove(); if (objectUrl) URL.revokeObjectURL(objectUrl); }, 250);
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

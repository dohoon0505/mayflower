/* ============================================================
   DRIVER.JS — 배송기사: 내 배송 · 완료처리 · 사진 업로드
   ============================================================ */

const DriverView = {
  _session: null,
  _pollTimer: null,

  init(session) {
    DriverView._session = session;
    Router.register('my-deliveries', () => DriverView.showMyDeliveries());
    Router.default('my-deliveries');
  },

  /* ── 내 배송 목록 ────────────────────────────────────────── */
  async showMyDeliveries() {
    DriverView._clearPoll();
    UI.setFilter(`
      <div class="filter-area-inner">
        <span class="filter-label">내 배송 목록</span>
        <span class="text-muted text-sm">(완료/취소/반품 제외)</span>
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

  _orderCard(o) {
    const dt = UI.fmtDatetime(o.deliveryDatetime);
    const immediate = o.isImmediate ? '<span class="order-immediate">즉시</span>' : '';

    return `
      <div class="order-card" data-id="${o.id}">
        <div class="order-info">
          <div class="order-top">
            <span class="order-chain">${UI.escHtml(o.chainName || '-')}</span>
            <span class="order-product">${UI.escHtml(o.productName)}</span>
            ${immediate}
            ${UI.statusBadge(o.status)}
          </div>
          <div class="order-meta">
            <span class="order-meta-item"><span class="order-meta-icon">📍</span>${UI.escHtml(o.deliveryAddress)}</span>
            <span class="order-meta-item"><span class="order-meta-icon">👤</span>${UI.escHtml(o.recipientName)} ${o.recipientPhone ? '/ ' + UI.escHtml(o.recipientPhone) : ''}</span>
            <span class="order-meta-item"><span class="order-meta-icon">🕐</span>${dt}</span>
          </div>
          ${o.ribbonText ? `<div class="order-ribbon">🎀 ${UI.escHtml(o.ribbonText)}</div>` : ''}
        </div>
        <div class="order-actions" style="grid-template-columns:1fr">
          <button class="btn btn-success drv-complete" data-id="${o.id}" style="font-size:0.8rem">
            📷 완료 처리
          </button>
        </div>
      </div>`;
  },

  _bindActions() {
    document.getElementById('main-content').addEventListener('click', e => {
      const btn = e.target.closest('.drv-complete');
      if (btn) DriverView._openCompleteModal(+btn.dataset.id);
    });
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
          <div style="font-size:0.9rem">클릭 또는 이미지를 드래그하여 업로드</div>
          <div class="text-muted text-sm" style="margin-top:0.25rem">jpg, png / 최대 5MB</div>
        </div>
        <img id="photo-preview" class="photo-preview" style="display:none">
      </label>
      <div id="photo-info" class="text-sm text-muted"></div>`;

    const overlay = UI.modal({
      title: '배송 완료 처리',
      content,
      confirmText: '완료 처리', cancelText: '취소',
      onConfirm: async () => { /* handled separately */ },
    });

    /* 파일 선택 핸들러 */
    const handleFile = (file) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { UI.toast('파일 크기는 5MB 이하여야 합니다.', 'error'); return; }
      if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) {
        UI.toast('jpg, png 파일만 허용됩니다.', 'error'); return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      selectedFile = file;
      const preview = overlay.querySelector('#photo-preview');
      const msg = overlay.querySelector('#drop-msg');
      const info = overlay.querySelector('#photo-info');
      preview.src = objectUrl; preview.style.display = 'block';
      msg.style.display = 'none';
      info.textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    };

    overlay.querySelector('#photo-input').addEventListener('change', e => handleFile(e.target.files[0]));

    const dropZone = overlay.querySelector('#drop-zone');
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      handleFile(e.dataTransfer.files[0]);
    });

    /* 완료 버튼 재바인딩 */
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
    DriverView._pollTimer = setInterval(fn, ms);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) DriverView._clearPoll();
      else { DriverView._pollTimer = setInterval(fn, ms); fn(); }
    });
  },
  _clearPoll() { clearInterval(DriverView._pollTimer); DriverView._pollTimer = null; },
};

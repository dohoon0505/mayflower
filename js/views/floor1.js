/* ============================================================
   FLOOR1.JS — 1층 제작/배차: 전체 주문 · 상태변경 · 기사배정
   ============================================================ */

const Floor1View = {
  _session: null,
  _pollTimer: null,

  init(session) {
    Floor1View._session = session;
    Router.register('all-orders', () => Floor1View.showAllOrders());
    Router.default('all-orders');
  },

  /* ── 전체 주문 목록 ──────────────────────────────────────── */
  async showAllOrders() {
    Floor1View._clearPoll();
    UI.setFilter(`
      <div class="filter-area-inner">
        <span class="filter-label">상태</span>
        <select id="f1-status" class="filter-select">
          <option value="">전체</option>
          <option value="0">접수됨</option>
          <option value="1">리본출력완료</option>
          <option value="2">제작완료</option>
          <option value="3">배송중</option>
          <option value="4">배송완료</option>
          <option value="5">취소</option>
          <option value="6">반품</option>
        </select>
        <span class="filter-label">기사</span>
        <select id="f1-driver" class="filter-select">
          <option value="">전체</option>
        </select>
        <span class="filter-label">배송일</span>
        <input type="date" id="f1-from" class="filter-input" title="시작일">
        <span class="text-muted">~</span>
        <input type="date" id="f1-to" class="filter-input" title="종료일">
        <button class="btn btn-secondary btn-sm" id="f1-search">🔍 조회</button>
        <button class="btn btn-ghost btn-sm" id="f1-reset">초기화</button>
        <button class="btn btn-secondary btn-sm" id="f1-refresh" style="margin-left:auto">↻ 새로고침</button>
      </div>`);

    /* 기사 드롭다운 채우기 */
    try {
      const drivers = await Api.getDrivers();
      const sel = document.getElementById('f1-driver');
      drivers.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id; opt.textContent = d.name;
        sel.appendChild(opt);
      });
    } catch(e) { /* ignore */ }

    document.getElementById('f1-search').addEventListener('click', () => Floor1View._loadOrders());
    document.getElementById('f1-refresh').addEventListener('click', () => Floor1View._loadOrders());
    document.getElementById('f1-reset').addEventListener('click', () => {
      document.getElementById('f1-status').value = '';
      document.getElementById('f1-driver').value = '';
      document.getElementById('f1-from').value = '';
      document.getElementById('f1-to').value = '';
      Floor1View._loadOrders();
    });

    await Floor1View._loadOrders();
    Floor1View._startPoll(() => Floor1View._loadOrders(), 30000);
  },

  async _loadOrders() {
    const status   = document.getElementById('f1-status')?.value;
    const driverId = document.getElementById('f1-driver')?.value;
    const from     = document.getElementById('f1-from')?.value;
    const to       = document.getElementById('f1-to')?.value;
    const filters = {};
    if (status !== '')  filters.status   = +status;
    if (driverId !== '') filters.driverId = +driverId;
    if (from)  filters.dateFrom = new Date(from).toISOString();
    if (to)    filters.dateTo   = new Date(to + 'T23:59:59').toISOString();

    UI.loading(true);
    try {
      const orders = await Api.getOrders(filters);
      orders.sort((a, b) => new Date(a.deliveryDatetime) - new Date(b.deliveryDatetime));
      if (!orders.length) {
        UI.setMain(`<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">조건에 맞는 주문이 없습니다.</div></div>`);
        return;
      }
      UI.setMain(`<div class="order-list">${orders.map(o => Floor1View._orderCard(o)).join('')}</div>`);
      Floor1View._bindActions();
    } catch(e) {
      UI.toast(e.message || '조회 실패', 'error');
    } finally { UI.loading(false); }
  },

  _orderCard(o) {
    const dt = UI.fmtDatetime(o.deliveryDatetime);
    const created = UI.fmtDatetime(o.createdAt);
    const immediate = o.isImmediate ? '<span class="order-immediate">즉시</span>' : '';
    const driverTag = o.assignedDriverName
      ? `<span class="order-driver-tag">🚚 ${UI.escHtml(o.assignedDriverName)}</span>` : '';
    const photo = o.deliveryPhotoUrl
      ? `<img src="${o.deliveryPhotoUrl}" class="order-photo-thumb" title="배송 사진" onclick="window.open(this.src)">` : '';

    /* 상태별 허용 버튼 */
    const s = o.status;
    const canRibbon = s === 0;
    const canProd   = s === 1;
    const canDeliv  = s === 2;
    const canAssign = s <= 2;
    const canCancel = s <= 3;
    const canReturn = s === 4;

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
          ${o.ribbonText ? `<div class="order-ribbon" style="cursor:pointer" title="클릭 시 클립보드 복사" data-ribbon="${UI.escHtml(o.ribbonText)}">🎀 ${UI.escHtml(o.ribbonText)}</div>` : ''}
          <div class="order-footer">
            ${driverTag} ${photo}
            <span class="order-created">접수: ${UI.escHtml(o.createdByName)} / ${created}</span>
          </div>
        </div>
        <div class="order-actions">
          ${canRibbon ? `<button class="btn btn-secondary btn-xs f1-action" data-id="${o.id}" data-action="ribbon">리본출력<br>완료</button>` : '<span></span>'}
          ${canProd   ? `<button class="btn btn-secondary btn-xs f1-action" data-id="${o.id}" data-action="prod">제작<br>완료</button>` : '<span></span>'}
          ${canDeliv  ? `<button class="btn btn-warning btn-xs f1-action" data-id="${o.id}" data-action="deliv">배송<br>출발</button>` : '<span></span>'}
          ${canAssign ? `<button class="btn btn-primary btn-xs f1-action" data-id="${o.id}" data-action="assign">기사<br>배정</button>` : '<span></span>'}
          ${canCancel ? `<button class="btn btn-danger btn-xs f1-action" data-id="${o.id}" data-action="cancel">취소</button>` : '<span></span>'}
          ${canReturn ? `<button class="btn btn-danger btn-xs f1-action" data-id="${o.id}" data-action="return">반품</button>` : '<span></span>'}
        </div>
      </div>`;
  },

  _bindActions() {
    /* 액션 버튼 */
    document.getElementById('main-content').addEventListener('click', async e => {
      const btn = e.target.closest('.f1-action');
      if (btn) { await Floor1View._handleAction(btn.dataset.id, btn.dataset.action, btn); return; }

      /* 리본 문구 클립보드 복사 */
      const ribbon = e.target.closest('[data-ribbon]');
      if (ribbon) {
        try {
          await navigator.clipboard.writeText(ribbon.dataset.ribbon);
          UI.toast('리본 문구를 클립보드에 복사했습니다.', 'success', 2000);
        } catch { UI.toast('클립보드 복사 실패', 'error'); }
      }
    });
  },

  async _handleAction(id, action, btn) {
    const orderId = +id;
    const statusMap = { ribbon: 1, prod: 2, deliv: 3, cancel: 5, return: 6 };

    if (action === 'assign') {
      await Floor1View._openAssignModal(orderId);
      return;
    }

    const status = statusMap[action];
    const labels = { ribbon: '리본출력완료', prod: '제작완료', deliv: '배송출발', cancel: '취소', return: '반품' };
    const ok = await UI.confirm(`주문 #${orderId}을 [${labels[action]}] 상태로 변경할까요?`, '상태 변경');
    if (!ok) return;

    btn.disabled = true;
    try {
      await Api.updateOrderStatus(orderId, status);
      UI.toast(`상태가 [${labels[action]}]로 변경되었습니다.`, 'success');
      Floor1View._loadOrders();
    } catch(e) {
      UI.toast(e.message || '상태 변경 실패', 'error');
      btn.disabled = false;
    }
  },

  async _openAssignModal(orderId) {
    let drivers = [];
    try { drivers = await Api.getDrivers(); } catch(e) { UI.toast('기사 목록 로드 실패', 'error'); return; }

    const order = Store.getOrderById(orderId);
    const currentDriverId = order?.assignedDriverId;

    const items = drivers.map(d => `
      <div class="driver-modal-item" data-driver-id="${d.id}">
        <div>
          <div class="driver-modal-name">${UI.escHtml(d.name)} ${d.id === currentDriverId ? '<span class="badge badge-role" style="font-size:0.65rem">현재</span>' : ''}</div>
          <div class="driver-modal-phone">${UI.escHtml(d.phone || '-')}</div>
        </div>
        <button class="btn btn-primary btn-xs" data-assign="${d.id}">배정</button>
      </div>`).join('');

    const overlay = UI.modal({
      title: `기사 배정 — 주문 #${orderId}`,
      content: `<div class="driver-list-modal">${items || '<p style="color:var(--text-muted)">등록된 기사가 없습니다.</p>'}</div>`,
      confirmText: '닫기', cancelText: '',
      size: 'modal-sm',
    });

    overlay.querySelector('.modal-footer').style.display = 'none';

    overlay.querySelectorAll('[data-assign]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const driverId = +btn.dataset.assign;
        btn.disabled = true;
        try {
          await Api.assignDriver(orderId, driverId);
          UI.toast(`기사가 배정되었습니다.`, 'success');
          overlay.classList.remove('show');
          setTimeout(() => overlay.remove(), 300);
          Floor1View._loadOrders();
        } catch(e) {
          UI.toast(e.message || '배정 실패', 'error');
          btn.disabled = false;
        }
      });
    });
  },

  /* ── Polling ─────────────────────────────────────────────── */
  _startPoll(fn, ms) {
    Floor1View._pollTimer = setInterval(fn, ms);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Floor1View._clearPoll();
      else { Floor1View._pollTimer = setInterval(fn, ms); fn(); }
    });
  },
  _clearPoll() { clearInterval(Floor1View._pollTimer); Floor1View._pollTimer = null; },
};

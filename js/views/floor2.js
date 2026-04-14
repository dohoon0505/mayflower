/* ============================================================
   FLOOR2.JS — 2층 수주/CS: 내 주문 · 신규 접수
   ============================================================ */

const Floor2View = {
  _session: null,
  _pollTimer: null,

  init(session) {
    Floor2View._session = session;
    Router.register('my-orders',  () => Floor2View.showMyOrders());
    Router.register('new-order',  () => Floor2View.showNewOrder());
    Router.default('my-orders');
  },

  /* ── 내 주문 ──────────────────────────────────────────────── */
  async showMyOrders() {
    Floor2View._clearPoll();
    UI.setFilter(`
      <div class="filter-area-inner">
        <span class="filter-label">상태 필터</span>
        <select id="f2-status" class="filter-select">
          <option value="">전체</option>
          <option value="0">접수됨</option>
          <option value="1">리본출력완료</option>
          <option value="2">제작완료</option>
          <option value="3">배송중</option>
          <option value="4">배송완료</option>
          <option value="5">취소</option>
          <option value="6">반품</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="f2-refresh">↻ 새로고침</button>
      </div>`);

    document.getElementById('f2-status').addEventListener('change', () => Floor2View._loadMyOrders());
    document.getElementById('f2-refresh').addEventListener('click', () => Floor2View._loadMyOrders());
    await Floor2View._loadMyOrders();
    Floor2View._startPoll(() => Floor2View._loadMyOrders(), 30000);
  },

  async _loadMyOrders() {
    const statusEl = document.getElementById('f2-status');
    const status = statusEl ? statusEl.value : '';
    const filters = status !== '' ? { status: +status } : {};
    UI.loading(true);
    try {
      const orders = await Api.getOrders(filters);
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      UI.setMain(Floor2View._renderOrderList(orders));
    } catch(e) {
      UI.toast(e.message || '주문 조회 실패', 'error');
    } finally { UI.loading(false); }
  },

  _renderOrderList(orders) {
    if (!orders.length) return `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">접수된 주문이 없습니다.</div>
      </div>`;
    return `<div class="order-list">${orders.map(o => Floor2View._orderCard(o)).join('')}</div>`;
  },

  _orderCard(o) {
    const dt = UI.fmtDatetime(o.deliveryDatetime);
    const created = UI.fmtDatetime(o.createdAt);
    const driverTag = o.assignedDriverName
      ? `<span class="order-driver-tag">🚚 ${UI.escHtml(o.assignedDriverName)}</span>` : '';
    const immediate = o.isImmediate ? '<span class="order-immediate">즉시</span>' : '';
    const photo = o.deliveryPhotoUrl
      ? `<img src="${o.deliveryPhotoUrl}" class="order-photo-thumb" title="배송 사진" onclick="window.open(this.src)">` : '';

    return `
      <div class="order-card">
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
          <div class="order-footer">
            ${driverTag}
            ${photo}
            <span class="order-created">접수: ${created}</span>
          </div>
        </div>
        <div class="order-actions" style="grid-template-columns:1fr;">
          <span style="font-size:0.75rem;color:var(--text-muted);padding:0.25rem 0;text-align:right">#${o.id}</span>
        </div>
      </div>`;
  },

  /* ── 신규 접수 ────────────────────────────────────────────── */
  async showNewOrder() {
    Floor2View._clearPoll();
    UI.setFilter(`
      <div class="filter-area-inner">
        <span class="filter-label">신규 주문 접수</span>
      </div>`);

    let products = [];
    try { products = await Api.getProducts(); } catch(e) { UI.toast('상품 목록 로드 실패', 'error'); }

    const productOptions = products.map(p =>
      `<option value="${p.id}">${UI.escHtml(p.name)}</option>`).join('');

    /* 기본 배송 일시: 지금 + 1시간, 10분 단위 반올림 */
    const defDt = (() => {
      const d = new Date(); d.setHours(d.getHours() + 1);
      d.setSeconds(0, 0); const m = d.getMinutes();
      d.setMinutes(Math.round(m / 10) * 10);
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    })();

    UI.setMain(`
      <div class="new-order-wrap">
        <div class="new-order-title">신규 주문 접수</div>
        <form id="new-order-form" novalidate>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">체인명 (꽃집 상호) <span class="form-required">*</span></label>
              <input type="text" id="no-chain" class="form-control" placeholder="예: 행복꽃집" required>
            </div>
            <div class="form-group">
              <label class="form-label">상품 <span class="form-required">*</span></label>
              <select id="no-product" class="form-control" required>
                <option value="">선택하세요</option>
                ${productOptions}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label for-checkbox" style="display:flex;align-items:center;gap:0.5rem">
              <input type="checkbox" id="no-immediate" style="accent-color:var(--primary);width:16px;height:16px">
              즉시배송 (배송일시를 현재 + 3시간으로 자동 설정)
            </label>
          </div>
          <div class="form-group" id="no-dt-group">
            <label class="form-label">배송 예정 일시 <span class="form-required">*</span></label>
            <input type="datetime-local" id="no-datetime" class="form-control" value="${defDt}" step="600">
          </div>
          <div class="form-group">
            <label class="form-label">배송지 주소 <span class="form-required">*</span></label>
            <input type="text" id="no-address" class="form-control" placeholder="배송지 주소" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">받는 분 성함 <span class="form-required">*</span></label>
              <input type="text" id="no-name" class="form-control" placeholder="받는 분 성함" required>
            </div>
            <div class="form-group">
              <label class="form-label">받는 분 연락처</label>
              <input type="tel" id="no-phone" class="form-control" placeholder="010-0000-0000">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">리본 문구</label>
            <input type="text" id="no-ribbon" class="form-control" placeholder="예: 개업을 진심으로 축하합니다">
          </div>
          <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:0.5rem">
            <button type="button" class="btn btn-ghost" onclick="Router.navigate('my-orders')">취소</button>
            <button type="submit" class="btn btn-primary btn-lg" id="btn-submit-order">접수하기</button>
          </div>
        </form>
      </div>`);

    /* 즉시배송 체크 핸들러 */
    document.getElementById('no-immediate').addEventListener('change', function() {
      document.getElementById('no-dt-group').style.opacity = this.checked ? '0.4' : '1';
      document.getElementById('no-datetime').disabled = this.checked;
    });

    document.getElementById('new-order-form').addEventListener('submit', async e => {
      e.preventDefault();
      const isImmediate = document.getElementById('no-immediate').checked;
      let deliveryDatetime;
      if (isImmediate) {
        const d = new Date(); d.setHours(d.getHours() + 3);
        d.setMinutes(Math.round(d.getMinutes() / 10) * 10);
        d.setSeconds(0, 0);
        deliveryDatetime = d.toISOString();
      } else {
        const raw = document.getElementById('no-datetime').value;
        if (!raw) { UI.toast('배송 일시를 선택해 주세요.', 'warning'); return; }
        const d = new Date(raw);
        d.setMinutes(Math.round(d.getMinutes() / 10) * 10);
        d.setSeconds(0, 0);
        deliveryDatetime = d.toISOString();
      }
      const data = {
        chainName:       document.getElementById('no-chain').value.trim(),
        productId:       +document.getElementById('no-product').value,
        deliveryDatetime,
        isImmediate,
        deliveryAddress: document.getElementById('no-address').value.trim(),
        recipientName:   document.getElementById('no-name').value.trim(),
        recipientPhone:  document.getElementById('no-phone').value.trim(),
        ribbonText:      document.getElementById('no-ribbon').value.trim(),
      };
      const btn = document.getElementById('btn-submit-order');
      btn.disabled = true; btn.textContent = '접수 중...';
      try {
        await Api.createOrder(data);
        UI.toast('주문이 접수되었습니다!', 'success');
        Router.navigate('my-orders');
      } catch(err) {
        UI.toast(err.message || '접수 실패', 'error');
        btn.disabled = false; btn.textContent = '접수하기';
      }
    });
  },

  /* ── Polling ─────────────────────────────────────────────── */
  _startPoll(fn, ms) {
    Floor2View._pollTimer = setInterval(fn, ms);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Floor2View._clearPoll();
      else { Floor2View._pollTimer = setInterval(fn, ms); fn(); }
    });
  },
  _clearPoll() { clearInterval(Floor2View._pollTimer); Floor2View._pollTimer = null; },
};

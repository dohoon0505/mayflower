/* ============================================================
   DELIVERY-BOARD.JS — 배송현황판 (채팅 패널 하단)

   RTDB 경로: /deliveryBoard/{id}
     - location  : string  (장소)
     - quantity  : number  (수량)
     - hour      : number  (0~23)
     - minute    : number  (0~59)
     - createdAt : ISO8601 string
     - createdBy : auth.uid

   기능:
     • /deliveryBoard 실시간 구독 → 목록 렌더
     • ↑↓ 원클릭 수량 조정 (RTDB transaction)
     • 출차완료 버튼 → remove() 로 항목 제거
     • "추가" 모달 → push() 로 신규 항목 생성
   ============================================================ */

const DeliveryBoard = {
  _items: {},
  _subscribed: false,
  _bound: false,

  init() {
    this._bindUI();
    this._ensureSubscription();
    this._render();
  },

  _bindUI() {
    if (this._bound) return;
    const addBtn = document.getElementById('db-add-btn');
    const body   = document.getElementById('db-body');
    if (!addBtn || !body) return;
    addBtn.addEventListener('click', () => this._openAddModal());
    body.addEventListener('click', (e) => this._handleItemClick(e));
    this._bound = true;
  },

  _ensureSubscription() {
    if (this._subscribed) return;
    if (!window.FirebaseDB) return;
    window.FirebaseDB.ref('deliveryBoard').on('value', (snap) => {
      this._items = snap.val() || {};
      this._render();
    }, (err) => {
      console.warn('[DeliveryBoard] 구독 에러:', err?.message);
    });
    this._subscribed = true;
  },

  _render() {
    const body = document.getElementById('db-body');
    if (!body) return;

    const entries = Object.entries(this._items).sort((a, b) => {
      const hmA = (a[1].hour || 0) * 60 + (a[1].minute || 0);
      const hmB = (b[1].hour || 0) * 60 + (b[1].minute || 0);
      if (hmA !== hmB) return hmA - hmB;
      return String(a[1].createdAt || '').localeCompare(String(b[1].createdAt || ''));
    });

    if (!entries.length) {
      body.innerHTML = '<div class="db-empty">등록된 배송현황이 없습니다.</div>';
      return;
    }

    body.innerHTML = entries.map(([id, v]) => {
      const hh = String(v.hour   || 0).padStart(2, '0');
      const mm = String(v.minute || 0).padStart(2, '0');
      const qty = Number(v.quantity || 0);
      return `
        <div class="db-item" data-id="${id}">
          <span class="db-loc" title="${UI.escHtml(v.location || '')}">${UI.escHtml(v.location || '')}</span>
          <span class="db-qty">${qty}개</span>
          <button class="db-qty-btn db-up"   data-action="up"   title="수량 +1" aria-label="수량 증가">▲</button>
          <button class="db-qty-btn db-down" data-action="down" title="수량 -1" aria-label="수량 감소">▼</button>
          <span class="db-time">${hh}:${mm}</span>
          <button class="db-done-btn" data-action="done" title="출차완료 처리">출차완료</button>
        </div>`;
    }).join('');
  },

  async _handleItemClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const item = btn.closest('.db-item');
    if (!item) return;
    const id = item.dataset.id;
    const action = btn.dataset.action;

    try {
      btn.disabled = true;
      if (action === 'up') {
        await window.FirebaseDB.ref(`deliveryBoard/${id}/quantity`).transaction(v => (Number(v) || 0) + 1);
      } else if (action === 'down') {
        await window.FirebaseDB.ref(`deliveryBoard/${id}/quantity`).transaction(v => Math.max(0, (Number(v) || 0) - 1));
      } else if (action === 'done') {
        await window.FirebaseDB.ref(`deliveryBoard/${id}`).remove();
        UI.toast('출차완료 처리되었습니다.', 'success');
      }
    } catch (err) {
      console.error('[DeliveryBoard] 처리 실패:', err);
      UI.toast(`처리 실패: ${err?.message || '알 수 없는 오류'}`, 'error');
    } finally {
      btn.disabled = false;
    }
  },

  _openAddModal() {
    const now = new Date();
    const defH = String(now.getHours()).padStart(2, '0');
    const defM = String(now.getMinutes()).padStart(2, '0');

    const content = `
      <div class="form-group">
        <label for="db-in-location">장소</label>
        <input type="text" id="db-in-location" class="form-control" placeholder="예: 남대구장례식장" maxlength="60" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="db-in-qty">수량</label>
          <input type="number" id="db-in-qty" class="form-control" min="0" step="1" value="1" required>
        </div>
        <div class="form-group">
          <label for="db-in-time">출차 시각</label>
          <input type="time" id="db-in-time" class="form-control" value="${defH}:${defM}" required>
        </div>
      </div>`;

    const overlay = UI.modal({
      title: '🚚 배송현황 추가',
      content,
      confirmText: '추가',
      cancelText: '취소',
      onConfirm: async (ov) => {
        const loc   = (ov.querySelector('#db-in-location')?.value || '').trim();
        const qty   = Number(ov.querySelector('#db-in-qty')?.value) || 0;
        const tVal  = ov.querySelector('#db-in-time')?.value || '';

        if (!loc) { UI.toast('장소를 입력해주세요.', 'warning'); return; }

        const [hStr, mStr] = tVal.split(':');
        const h = Number.isFinite(Number(hStr)) ? Math.max(0, Math.min(23, Number(hStr))) : 0;
        const m = Number.isFinite(Number(mStr)) ? Math.max(0, Math.min(59, Number(mStr))) : 0;

        const session = (typeof Auth !== 'undefined' && Auth.getSession) ? Auth.getSession() : null;
        const payload = {
          location:  loc,
          quantity:  Math.max(0, qty),
          hour:      h,
          minute:    m,
          createdAt: new Date().toISOString(),
          createdBy: session?.userId || null,
        };

        try {
          await window.FirebaseDB.ref('deliveryBoard').push(payload);
          UI.toast('배송현황이 추가되었습니다.', 'success');
        } catch (err) {
          console.error('[DeliveryBoard] 추가 실패:', err);
          UI.toast(`추가 실패: ${err?.message || '알 수 없는 오류'}`, 'error');
        }
      },
    });

    /* 모달 열리자마자 location 인풋 포커스 */
    requestAnimationFrame(() => {
      overlay.querySelector('#db-in-location')?.focus();
    });
  },
};

window.DeliveryBoard = DeliveryBoard;

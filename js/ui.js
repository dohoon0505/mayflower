/* ============================================================
   UI.JS — Toast · Modal · Loading · Formatters · DOM helpers
   ============================================================ */

const UI = {
  /* ── Toast ──────────────────────────────────────────────── */
  toast(message, type = 'info', duration = 3200) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 350);
    }, duration);
  },

  /* ── Confirm modal ──────────────────────────────────────── */
  confirm(message, title = '확인') {
    return new Promise(resolve => {
      UI.modal({
        title, content: `<p style="color:var(--text-secondary)">${message}</p>`,
        confirmText: '확인', cancelText: '취소',
        onConfirm: () => resolve(true),
        onCancel:  () => resolve(false),
      });
    });
  },

  /* ── Generic modal ──────────────────────────────────────── */
  modal({ title = '', content = '', onConfirm, onCancel, confirmText = '확인', cancelText = '취소', size = '' } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box ${size}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close btn-icon" aria-label="닫기">✕</button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">
          <button class="btn btn-ghost modal-cancel">${cancelText}</button>
          <button class="btn btn-primary modal-confirm">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const close = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
    };
    overlay.querySelector('.modal-close').onclick = () => { close(); onCancel?.(); };
    overlay.querySelector('.modal-cancel').onclick = () => { close(); onCancel?.(); };
    overlay.querySelector('.modal-confirm').onclick = () => { close(); onConfirm?.(overlay); };
    overlay.onclick = e => { if (e.target === overlay) { close(); onCancel?.(); } };
    return overlay;
  },

  /* ── Loading ────────────────────────────────────────────── */
  loading(show) {
    let el = document.getElementById('global-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-loading';
      el.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(el);
    }
    el.style.display = show ? 'flex' : 'none';
  },

  /* ── Formatters ─────────────────────────────────────────── */
  fmtDatetime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
  fmtDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  },
  fmtTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  /* Returns e.g. "2시간 30분 남음" / "15분 지남" */
  timeRemaining(iso) {
    if (!iso) return '-';
    const diff = new Date(iso) - Date.now();
    const abs  = Math.abs(diff);
    const h    = Math.floor(abs / 3600000);
    const m    = Math.floor((abs % 3600000) / 60000);
    if (diff > 0) {
      if (h > 0)  return `${h}시간 ${m}분 남음`;
      if (m > 0)  return `${m}분 남음`;
      return '곧 도착';
    } else {
      if (h > 0)  return `${h}시간 ${m}분 지남`;
      if (m > 0)  return `${m}분 지남`;
      return '방금 지남';
    }
  },

  STATUS_LABELS: ['접수됨', '리본출력완료', '제작완료', '배송중', '배송완료', '취소', '반품'],
  STATUS_CLS:    ['status-pending','status-ribbon','status-done','status-delivery','status-complete','status-cancel','status-return'],

  statusBadge(status) {
    const lbl = UI.STATUS_LABELS[status] ?? '알 수 없음';
    const cls = UI.STATUS_CLS[status] ?? '';
    return `<span class="badge ${cls}">${lbl}</span>`;
  },

  ROLE_LABELS: { floor2: '2층 수주', floor1: '1층 제작', driver: '배송기사', admin: '관리자' },
  roleBadge(role) {
    return `<span class="badge badge-role">${UI.ROLE_LABELS[role] || role}</span>`;
  },

  initials(name) {
    if (!name) return '?';
    return name.slice(0, 1);
  },

  escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  },

  /* ── DOM shortcuts ──────────────────────────────────────── */
  $:  (sel, ctx = document) => ctx.querySelector(sel),
  $$: (sel, ctx = document) => [...ctx.querySelectorAll(sel)],

  setContent(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  },
  setFilter(html) { UI.setContent('filter-area', html); },
  setMain(html)   { UI.setContent('main-content', html); },
};

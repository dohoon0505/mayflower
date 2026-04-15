/* ============================================================
   CHAT.JS — Right panel: dummy chat (localStorage-backed)
   v2: check/acknowledge feature + role-aware sender display
   ============================================================ */

const Chat = {
  _session: null,

  NOTICES: {
    floor2:  '📦 오늘 접수된 주문은 1층에서 빠르게 확인됩니다.',
    floor1:  '🔔 제작 완료 후 기사 배정을 잊지 마세요.',
    driver:  '🚚 배송 완료 시 사진을 꼭 첨부해 주세요.',
    admin:   '🛠 관리자 공지: 이번 달 통계를 정기적으로 확인하세요.',
  },

  ROLE_LABELS: { floor2: '2층 수주', floor1: '1층 제작', driver: '배송기사', admin: '관리자', system: '시스템' },

  SEED_MSGS: {
    floor2:  [
      { name: '1층 담당자', role: 'floor1', text: '오늘 접수 건수 많습니다. 서둘러 주세요! 😊' },
      { name: '관리자',     role: 'admin',  text: '주문 접수 완료됐습니다!' },
      { name: '이민준',     role: 'driver', text: '배송 출발했습니다. 곧 도착 예정입니다.' },
    ],
    floor1:  [
      { name: '2층 담당자', role: 'floor2', text: '신규 주문 방금 접수했습니다.' },
      { name: '관리자',     role: 'admin',  text: '리본 출력기 정상 작동 중입니다.' },
      { name: '이민준',     role: 'driver', text: '배송 완료했습니다! 수고하세요.' },
    ],
    driver:  [
      { name: '1층 담당자', role: 'floor1', text: '오늘 날씨 좋으니 배송 파이팅입니다! 🌤' },
      { name: '2층 담당자', role: 'floor2', text: '배송지 주소 꼭 확인해 주세요.' },
      { name: '관리자',     role: 'admin',  text: '완료 처리 잘 부탁드립니다.' },
    ],
    admin:   [
      { name: '2층 담당자', role: 'floor2', text: '이번 달 배송 완료율이 높습니다 👍' },
      { name: '1층 담당자', role: 'floor1', text: '기사 추가가 필요합니다.' },
      { name: '이민준',     role: 'driver', text: '통계 데이터 업데이트됨.' },
    ],
  },

  init(session) {
    Chat._session = session;
    Chat._ensureSeed(session.role);
    Chat._renderProfile();
    Chat._renderNotice();
    Chat._renderMessages();
    Chat._renderDriverStatus();
    Chat._bindInput();
    Chat._bindChatActions();
  },

  _ensureSeed(role) {
    const existing = Store.getChat();
    if (existing.length) return;
    const seeds = Chat.SEED_MSGS[role] || [];
    const now = Date.now();
    seeds.forEach((s, i) => {
      Store.addChat({
        id:         now - (seeds.length - i) * 120000,
        sender:     `seed_${i}`,
        name:       s.name,
        role:       s.role,
        text:       s.text,
        checkedBy:  [],
        ts:         new Date(now - (seeds.length - i) * 120000).toISOString(),
      });
    });
  },

  _renderProfile() {
    const s = Chat._session;
    const el = document.getElementById('chat-profile');
    if (!el) return;
    const roleLabel = Chat.ROLE_LABELS[s.role] || s.role;
    const roleCls   = `chat-role-${s.role}`;
    const avatarCls = `chat-avatar-role-${s.role}`;
    el.innerHTML = `
      <div class="chat-profile-inner">
        <div class="avatar ${avatarCls}" style="width:42px;height:42px;font-size:1.1rem">${UI.escHtml(UI.initials(s.displayName))}</div>
        <div class="chat-profile-info">
          <div class="chat-profile-name">${UI.escHtml(s.displayName)}</div>
          <div style="margin-top:2px"><span class="chat-sender-badge ${roleCls}">${roleLabel}</span></div>
        </div>
      </div>`;
  },

  _renderNotice() {
    const el = document.getElementById('chat-notice');
    if (!el) return;
    const notice = Chat.NOTICES[Chat._session?.role] || '';
    el.textContent = notice;
    el.style.display = notice ? 'block' : 'none';
  },

  _renderMessages() {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    const msgs = Store.getChat();
    if (!msgs.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-text">메시지가 없습니다.</div></div>';
      return;
    }
    el.innerHTML = msgs.map(m => Chat._msgHtml(m)).join('');
    el.scrollTop = el.scrollHeight;
  },

  _msgHtml(m) {
    const session = Chat._session;
    const isMe = m.sender === session?.userId || m.sender === 'me';
    const cls = isMe ? 'me' : 'other';
    const d = new Date(m.ts);
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    const roleLabel = Chat.ROLE_LABELS[m.role] || m.role || '';
    const roleCls   = `chat-role-${m.role || 'system'}`;
    const avatarCls = `chat-avatar-role-${m.role || 'system'}`;

    /* Checked-by chips */
    const checkedBy = m.checkedBy || [];
    const checkChips = checkedBy.map(c =>
      `<span class="check-chip">✓ ${UI.escHtml(c.name)}</span>`
    ).join('');
    const alreadyChecked = checkedBy.some(c => c.userId === session?.userId);
    const checkBtn = !isMe
      ? `<button class="chat-check-btn${alreadyChecked ? ' checked' : ''}" data-mid="${m.id}">${alreadyChecked ? '✓ 확인함' : '✓ 확인'}</button>`
      : '';

    if (isMe) {
      return `
        <div class="chat-msg ${cls}">
          <div class="chat-bubble">${UI.escHtml(m.text)}</div>
          <div class="chat-msg-footer">
            <span class="chat-msg-time">${time}</span>
            ${checkChips ? `<div class="chat-checked-by">${checkChips}</div>` : ''}
          </div>
        </div>`;
    }

    return `
      <div class="chat-msg ${cls}">
        <div class="chat-msg-header">
          <div class="chat-avatar-sm ${avatarCls}">${UI.escHtml(UI.initials(m.name || '?'))}</div>
          <span class="chat-sender-name">${UI.escHtml(m.name || '시스템')}</span>
          ${roleLabel ? `<span class="chat-sender-badge ${roleCls}">${roleLabel}</span>` : ''}
        </div>
        <div class="chat-bubble">${UI.escHtml(m.text)}</div>
        <div class="chat-msg-footer">
          <span class="chat-msg-time">${time}</span>
          ${checkBtn}
          ${checkChips ? `<div class="chat-checked-by">${checkChips}</div>` : ''}
        </div>
      </div>`;
  },

  _bindInput() {
    const input = document.getElementById('chat-input');
    const btn   = document.getElementById('chat-send');
    if (!input || !btn) return;

    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      const s = Chat._session;
      const msg = {
        id:        Date.now(),
        sender:    s?.userId || 'me',
        name:      s?.displayName || '나',
        role:      s?.role || '',
        text,
        checkedBy: [],
        ts:        new Date().toISOString(),
      };
      Store.addChat(msg);
      input.value = '';
      Chat._renderMessages();
    };

    btn.addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  },

  /* ── Driver status section ───────────────────────────────── */
  _renderDriverStatus() {
    const el = document.getElementById('chat-driver-status');
    if (!el) return;

    const completed = Store.getOrders({ status: 4 });
    /* Group by driver, keep most recent (by updatedAt) */
    const map = {};
    completed.forEach(o => {
      if (!o.assignedDriverName) return;
      const cur = map[o.assignedDriverName];
      if (!cur || new Date(o.updatedAt) > new Date(cur.updatedAt)) {
        map[o.assignedDriverName] = o;
      }
    });

    const items = Object.values(map).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    if (!items.length) {
      el.innerHTML = '<div class="driver-status-empty">배송 완료 기록 없음</div>';
      return;
    }

    const rows = items.map(o => {
      const addr = (o.deliveryAddress || '').substring(0, 18);
      return `
        <div class="driver-status-item">
          <span class="ds-name">${UI.escHtml(o.assignedDriverName)}</span>
          <span class="ds-time">${Chat._timeAgo(o.updatedAt)}</span>
          <span class="ds-addr">${UI.escHtml(addr)}…</span>
          <span class="ds-done">완료</span>
        </div>`;
    }).join('');

    el.innerHTML = `<div class="driver-status-header">🚚 배송기사 현황</div>${rows}`;
  },

  _timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}시간 전`;
    return `${Math.floor(hrs / 24)}일 전`;
  },

  _bindChatActions() {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    el.addEventListener('click', e => {
      const btn = e.target.closest('.chat-check-btn');
      if (!btn) return;
      const msgId = +btn.dataset.mid;
      const s = Chat._session;
      if (!s) return;
      const checked = Store.checkChatMsg(msgId, s);
      if (!checked) { UI.toast('이미 확인한 메시지입니다.', 'info', 1500); return; }
      Chat._renderMessages();
    });
  },
};

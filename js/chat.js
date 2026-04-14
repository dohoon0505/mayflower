/* ============================================================
   CHAT.JS — Right panel: dummy chat (localStorage-backed)
   ============================================================ */

const Chat = {
  _session: null,

  NOTICES: {
    floor2:  '📦 오늘 접수된 주문은 1층에서 빠르게 확인됩니다.',
    floor1:  '🔔 제작 완료 후 기사 배정을 잊지 마세요.',
    driver:  '🚚 배송 완료 시 사진을 꼭 첨부해 주세요.',
    admin:   '🛠 관리자 공지: 이번 달 통계를 정기적으로 확인하세요.',
  },

  SEED_MSGS: {
    floor2:  ['안녕하세요! 오늘도 잘 부탁드립니다 😊', '주문 접수 완료됐습니다!', '1층에서 제작 시작했다고 합니다.'],
    floor1:  ['오늘 배송 건수가 많네요. 기사 배정 서둘러 주세요.', '리본 출력기 정상 작동 중입니다.', '수고하세요!'],
    driver:  ['오늘 날씨 좋으니 배송 파이팅입니다! 🌤', '배송지 주소 꼭 확인하세요.', '완료 처리 잘 부탁드립니다.'],
    admin:   ['이번 달 배송 완료율이 높습니다 👍', '기사 추가가 필요하면 기사 관리 탭을 이용하세요.', '통계 데이터 업데이트됨.'],
  },

  init(session) {
    Chat._session = session;
    Chat._ensureSeed(session.role);
    Chat._renderProfile();
    Chat._renderNotice();
    Chat._renderMessages();
    Chat._bindInput();
  },

  _ensureSeed(role) {
    const existing = Store.getChat();
    if (existing.length) return;
    const seeds = Chat.SEED_MSGS[role] || [];
    const now = Date.now();
    seeds.forEach((text, i) => {
      Store.addChat({
        id:     now - (seeds.length - i) * 60000,
        sender: 'system',
        name:   '시스템',
        text,
        ts:     new Date(now - (seeds.length - i) * 60000).toISOString(),
      });
    });
  },

  _renderProfile() {
    const s = Chat._session;
    const el = document.getElementById('chat-profile');
    if (!el) return;
    el.innerHTML = `
      <div class="chat-profile-inner">
        <div class="avatar">${UI.escHtml(UI.initials(s.displayName))}</div>
        <div class="chat-profile-info">
          <div class="chat-profile-name">${UI.escHtml(s.displayName)}</div>
          <div class="chat-profile-role">${UI.roleBadge(s.role)}</div>
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
    if (!msgs.length) { el.innerHTML = '<div class="empty-state"><div class="empty-text">메시지가 없습니다.</div></div>'; return; }
    el.innerHTML = msgs.map(m => Chat._msgHtml(m)).join('');
    el.scrollTop = el.scrollHeight;
  },

  _msgHtml(m) {
    const isMe = m.sender === Chat._session?.userId || m.sender === 'me';
    const cls = isMe ? 'me' : 'other';
    const d = new Date(m.ts);
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const senderLine = !isMe ? `<span class="chat-msg-sender">${UI.escHtml(m.name || '시스템')}</span>` : '';
    return `
      <div class="chat-msg ${cls}">
        ${senderLine}
        <div class="chat-bubble">${UI.escHtml(m.text)}</div>
        <span class="chat-msg-time">${time}</span>
      </div>`;
  },

  _bindInput() {
    const input = document.getElementById('chat-input');
    const btn   = document.getElementById('chat-send');
    if (!input || !btn) return;

    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      const msg = {
        id:     Date.now(),
        sender: 'me',
        name:   Chat._session?.displayName || '나',
        text,
        ts:     new Date().toISOString(),
      };
      Store.addChat(msg);
      input.value = '';
      Chat._renderMessages();
    };

    btn.addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  },
};

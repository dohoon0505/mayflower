/* ============================================================
   CHAT.JS — Firebase Realtime Database 연동 버전
   v3: localStorage mock 제거, 실시간 동기화
   ============================================================ */

const Chat = {
  _session:       null,
  _msgsRef:       null,   // 읽기용 (정렬·제한 적용)
  _writeRef:      null,   // 쓰기용 (push/update)
  _cache:         {},     // key → message object
  _lastRendDate:  null,   // child_added 날짜 구분선 추적용

  NOTICES: {
    floor2: '📦 오늘 접수된 주문은 1층에서 빠르게 확인됩니다.',
    floor1: '🔔 제작 완료 후 기사 배정을 잊지 마세요.',
    driver: '🚚 배송 완료 시 사진을 꼭 첨부해 주세요.',
    admin:  '🛠 관리자 공지: 이번 달 통계를 정기적으로 확인하세요.',
  },

  ROLE_LABELS: { floor2: '2층 수주', floor1: '1층 제작', driver: '배송기사', admin: '관리자', system: '시스템' },

  init(session) {
    Chat._session = session;
    Chat._renderProfile();
    Chat._renderNotice();

    if (!window.FirebaseDB) {
      console.error('[Chat] FirebaseDB가 초기화되지 않았습니다. firebase-config.js 로드 순서를 확인하세요.');
      const el = document.getElementById('chat-messages');
      if (el) el.innerHTML = '<div class="empty-state"><div class="empty-text">⚠️ Firebase 연결 실패</div></div>';
      return;
    }

    /* 읽기: ts 순 정렬 + 최근 200개 */
    Chat._msgsRef  = window.FirebaseDB.ref('messages').orderByChild('ts').limitToLast(200);
    /* 쓰기: 정렬 없는 base ref */
    Chat._writeRef = window.FirebaseDB.ref('messages');
    Chat._cache    = {};

    Chat._bindInput();
    Chat._bindChatActions();
    Chat._initRealtime();
  },

  /* ── Realtime listeners ──────────────────────────────────── */
  _initRealtime() {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    el.innerHTML = '';

    Chat._lastRendDate = null;
    Chat._msgsRef.on('child_added', snap => {
      const m = { ...snap.val(), _key: snap.key };
      Chat._cache[snap.key] = m;
      const dateStr = Chat._localDateLabel(new Date(m.ts));
      if (dateStr !== Chat._lastRendDate) {
        el.insertAdjacentHTML('beforeend', Chat._dateSepHtml(dateStr));
        Chat._lastRendDate = dateStr;
      }
      el.insertAdjacentHTML('beforeend', Chat._msgHtml(m));
      el.scrollTop = el.scrollHeight;
    }, err => console.error('[Chat] child_added error:', err));

    Chat._msgsRef.on('child_changed', snap => {
      const m = { ...snap.val(), _key: snap.key };
      Chat._cache[snap.key] = m;
      Chat._rerenderAll();
    }, err => console.error('[Chat] child_changed error:', err));

    Chat._msgsRef.on('child_removed', snap => {
      delete Chat._cache[snap.key];
      Chat._rerenderAll();
    });
  },

  _rerenderAll() {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    const sorted = Object.values(Chat._cache)
      .sort((a, b) => new Date(a.ts) - new Date(b.ts));
    let lastDate = null;
    const parts = [];
    sorted.forEach(m => {
      const dateStr = Chat._localDateLabel(new Date(m.ts));
      if (dateStr !== lastDate) {
        parts.push(Chat._dateSepHtml(dateStr));
        lastDate = dateStr;
      }
      parts.push(Chat._msgHtml(m));
    });
    el.innerHTML = parts.join('');
    Chat._lastRendDate = lastDate;
    el.scrollTop = el.scrollHeight;
  },

  /* ── Profile / Notice ────────────────────────────────────── */
  _renderProfile() {
    const s = Chat._session;
    const el = document.getElementById('sidebar-profile');
    if (!el || !s) return;
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
    if (!el) return;  // 요소 제거됨 — no-op
    const notice = Chat.NOTICES[Chat._session?.role] || '';
    el.textContent = notice;
    el.style.display = notice ? 'block' : 'none';
  },

  /* ── Message HTML ────────────────────────────────────────── */
  _msgHtml(m) {
    const session = Chat._session;
    const isMe = m.sender === session?.userId;
    const cls = isMe ? 'me' : 'other';
    const d = new Date(m.ts);
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    const roleLabel = Chat.ROLE_LABELS[m.role] || m.role || '';
    const roleCls   = `chat-role-${m.role || 'system'}`;
    const avatarCls = `chat-avatar-role-${m.role || 'system'}`;

    const checkedBy = Array.isArray(m.checkedBy) ? m.checkedBy : Object.values(m.checkedBy || {});
    const alreadyChecked = checkedBy.some(c => c.userId === session?.userId);
    const checkBtn = !isMe
      ? `<button class="chat-check-btn${alreadyChecked ? ' checked' : ''}" data-mkey="${m._key}">${alreadyChecked ? '✓ 확인함' : '확인'}</button>`
      : '';
    const checkChips = checkedBy.length
      ? `<div class="chat-checked-by">${checkedBy.map(c => `<span class="check-chip"><span class="check-chip-name">${UI.escHtml(c.name)}</span><span class="check-chip-role">${Chat.ROLE_LABELS[c.role] || c.role}</span></span>`).join('')}</div>`
      : '';

    if (isMe) {
      return `
        <div class="chat-msg ${cls}">
          <div class="chat-bubble">${UI.escHtml(m.text)}</div>
          <div class="chat-msg-footer">
            <span class="chat-msg-time">${time}</span>
            ${checkChips}
          </div>
        </div>`;
    }

    return `
      <div class="chat-msg ${cls}">
        <div class="chat-msg-header">
          <span class="chat-sender-name">${UI.escHtml(m.name || '시스템')}</span>
          ${roleLabel ? `<span class="chat-sender-badge ${roleCls}">${roleLabel}</span>` : ''}
        </div>
        <div class="chat-bubble">${UI.escHtml(m.text)}</div>
        <div class="chat-msg-footer">
          <span class="chat-msg-time">${time}</span>
          ${checkBtn}
          ${checkChips}
        </div>
      </div>`;
  },

  /* ── Send (Firebase push) ────────────────────────────────── */
  _bindInput() {
    const input = document.getElementById('chat-input');
    const btn   = document.getElementById('chat-send');
    if (!input || !btn) return;

    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      const s = Chat._session;
      if (!s) return;

      Chat._writeRef.push({
        sender:    s.userId,
        name:      s.displayName || '익명',
        role:      s.role || '',
        text,
        checkedBy: [],
        ts:        new Date().toISOString(),
      }).catch(err => {
        console.error('[Chat] push 실패:', err);
        UI.toast('메시지 전송 실패', 'error');
      });

      input.value = '';
      /* DOM 갱신은 child_added가 담당 */
    };

    btn.addEventListener('click', send);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  },

  /* ── Check button (Firebase update) ──────────────────────── */
  _bindChatActions() {
    const el = document.getElementById('chat-messages');
    if (!el) return;

    el.addEventListener('click', e => {
      const btn = e.target.closest('.chat-check-btn');
      if (!btn) return;
      const key = btn.dataset.mkey;
      const s   = Chat._session;
      const m   = Chat._cache[key];
      if (!key || !s || !m) return;

      const already = (m.checkedBy || []).some(c => c.userId === s.userId);
      if (already) {
        UI.toast('이미 확인한 메시지입니다.', 'info', 1500);
        return;
      }

      const updated = [...(m.checkedBy || []), {
        userId: s.userId,
        name:   s.displayName,
        role:   s.role,
        ts:     new Date().toISOString(),
      }];

      Chat._writeRef.child(key).child('checkedBy').set(updated)
        .catch(err => {
          console.error('[Chat] checkedBy 업데이트 실패:', err);
          UI.toast('확인 처리 실패', 'error');
        });
      /* DOM 갱신은 child_changed가 담당 */
    });
  },

  /* ── Utility ─────────────────────────────────────────────── */
  _localDateLabel(date) {
    const d = new Date(date);
    const y = d.getFullYear(), mo = d.getMonth() + 1, day = d.getDate();
    const pad = n => String(n).padStart(2, '0');
    return `${y}년 ${pad(mo)}월 ${pad(day)}일`;
  },

  _dateSepHtml(dateStr) {
    return `<div class="chat-date-sep"><span>${dateStr}</span></div>`;
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
};

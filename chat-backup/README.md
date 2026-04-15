# chat-backup — Firebase 연동 직전 스냅샷

이 폴더는 `js/chat.js`를 Firebase Realtime Database 기반으로 교체하기 **직전**의 localStorage mock 구현을 보존합니다. 롤백이 필요하거나, 오프라인 모드·다른 스토리지로 재마이그레이션할 때 참고용.

## 백업 파일

| 파일 | 원본 위치 | 설명 |
|------|-----------|------|
| `chat.js` | `js/chat.js` | Chat 객체 전체 — localStorage 버전 |
| `chat-markup.html` | `app.html` Line 34, 71-78, 52, 94, 128 | chat-panel HTML + 스크립트 로드 + init 호출 |
| `chat-styles.css` | `css/layout.css` 157-168, 340-469 + `css/components.css` 516-575 | 모든 `.chat-*` / `.check-chip` 셀렉터 |

## localStorage 스키마

**Key:** `maydaegu.chat`

**Value:** 메시지 배열
```js
[
  {
    id: 1700000000000,              // number (Date.now() 등)
    sender: "user42",                // userId | 'me' | 'seed_0'
    name: "홍길동",                   // 표시명
    role: "floor1",                  // floor2 | floor1 | driver | admin | system
    text: "메시지 본문",
    checkedBy: [                     // 확인한 사람 목록
      { userId: "user99", name: "김아무", role: "driver", ts: "2024-..." }
    ],
    ts: "2024-01-15T09:30:00.000Z"   // ISO 문자열
  },
  ...
]
```

## Store.js 의존성 (유지됨)

`js/store.js` Line 260~277의 3개 메서드는 **삭제하지 않고 그대로 둠** — 백업 복원 시 바로 작동:

- `Store.getChat()` → 전체 메시지 배열 반환
- `Store.addChat(msg)` → 메시지 append
- `Store.checkChatMsg(msgId, user)` → checkedBy 업데이트

## DOM 엘리먼트 ID

Firebase 버전에서도 동일하게 유지해야 함:

- `#chat-panel` — aside 컨테이너
- `#chat-messages` — 메시지 리스트 div
- `#chat-input` — 입력 텍스트
- `#chat-send` — 전송 버튼
- `#sidebar-profile` — 사이드바 프로필 카드 (Chat._renderProfile이 작성)
- `#chat-toggle-btn` — 모바일 채팅 토글
- `#chat-notice` — 역할별 공지 (이미 제거됨, chat.js는 no-op 처리)

## 롤백 방법

1. `chat-backup/chat.js` → `js/chat.js`로 복사
2. `app.html`에서 Firebase 스크립트 3줄 제거:
   - `firebase-app-compat.js`
   - `firebase-database-compat.js`
   - `js/firebase-config.js`
3. `js/firebase-config.js` 삭제
4. `chat-notice` div가 필요하면 `chat-markup.html` 참조해서 복원

CSS와 HTML 마크업은 Firebase 버전도 그대로 재사용하므로 별도 복원 불필요.

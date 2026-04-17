# 메이대구 Firebase 핸드오프 문서

> **이 문서의 목적**
> 메이대구 시스템은 아키텍처를 두 갈래로 분리합니다.
> - **웹 대시보드 (1층 / 2층 / 관리자)** → Vanilla JS 프로젝트 `mayflower/` 로 이관
> - **모바일 앱 (배송기사 전용)** → 이 Flutter 레포를 축소하여 Android / iOS 로 유지
>
> 양쪽이 **동일한 Firebase 백엔드** (RTDB + Auth + Storage) 를 공유하므로,
> Vanilla JS 개발자가 이 Firebase 를 추측 없이 100% 이해하도록 이 문서가 **단일 진실 원천(SSOT)** 역할을 합니다.
>
> 본 문서는 **백엔드 계약서** 입니다. UI / 디자인 / 테마 / 레이아웃은 일절 다루지 않습니다.
> (디자인은 `mayflower/card-components-guide.md`, `mayflower/order-card-deep-guide.md` 참고)

---

## § 0. TL;DR — 1분 요약

| 항목 | 값 |
|------|-----|
| Firebase 프로젝트 ID | `mayflower-5c9dd` |
| RTDB 리전 | `asia-southeast1` (싱가포르) |
| RTDB URL | `https://mayflower-5c9dd-default-rtdb.asia-southeast1.firebasedatabase.app` |
| Storage 버킷 | `mayflower-5c9dd.firebasestorage.app` |
| Auth 도메인 | `mayflower-5c9dd.firebaseapp.com` |
| Web API Key | `AIzaSyBC4y-bbzIUdDxYo-K5kIF8_ms-XwNpBNs` |
| Web App ID | `1:172745742412:web:abf4c845ec591f4929bce9` |
| 인증 방식 | Email/Password (username을 `@maydaegu.internal` 이메일로 합성) |

### 역할 · 플랫폼 매트릭스

| 역할 | 한국어 라벨 | 플랫폼 | 주요 기능 |
|------|-----------|------|----------|
| `floor2` | 2층 수주 | 웹 (JS) | 주문 생성, 내 주문 조회 |
| `floor1` | 1층 제작 | 웹 (JS) | 전체 주문 열람, 상태 전환, 기사 배차, 매장사진 업로드 |
| `admin` | 관리자 | 웹 (JS) | 모든 권한 + 사용자/상품/카테고리/기사 CRUD |
| `driver` | 배송기사 | **모바일 (Flutter)** | 내 배송 목록, 배송완료 사진 업로드, 위치 송신 |

### 동작 원리 1줄

> **Storage 에 파일을 올리고, 그 URL 을 RTDB 의 해당 레코드에 적어 넣으면, 상대편은 RTDB 를 구독(listen)하고 있다가 새 URL 이 들어오는 순간 자동으로 반영한다.**

---

## § 1. Firebase 프로젝트 설정 · 초기화

### 1.1 웹 `firebaseConfig` 오브젝트

Flutter `lib/firebase_options.dart` 의 `web` 상수를 그대로 JS 로 옮기면 됩니다.

```js
// mayflower/js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyBC4y-bbzIUdDxYo-K5kIF8_ms-XwNpBNs",
  authDomain: "mayflower-5c9dd.firebaseapp.com",
  databaseURL: "https://mayflower-5c9dd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mayflower-5c9dd",
  storageBucket: "mayflower-5c9dd.firebasestorage.app",
  messagingSenderId: "172745742412",
  appId: "1:172745742412:web:abf4c845ec591f4929bce9",
  measurementId: "G-RXM19QCGMY",
};
```

> `databaseURL` 은 반드시 포함해야 합니다. RTDB 는 Firestore 와 달리 리전이 URL 에 박혀 있어서 생략 시 기본 US 리전에 접속하려다 실패합니다.

### 1.2 SDK 선택: Compat vs Modular

| 옵션 | 문법 | 추천 상황 |
|------|------|----------|
| **Compat SDK** (v8 호환) | `firebase.database()`, `firebase.auth()` | 현재 `mayflower/js/firebase-config.js` 가 이미 사용 중. CDN 로드. 전환비용 최소. |
| **Modular SDK** (v9+) | `getDatabase(app)`, `signInWithEmailAndPassword(auth, ...)` | 번들러(webpack/vite) 쓸 때. 트리쉐이킹으로 번들 사이즈 작음. |

**기본 방침: Compat SDK 유지** (기존 코드 재사용 가능, CDN 스크립트 태그만 넣으면 됨)

```html
<!-- index.html -->
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js"></script>
<script src="js/firebase-config.js"></script>
```

```js
// js/firebase-config.js
firebase.initializeApp(firebaseConfig);
window.FirebaseDB = firebase.database();
window.FirebaseAuth = firebase.auth();
window.FirebaseStorage = firebase.storage();
```

### 1.3 Auth 복원 대기 (새로고침 플래시 방지)

Flutter `main.dart` 는 `authStateChanges().first.timeout(3s)` 로 persisted 세션 복원을 기다린 뒤 `runApp` 합니다. JS 측도 동등하게:

```js
// app 진입점
await new Promise((resolve) => {
  const unsub = FirebaseAuth.onAuthStateChanged((user) => {
    unsub();
    resolve(user);
  });
  setTimeout(resolve, 3000); // 3초 타임아웃
});
// 이 시점에는 FirebaseAuth.currentUser 가 확정된 상태
renderApp();
```

이렇게 하지 않으면 페이지 새로고침 시 "로그인 화면 → 자동으로 홈" 으로 순간 튕기는 현상이 발생합니다.

### 1.4 모바일 앱 설정

Flutter 앱은 `lib/firebase_options.dart` 의 `android` / `ios` 블록을 사용합니다 (Web 과 프로젝트는 같지만 appId/apiKey 가 플랫폼별로 다름). JS 개발자가 직접 만질 일은 없으나 참고:

- Android appId: `1:172745742412:android:ece3c59fdfd35e6029bce9`
- iOS appId: `1:172745742412:ios:38ba02fb6a62e88129bce9`
- iOS Bundle: `com.example.mayflowerFlutter` (추후 변경 가능)

---

## § 2. Realtime Database 경로 전수

모든 경로는 `lib/core/constants/firebase_paths.dart` 에 상수로 정의되어 있습니다.

```dart
static const users = 'users';
static const orders = 'orders';
static const products = 'products';
static const categories = 'categories';
static const drivers = 'drivers';
static const messages = 'messages';
static const driverStatus = 'driverStatus';

static const companyLat = 35.8293;    // 회사(메이대구) 위도
static const companyLng = 128.5453;   // 회사 경도
static const returnRadius = 100.0;    // 100m 이내면 "복귀" 로 판정
```

### 2.1 `/users/{uid}` — 사용자 프로필

`lib/models/app_user.dart` 기반.

쓰는 주체: **AuthService** (회원가입 시 본인 계정 생성), **admin** (승인·역할 부여·활성 토글)

| 필드 | 타입 | 필수 | 예시 | 비고 |
|------|------|------|------|------|
| `username` | string | ✅ | `"floor2user"` | 소문자 trim, 이메일 합성에 사용 |
| `displayName` | string | ✅ | `"2층 담당자 김철수"` | 화면 표시용 |
| `role` | string nullable | — | `"floor2"` \| `"floor1"` \| `"driver"` \| `"admin"` | 승인 전엔 null, 관리자가 세팅 |
| `isApproved` | bool | ✅ | `false` | 회원가입 직후 false, 관리자 승인 시 true |
| `isActive` | bool | ✅ | `true` | 관리자가 비활성 토글 가능 (soft-delete) |
| `createdAt` | ISO8601 string | ✅ | `"2026-04-17T10:30:45.123Z"` | 불변 (생성 후 덮어쓰기 금지) |

> **주의**: `driverId` 는 `AppUser` Dart 모델에는 있지만 **DB 에는 저장되지 않음**. 로그인 시 `/drivers` 에서 `linkedUserId == auth.uid` 조회로 동적으로 붙입니다.

예시 JSON:
```json
{
  "users": {
    "xyzAuthUid123": {
      "username": "floor2user",
      "displayName": "2층 담당자 김철수",
      "role": "floor2",
      "isApproved": true,
      "isActive": true,
      "createdAt": "2026-04-17T10:30:45.123Z"
    }
  }
}
```

인덱스: `["username", "isApproved", "role"]`

### 2.2 `/orders/{orderId}` — 주문

`lib/models/order.dart` 기반. 레포의 가장 핵심 컬렉션.

쓰는 주체:
- **floor2**: 신규 생성 + 본인 주문 수정
- **floor1 / admin**: 모든 필드 수정, 상태 변경, 기사 배차
- **driver**: 본인에게 배정된 주문의 `status` / `deliveryPhotoUrl` 만 수정 (후술: Rules 참고)

| 필드 | 타입 | 필수 | 예시 | 비고 |
|------|------|------|------|------|
| `chainName` | string | ✅ | `"우리꽃집"` | 체인명 |
| `productId` | string | ✅ | `"-NxyzProd001"` | `/products` 의 key |
| `productName` | string | ✅ | `"축하 화환"` | denormalized (조회 속도 위해 복제 저장) |
| `deliveryDatetime` | ISO8601 string | ✅ | `"2026-04-18T10:30:00.000Z"` | 배송 요청 일시 |
| `isImmediate` | bool | ✅ | `false` | true 면 "즉시배송" 표시 |
| `deliveryAddress` | string | ✅ | `"대구시 중구 동성로 123"` | — |
| `recipientName` | string | ✅ | `"홍길동"` | 받는 분 |
| `recipientPhone` | string | ✅ | `"010-1234-5678"` | 빈 문자열 허용 |
| `ribbonText` | string | ✅ | `"축하합니다"` | 빈 문자열 허용 |
| `occasionText` | string | ✅ | `"생일 축하"` | 빈 문자열 허용 |
| `status` | int | ✅ | `0` | 0~6 (§8 상태머신) |
| `assignedDriverId` | string nullable | — | `"-Ndriver001"` | `/drivers` 의 key ⚠️ (§3 Rules 주의) |
| `assignedDriverName` | string nullable | — | `"김기사"` | denormalized |
| `assignedAt` | ISO8601 string nullable | — | `"2026-04-17T14:22:00Z"` | 트랜잭션으로 배차 시각 기록 |
| `storePhotoUrl` | string nullable | — | Firebase Storage download URL | 매장사진 업로드 시 자동 갱신 |
| `deliveryPhotoUrl` | string nullable | — | Firebase Storage download URL | 배송완료 사진 업로드 시 자동 갱신 |
| `createdByUserId` | string | ✅ | `"xyzAuthUid123"` | auth.uid |
| `createdByName` | string | ✅ | `"2층 담당자 김철수"` | denormalized |
| `createdAt` | ISO8601 string | ✅ | `"2026-04-17T09:15:30Z"` | 불변 |
| `updatedAt` | ISO8601 string | ✅ | `"2026-04-17T14:22:00Z"` | 모든 write 시 `DateTime.now().toIso8601String()` 로 갱신 |

**파생(저장 안 됨) 필드**:
- `orderStatus` enum — `status` 코드에서 계산
- `timeRemaining` (잔여시간) — `deliveryDatetime - now` 계산
- `dayBadge` (당일/예약/과거) — `deliveryDatetime` 과 오늘 비교

예시 JSON:
```json
{
  "orders": {
    "-NxK8OrderId001": {
      "chainName": "우리꽃집",
      "productId": "-NxyzProd001",
      "productName": "축하 화환",
      "deliveryDatetime": "2026-04-18T10:30:00.000Z",
      "isImmediate": false,
      "deliveryAddress": "대구시 중구 동성로 123",
      "recipientName": "홍길동",
      "recipientPhone": "010-1234-5678",
      "ribbonText": "축하합니다",
      "occasionText": "생일 축하",
      "status": 3,
      "assignedDriverId": "-Ndriver001",
      "assignedDriverName": "김기사",
      "assignedAt": "2026-04-17T14:22:00.000Z",
      "storePhotoUrl": "https://firebasestorage.googleapis.com/.../store-photo.jpg",
      "deliveryPhotoUrl": null,
      "createdByUserId": "xyzAuthUid123",
      "createdByName": "2층 담당자 김철수",
      "createdAt": "2026-04-17T09:15:30.000Z",
      "updatedAt": "2026-04-17T14:22:00.000Z"
    }
  }
}
```

인덱스: `["createdAt", "assignedDriverId", "status", "deliveryDatetime", "createdByUserId"]`

### 2.3 `/products/{productId}` — 상품 카탈로그

`lib/models/product.dart` 기반. 쓰는 주체: **admin only**.

| 필드 | 타입 | 필수 | 예시 | 비고 |
|------|------|------|------|------|
| `name` | string | ✅ | `"축하 화환"` | — |
| `category` | string | ✅ | `"-Ncat001"` | `/categories` 의 key |
| `isActive` | bool | ✅ | `true` | false 면 신규 주문 폼에서 숨김 |
| `createdAt` | ISO8601 string | ✅ | — | — |

인덱스: `["createdAt", "category"]`

### 2.4 `/categories/{categoryId}` — 상품 카테고리

`lib/models/category.dart` 기반. 쓰는 주체: **admin only**.

| 필드 | 타입 | 필수 | 예시 | 비고 |
|------|------|------|------|------|
| `name` | string | ✅ | `"축하"` | — |
| `order` | int | ✅ | `1` | 정렬 순서 ⚠️ DB 키 이름은 `order`, Dart 필드명은 `sortOrder` (혼동 주의) |

인덱스: `["order"]`

### 2.5 `/drivers/{driverId}` — 기사 마스터

`lib/models/driver.dart` 기반. 쓰는 주체: **admin only** (현재 룰). 단 `fcmToken` 은 드라이버 앱이 자신의 토큰을 쓰려고 하는데 현재 룰이 이를 허용하지 않음 → **§3.4 결정 플래그**.

| 필드 | 타입 | 필수 | 예시 | 비고 |
|------|------|------|------|------|
| `name` | string | ✅ | `"김기사"` | — |
| `phone` | string | ✅ | `"010-9876-5432"` | — |
| `linkedUserId` | string nullable | — | `"authUidForDriver"` | `/users` 에서 role=driver 인 사용자의 auth.uid |
| `isActive` | bool | ✅ | `true` | 비활성화 시 배차 리스트에서 제외 |
| `fcmToken` | string nullable | — | FCM 토큰 | 푸시 알림용 |
| `createdAt` | ISO8601 string | ✅ | — | — |

인덱스: `["linkedUserId", "isActive"]`

> **핵심 관계**: `Driver.id` (푸시 키, 예: `-Ndriver001`) 과 `Driver.linkedUserId` (auth.uid, 예: `"authUidForDriver"`) 는 **서로 다른 값** 입니다. 주문의 `assignedDriverId` 는 Driver 레코드 ID 를 저장합니다 (auth.uid 아님). §3.4 에서 이로 인한 룰 이슈 설명.

### 2.6 `/messages/{messageId}` — 채팅

`lib/models/chat_message.dart` 기반. 쓰는 주체: **모든 인증 사용자**.

| 필드 | 타입 | 필수 | 예시 | 비고 |
|------|------|------|------|------|
| `sender` | string | ✅ | `"xyzAuthUid123"` | auth.uid |
| `name` | string | ✅ | `"2층 담당자 김철수"` | 표시 이름 |
| `role` | string | ✅ | `"floor2"` | 채팅 UI 가 아바타/컬러 결정에 사용 |
| `text` | string | ✅ | `"주문 확인 부탁드려요"` | 메시지 본문 |
| `ts` | ISO8601 string | ✅ | `"2026-04-17T14:30:00.000Z"` | 메시지 시각 |
| `checkedBy` | List OR Map of CheckRecord | — | — | 읽음 확인 기록 (아래) |

`CheckRecord` 구조:
```json
{
  "userId": "uid...",
  "name": "표시 이름",
  "role": "floor1",
  "ts": "2026-04-17T14:31:05.000Z"
}
```

⚠️ **중요**: `checkedBy` 는 RTDB 에 List 로 저장될 수도 있고 Map 으로 저장될 수도 있습니다 (RTDB 의 숫자 키 자동 변환 때문). Flutter 는 양쪽 다 파싱하도록 구현됨 (`chat_message.dart` 49~67 라인). JS 도 동일하게 `Array.isArray(x) ? x : Object.values(x)` 패턴으로 방어 처리하세요.

인덱스: `["ts"]`

### 2.7 `/driverStatus/{driverId}` — 기사 실시간 상태

`lib/models/driver_status.dart` 기반. 쓰는 주체: **해당 기사 본인** (Driver 앱) 또는 **admin**.

| 필드 | 타입 | 필수 | 예시 | 비고 |
|------|------|------|------|------|
| `badge` | string | ✅ | `"waiting"` | `"waiting"` \| `"delivering"` \| `"assigned"` \| `"returning"` \| `"off"` (사용자화 값) |
| `lat` | number | ✅ | `35.8293` | 현재 위도 |
| `lng` | number | ✅ | `128.5453` | 현재 경도 |
| `lastUpdate` | ISO8601 string | ✅ | `"2026-04-17T14:30:15Z"` | 마지막 업데이트 시각 |
| `resetTs` | ISO8601 string nullable | — | — | 회사 복귀 시각 (이 시각 이후 완료 주문만 현재 카운트) |
| `offduty` | bool | ✅ | `false` | 휴무 플래그 |

> 키 `{driverId}` 는 Driver 레코드 ID (예: `-Ndriver001`) 입니다. auth.uid 아님.

⚠️ **룰 오타 의혹**: `database.rules.json` 의 `driverStatus` 엔 `.indexOn: ["ts"]` 가 있는데 스키마에는 `ts` 필드가 없습니다. `lastUpdate` 또는 인덱스 제거가 맞을 듯. §3.4 참고.

### 2.8 `/auditLog/{logId}` — 미구현

룰에만 정의되어 있고 Flutter 구현 없음. JS 측에서 감사 로그를 도입할지 여부를 결정하세요. 안 쓸 거면 룰에서 제거해도 됩니다.

---

## § 3. Security Rules

### 3.1 `database.rules.json` 전문

```json
{
  "rules": {
    ".read": "auth != null",

    "users": {
      ".read": "auth != null",
      ".indexOn": ["username", "isApproved", "role"],
      "$uid": {
        ".write": "auth.uid === $uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".validate": "newData.hasChildren(['username', 'displayName', 'isApproved'])"
      }
    },

    "products": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'",
      ".indexOn": ["createdAt", "category"]
    },

    "categories": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'",
      ".indexOn": ["order"]
    },

    "drivers": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'",
      ".indexOn": ["linkedUserId", "isActive"]
    },

    "orders": {
      ".read": "auth != null",
      ".indexOn": ["createdAt", "assignedDriverId", "status", "deliveryDatetime", "createdByUserId"],
      "$orderId": {
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'floor2' || root.child('users').child(auth.uid).child('role').val() === 'floor1' || root.child('users').child(auth.uid).child('role').val() === 'admin' || (root.child('users').child(auth.uid).child('role').val() === 'driver' && data.child('assignedDriverId').val() === auth.uid))",
        ".validate": "newData.hasChildren(['chainName', 'productId', 'deliveryAddress', 'status', 'createdAt'])"
      }
    },

    "messages": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["ts"]
    },

    "driverStatus": {
      ".read": "auth != null",
      "$driverId": {
        ".write": "auth != null && (root.child('drivers').child($driverId).child('linkedUserId').val() === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin')"
      }
    },

    "auditLog": {
      ".read": "root.child('users').child(auth.uid).child('role').val() === 'admin'",
      ".write": "auth != null"
    }
  }
}
```

### 3.2 경로별 요약표

| 경로 | Read | Write | Validate |
|------|------|-------|----------|
| (root) | auth != null | — | — |
| `/users/{uid}` | auth | 본인 OR admin | `username`, `displayName`, `isApproved` 필수 |
| `/products` | auth | admin only | — |
| `/categories` | auth | admin only | — |
| `/drivers` | auth | admin only | — |
| `/orders/{orderId}` | auth | floor2 / floor1 / admin 은 전부 허용, driver 는 `assignedDriverId == auth.uid` 인 건만 | `chainName`, `productId`, `deliveryAddress`, `status`, `createdAt` 필수 |
| `/messages` | auth | 모든 auth | — |
| `/driverStatus/{driverId}` | auth | `drivers[driverId].linkedUserId == auth.uid` OR admin | — |
| `/auditLog` | admin only | 모든 auth | — |

### 3.3 배포 방법

로컬 `database.rules.json` 을 수정한 뒤:

```bash
firebase deploy --only database
```

⚠️ **잊기 쉬운 함정**: 콘솔에서 룰을 직접 편집하면 로컬 파일과 싱크가 깨집니다. 항상 파일 → deploy 경로로 관리하세요.

### 3.4 ⚠️ 해결해야 할 플래그 3건

JS 이관을 계기로 아래 3건을 정리하는 것을 권장합니다.

#### (1) `orders/$orderId` 의 driver write 룰 — 현재 데이터 저장 방식과 모순

현재 룰:
```
driver 인 경우 data.child('assignedDriverId').val() === auth.uid 일 때만 write 허용
```

현재 데이터:
```
assignedDriverId 에는 Driver 레코드 ID (예: "-Ndriver001") 가 저장됨.
auth.uid 는 Firebase Auth 의 UID (예: "xyzAuthUid123") — 완전히 다른 값.
```

따라서 **현재 룰 하에서 드라이버가 주문에 쓰기는 사실상 불가능**합니다. Flutter 가 어떻게 동작하고 있는지:
- 드라이버가 배송완료 사진을 올리면 → Storage 업로드 후 `orders/{id}` 에 update → **룰에서 거절되어야 하지만**, 지금은 `_AuthUid != driverId` 이므로 위 OR 분기가 모두 false → **rejected**

**해결안**:
```json
"$orderId": {
  ".write": "auth != null && (
    role == 'floor2' || role == 'floor1' || role == 'admin'
    || (role == 'driver' && root.child('drivers').child(data.child('assignedDriverId').val()).child('linkedUserId').val() === auth.uid)
  )"
}
```
(Driver 레코드를 한 번 더 lookup 해서 `linkedUserId == auth.uid` 인지 확인)

#### (2) `/drivers` 의 write 룰 — driver 가 자기 `fcmToken` 못 씀

현재 룰: `/drivers` write 는 admin 전용. 하지만 드라이버 앱이 자기 FCM 토큰을 등록하려면 `/drivers/{driverId}/fcmToken` 에 쓰기가 필요.

**해결안 두 가지**:
- (a) `/drivers/$driverId/fcmToken` 전용 세부 룰: 본인 `linkedUserId == auth.uid` 면 허용
- (b) 토큰을 `/driverTokens/{driverId}` 같은 별도 경로로 분리

#### (3) `/driverStatus` 의 `.indexOn: ["ts"]` — 필드명 불일치

스키마에는 `lastUpdate` 만 있고 `ts` 는 없습니다. 인덱스가 실제로 쓰이지 않고 있거나, 과거에 스키마를 바꾼 잔재.

**해결안**: 인덱스를 제거하거나 `"lastUpdate"` 로 교체.

#### (4) `/auditLog` — 도입 여부 결정

미구현. 도입하려면 누가 언제 무엇을 썼는지 기록하는 규칙을 정하고, 안 쓸 거면 룰에서 제거.

---

## § 4. Authentication

### 4.1 Username → Email 합성

Firebase Auth 는 이메일 기반이라 username 을 가상 이메일로 변환합니다.

```js
// js/auth.js
const EMAIL_DOMAIN = "maydaegu.internal";
function toEmail(username) {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}
```

(Flutter: `AppUser.toEmail()` / `AppUser.emailDomain = 'maydaegu.internal'`)

### 4.2 회원가입 플로우

```
1. 사용자 → username, displayName, password 입력
2. createUserWithEmailAndPassword(toEmail(username), password)
3. /users/{uid} 에 기본 프로필 저장:
      username (lowercase trim)
      displayName (trim)
      isApproved: false
      isActive: true
      createdAt: new Date().toISOString()
      ※ role 은 쓰지 않음 (관리자가 나중에 부여)
4. 즉시 signOut() — 아직 승인되지 않았으므로 세션 유지 금지
5. 사용자에게 "승인 대기 중" 메시지 표시
```

Flutter 구현: `lib/services/auth_service.dart` 의 `signUp()` 메서드 28~57 라인.

### 4.3 로그인 플로우

```
1. username, password 입력
2. signInWithEmailAndPassword(toEmail(username), password)
3. /users/{uid} 조회 (반드시 필요)
4. 아래 검증들을 순서대로 수행, 하나라도 실패하면 signOut() + 에러 throw:
   ① 프로필이 DB 에 존재하는가
   ② isApproved === true
   ③ isActive === true
   ④ role 이 null 이 아님
5. driver 인 경우, /drivers 에서 linkedUserId == auth.uid 인 레코드 조회해서
   driverId 를 메모리에 붙여둠 (이후 주문 쿼리에 사용)
6. 역할별 홈 화면으로 이동
```

Flutter 구현: `lib/services/auth_service.dart` 의 `signIn()` 60~107 라인.

### 4.4 관리자 승인 조작

| 메서드 | 동작 | 해당 필드 |
|--------|------|----------|
| `approveUser(uid)` | 승인 | `users/{uid}/isApproved = true` |
| `updateUserRole(uid, role)` | 역할 부여 | `users/{uid}/role = 'floor1'` 등 |
| `toggleUserActive(uid, isActive)` | 활성/비활성 | `users/{uid}/isActive = false` |

### 4.5 비밀번호 변경

재인증 필요:
```js
const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
await user.reauthenticateWithCredential(cred);
await user.updatePassword(newPassword);
```

### 4.6 플랫폼 가드

Flutter 라우터는 아래 가드를 실행합니다 (`lib/router/app_router.dart` 78~85):
- 웹 + role=driver → 강제 signOut + `?error=driver_use_app` 로 리다이렉트 ("기사 계정은 앱으로 로그인")
- 모바일 + role≠driver → 강제 signOut + `?error=mobile_driver_only` ("모바일은 기사 전용")

JS 웹에서도 동등한 가드를 권장 (driver 역할 로그인 시 "앱을 다운로드하세요" 메시지 노출).

---

## § 5. Firebase Storage

### 5.1 현재 사용되는 경로

`lib/services/storage_service.dart` 기반.

| 용도 | 경로 | 쓰는 주체 |
|------|------|----------|
| 매장사진 | `orders/{orderId}/store-photo.jpg` | floor1 / floor2 / admin (웹) |
| 배송완료 사진 | `orders/{orderId}/delivery-photo.jpg` | driver (앱) |

### 5.2 업로드 → URL → DB 링크 패턴

```js
// 웹에서 매장사진 업로드 예시
async function uploadStorePhoto(orderId, file) {
  const ref = FirebaseStorage.ref(`orders/${orderId}/store-photo.jpg`);
  const snapshot = await ref.put(file, { contentType: 'image/jpeg' });
  const url = await snapshot.ref.getDownloadURL();
  await FirebaseDB.ref(`orders/${orderId}`).update({
    storePhotoUrl: url,
    updatedAt: new Date().toISOString(),
  });
  return url;
}
```

드라이버 앱 (Flutter) 의 배송완료 사진 업로드는 상태변경까지 포함:
```dart
// lib/services/storage_service.dart 의 uploadDeliveryPhoto
await _db.ref('orders/$orderId').update({
  'status': OrderStatus.completed.code,  // 4
  'deliveryPhotoUrl': url,
  'updatedAt': DateTime.now().toIso8601String(),
});
```

### 5.3 제약 조건

| 항목 | 값 |
|------|-----|
| 최대 파일 크기 | 5 MB |
| 허용 MIME | `image/jpeg`, `image/jpg`, `image/png` |
| 권장 해상도 | maxWidth 1600 |
| 권장 품질 | JPEG 70% |

Flutter 는 `image_picker` 로 찍고 `imageQuality: 70, maxWidth: 1600` 으로 자동 리사이즈. JS 는 `<canvas>` 로 직접 리사이즈 하거나, 브라우저가 업로드한 원본을 그대로 넣어도 됩니다 (용량만 체크).

### 5.4 ⚠️ 네이밍 규약 결정 필요

- **현재 구현**: 고정 파일명 (`store-photo.jpg`, `delivery-photo.jpg`) — 재업로드 시 덮어쓰기. 이력 사라짐.
- **가이드 권장** (`order-card-deep-guide.md` §6, §11.1): `store_{timestamp}.jpg` 같은 타임스탬프 포함 — 이력 보존 but 추후 cleanup 필요.

**결정 필요**: 양쪽 구현이 동일 규약을 써야 서로가 올린 파일을 읽을 수 있으므로, Flutter 와 JS 중 어느 쪽에 맞출지 사전 합의. **기본 방침은 현재 Flutter 구현(고정 파일명)에 맞추는 것**.

### 5.5 Storage Rules

⚠️ 현재 이 레포에 `storage.rules` 파일이 **없음**. Firebase 기본 룰 (인증된 사용자만 read/write) 로 추정됩니다. 운영 전에 명시적 룰을 배포하는 것을 권장:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /orders/{orderId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                 && request.resource.size < 5 * 1024 * 1024
                 && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## § 6. APP ↔ WEB 동기화 패턴 (핵심)

메이대구 시스템의 모든 크로스 플랫폼 동기화는 **Storage 업로드 → RTDB 에 URL 저장 → 상대방이 RTDB 를 listen** 이라는 단일 패턴으로 동작합니다.

### 6.1 대표 시나리오: 배송완료 사진

```
[DRIVER APP / Flutter]          [FIREBASE]                [WEB / JS]
     │                              │                         │
  사진 촬영 (image_picker)          │                         │
     │                              │                         │
  Storage.ref(                      │                         │
    'orders/{id}/delivery-photo.jpg'│                         │
  ).putFile(file) ─────────────→ Storage                      │
     │                              │                         │
     │ ←──────── downloadURL        │                         │
     │                              │                         │
  RTDB.ref('orders/{id}').update({  │                         │
    status: 4,            ──────→ RTDB                         │
    deliveryPhotoUrl: url,          │                         │
    updatedAt: now                  │                         │
  })                                │                         │
                                    │ ── onValue event ────→  │
                                    │                    ref('orders').on('value', ...)
                                    │                    이 콜백이 자동 실행됨
                                    │                    → 화면에 <img src={url}>
                                    │                    → 상태 뱃지 "배송완료" 갱신
```

### 6.2 웹 측 단일 구독 포인트

```js
// js/store.js 에서 앱 시작 시 1회 등록
FirebaseDB.ref('orders').on('value', (snap) => {
  const data = snap.val() || {};
  const orders = Object.entries(data).map(([id, v]) => ({ id, ...v }));
  store.setOrders(orders); // Vuex 유사 스토어 갱신 → UI 자동 리렌더
});
```

여기서 `deliveryPhotoUrl`, `storePhotoUrl`, `status`, `assignedDriverId` 등 **모든 필드 변경이 이 하나의 콜백으로 도착**합니다. 추가 API 호출 필요 없음.

### 6.3 같은 패턴이 적용되는 다른 케이스

| 케이스 | Writer | Listener | 동기화되는 필드 |
|--------|--------|----------|----------------|
| 매장사진 업로드 | floor1/2 (웹) | 드라이버 앱 | `storePhotoUrl` |
| 주문 생성 | floor2 (웹) | floor1 / 드라이버 앱 | 새 `/orders/{id}` 노드 전체 |
| 배차 결정 | floor1/admin (웹) | 드라이버 앱 | `assignedDriverId`, `assignedDriverName`, `assignedAt`, `status` |
| 상태 전환 | floor1 (웹) | floor2 (웹), 드라이버 앱 | `status`, `updatedAt` |
| 채팅 메시지 | 모든 역할 | 모든 역할 | `/messages` 새 노드 추가 |
| 기사 위치 | 드라이버 앱 | floor1/admin (웹) | `/driverStatus/{driverId}` 의 `lat`, `lng`, `badge`, `lastUpdate` |
| 읽음 확인 | 메시지 수신자 | 발신자 | `/messages/{id}/checkedBy` 배열에 append |

### 6.4 실패 시 시나리오

| 실패 지점 | 결과 | 대응 |
|----------|------|------|
| Storage 업로드 실패 | DB 미변경, 사용자에게 재시도 안내 | 업로드 → URL 획득까지 원자 처리 |
| Storage 성공, DB update 실패 | **고아 파일** (Storage 에는 있지만 DB 링크 없음) | 후속 과제: Cloud Function cron 으로 1일 지난 고아 정리 |
| 네트워크 끊김 중 write | Firebase SDK 가 로컬 큐잉 후 자동 재시도 | SDK 기본 동작. 별도 처리 불필요 |
| 트랜잭션 충돌 (배차 동시 클릭) | 한 쪽은 `Transaction.abort`, 실패 토스트 | `assignDriver` 가 이미 트랜잭션 처리 (§8 참고) |

---

## § 7. 역할별 읽기·쓰기 매트릭스

`R` = read, `W` = write, `—` = 해당 없음. 조건이 있으면 괄호로 표시.

| 경로 | floor2 | floor1 | admin | driver |
|------|--------|--------|-------|--------|
| `/users/{uid}` | R (전체), W (본인) | R (전체), W (본인) | R·W (전체) | R (본인), W (본인) |
| `/orders` 생성 | W | W | W | — |
| `/orders/{id}` read | R | R | R | R (단 `assignedDriverId` 가 본인일 때만 의미있는 쿼리) |
| `/orders/{id}` write | W (본인 생성 건) | W (전부) | W (전부) | W (본인 배정 건 `status`·`deliveryPhotoUrl` 만) ⚠️ 룰 이슈 §3.4 |
| `/products` | R | R | R·W | R |
| `/categories` | R | R | R·W | R |
| `/drivers` | R | R | R·W | R (단 본인 레코드 위주) |
| `/messages` | R·W | R·W | R·W | R·W |
| `/driverStatus/{myDriverId}` | R | R | R·W | W (본인만), R (전체) |
| `/auditLog` | — | — | R | — |

> ⚠️ **UI 레벨 가드** 와 **룰 레벨 가드** 둘 다 필요합니다. UI 만으로는 개발자 콘솔에서 직접 조작 가능.

---

## § 8. 주문 라이프사이클 (상태 머신)

### 8.1 상태 코드

`lib/core/constants/order_status.dart` 기반. **이 코드값과 라벨은 절대 변경 금지** (웹/앱 공통 규약).

| code | Dart enum | 한국어 라벨 | 의미 |
|------|-----------|-----------|------|
| 0 | `received` | 주문접수 | floor2 가 생성한 직후 |
| 1 | `confirmed` | 확인완료 | floor1 이 접수 확인 |
| 2 | `producing` | 제작중 | floor1 이 제작 시작 |
| 3 | `delivering` | 배송중 | 기사에게 배차 + 배송 출발 |
| 4 | `completed` | 배송완료 | 드라이버가 완료사진 업로드 |
| 5 | `cancelledA` | 주문취소 | 고객 요청 취소 |
| 6 | `cancelledB` | 반품 | 수령자 반품 |

### 8.2 유효한 상태 전이

```
received (0)   → confirmed (1)   → producing (2)   → delivering (3)   → completed (4)
                                                                        (terminal)
     ↓                 ↓                 ↓
cancelledA (5) or cancelledB (6)  ← 어느 단계에서든 취소 가능
(terminal)        (terminal)
```

구체적으로:
| From | 가능한 To |
|------|----------|
| received | confirmed, cancelledA, cancelledB |
| confirmed | producing, cancelledA, cancelledB |
| producing | delivering, cancelledA, cancelledB |
| delivering | completed |
| completed | — (terminal) |
| cancelledA | — (terminal) |
| cancelledB | — (terminal) |

### 8.3 각 전이에서 누가 쓰고, 어떤 필드가 바뀌나

| 전이 | Writer | 주요 필드 변화 |
|------|--------|---------------|
| 생성 (→0) | floor2 | 모든 초기 필드 + `status=0`, `createdByUserId`, `createdByName`, `createdAt`, `updatedAt`, 나머지 null |
| 접수확인 (0→1) | floor1 / admin | `status=1`, `updatedAt` |
| 제작 시작 (1→2) | floor1 / admin | `status=2`, `updatedAt` |
| 기사 배차 | floor1 / admin | 트랜잭션 — `assignedDriverId`, `assignedDriverName`, `assignedAt`, `updatedAt` (상태는 별도 전환 필요) |
| 배송 출발 (2→3) | floor1 / admin (권장) | `status=3`, `updatedAt` |
| 배송완료 (3→4) | **driver** | `status=4`, `deliveryPhotoUrl`, `updatedAt` |
| 취소 (→5/6) | floor1 / admin | `status=5 or 6`, `updatedAt` |

### 8.4 배차 트랜잭션 (중복 방지)

`lib/services/order_service.dart` 의 `assignDriver`:

```dart
final result = await ref.runTransaction((currentData) {
  if (currentData == null) return Transaction.abort();
  final current = Map<String, dynamic>.from(currentData as Map);

  // 이미 다른 기사에게 배정되었으면 abort
  if (current['assignedDriverId'] != null &&
      current['assignedDriverId'].toString().isNotEmpty) {
    return Transaction.abort();
  }

  final now = DateTime.now().toIso8601String();
  current['assignedDriverId'] = driverId;
  current['assignedDriverName'] = driverName;
  current['assignedAt'] = now;
  current['updatedAt'] = now;
  return Transaction.success(current);
});
return result.committed;  // false 면 UI 에서 "이미 배정됨" 토스트
```

JS 등가 구현:

```js
async function assignDriver(orderId, driverId, driverName) {
  const ref = FirebaseDB.ref(`orders/${orderId}`);
  const result = await ref.transaction((current) => {
    if (current == null) return;  // abort
    if (current.assignedDriverId) return;  // 이미 배정됨 — abort

    const now = new Date().toISOString();
    current.assignedDriverId = driverId;
    current.assignedDriverName = driverName;
    current.assignedAt = now;
    current.updatedAt = now;
    return current;
  });
  return result.committed;
}
```

### 8.5 타임스탬프 규약

| 필드 | 언제 씀 | 방법 |
|------|---------|------|
| `createdAt` | 생성 시 1회만 | `new Date().toISOString()` (UTC 문자열) |
| `updatedAt` | **모든** write 마다 갱신 | 동일 |
| `assignedAt` | 배차 트랜잭션 내에서만, 배차 해제 시 null | 동일 |
| `deliveryDatetime` | 사용자 입력 기반 (미래 시각) | Date picker → ISO 문자열 |

> 서버 타임스탬프(`firebase.database.ServerValue.TIMESTAMP`)는 **사용하지 않습니다**. 전역 ISO8601 UTC 문자열로 통일.

---

## § 9. JS 측 구현 체크리스트

웹 (1층/2층/관리자) 기능을 Vanilla JS 로 만들 때 다음을 순서대로 체크:

### 기반 구축
- [ ] `js/firebase-config.js` 에 § 1.1 의 `firebaseConfig` 복붙
- [ ] `index.html` 에 Firebase Compat SDK 4개 (`app`, `auth`, `database`, `storage`) CDN 로드
- [ ] 앱 진입점에서 `onAuthStateChanged` 한 번 기다린 뒤 렌더 (§ 1.3 패턴)

### Auth
- [ ] `js/auth.js` 에 `toEmail(username)` 유틸 — `@maydaegu.internal` 도메인
- [ ] 회원가입: `createUserWithEmailAndPassword` → `/users/{uid}` 쓰기 → 즉시 `signOut()`
- [ ] 로그인: 4단계 검증 (`isApproved` / `isActive` / `role != null`) — 실패 시 `signOut` + 사용자 에러 노출
- [ ] 로그인 후 role=driver 면 "이 계정은 모바일 앱 전용입니다" 안내 후 로그아웃
- [ ] 비밀번호 변경: `reauthenticateWithCredential` 우선 수행

### 데이터 레이어 (js/store.js, js/api.js)
- [ ] `/orders` 단일 `on('value')` 구독 → 전역 스토어에 전체 리스트 유지
- [ ] `/products`, `/categories`, `/drivers` 각각 `on('value')` 구독 (카탈로그 성격이므로 자주 바뀌지 않음)
- [ ] `/messages` 는 최근 N개만 가져오도록 `.limitToLast(100)` + `on('child_added')` 조합
- [ ] `/driverStatus` 실시간 구독 (floor1/admin 기사 현황 패널용)

### 주문 CRUD
- [ ] 생성: § 2.2 의 모든 필드 포함, `status=0`, null 필드 명시적으로 null 저장 (undefined 금지)
- [ ] 상태 변경: `{ status, updatedAt }` 만 부분 update
- [ ] 배차: **반드시 트랜잭션** (§ 8.4)
- [ ] 삭제: 직접 삭제 대신 soft-delete (`status=5` 취소) 권장
- [ ] 필터 쿼리: `.orderByChild('deliveryDatetime').startAt(...)` 같은 인덱스 활용 쿼리

### 사진 업로드
- [ ] 매장사진: `orders/{id}/store-photo.jpg` 경로 고정, 5MB / JPEG+PNG 검증
- [ ] 업로드 성공 후 `orders/{id}` 에 `{ storePhotoUrl, updatedAt }` update — 2단계 원자 처리
- [ ] 업로드 실패 시 toast, DB 변경 없음

### 관리자 UI
- [ ] 사용자 승인: `users/{uid}` 의 `isApproved`, `role` 필드 업데이트
- [ ] 상품/카테고리/기사: `/products`, `/categories`, `/drivers` CRUD
- [ ] 룰이 admin only 이므로 UI 만 가드해도 DB 레벨에서 자동 거절

### 채팅
- [ ] 메시지 전송: `/messages` 에 `push()` — `{ sender, name, role, text, ts, checkedBy: [] }`
- [ ] 읽음 확인: 기존 `checkedBy` 배열을 가져와 본인 CheckRecord 추가 후 전체 배열 update
- [ ] `checkedBy` 가 List / Map 두 형태 둘 다 올 수 있음 — 파싱 시 방어 처리

### 룰 / 배포
- [ ] 현재 `database.rules.json` 전문 확인 (§ 3.1)
- [ ] § 3.4 의 4개 플래그 중 어느 것을 수정할지 Flutter 담당자와 합의
- [ ] `firebase deploy --only database` 로 룰 배포
- [ ] Firebase Console → Storage 탭에서 Storage Rules 상태 확인, § 5.5 참고 룰 배포

### QA / 엣지 케이스
- [ ] 새로고침 시 로그인 플래시 없음 (§ 1.3)
- [ ] 드라이버 계정으로 웹 로그인 시 차단 메시지
- [ ] 미승인 계정 로그인 시도 시 명확한 에러 문구
- [ ] 배차 동시 클릭 시 한 쪽만 성공, 다른 쪽은 "이미 배정됨" 토스트
- [ ] 네트워크 끊김 중 업로드 시도 시 재시도 안내
- [ ] 모든 타임스탬프가 ISO8601 UTC 문자열인지 스팟체크

---

## 부록 A. 참고 파일 (SSOT)

본 문서는 아래 파일들을 인용·요약한 것입니다. 불일치 발견 시 이 파일들이 진실.

| 주제 | 파일 |
|------|------|
| Firebase config | `lib/firebase_options.dart` |
| DB 경로 상수 | `lib/core/constants/firebase_paths.dart` |
| Users 스키마 | `lib/models/app_user.dart` |
| Orders 스키마 | `lib/models/order.dart` |
| Drivers 스키마 | `lib/models/driver.dart` |
| DriverStatus 스키마 | `lib/models/driver_status.dart` |
| Chat 스키마 | `lib/models/chat_message.dart` |
| Product 스키마 | `lib/models/product.dart` |
| Category 스키마 | `lib/models/category.dart` |
| 상태 머신 | `lib/core/constants/order_status.dart` |
| Auth 흐름 | `lib/services/auth_service.dart` |
| Order CRUD / 트랜잭션 | `lib/services/order_service.dart` |
| Storage 업로드 | `lib/services/storage_service.dart` |
| DriverStatus 업데이트 | `lib/services/driver_status_service.dart` |
| 플랫폼 가드 | `lib/router/app_router.dart` (redirect 함수, 78~85 라인) |
| 룰 원본 | `database.rules.json` |

## 부록 B. 변경 이력

이 문서는 Flutter 레포 `mayflower_flutter/` 가 현재 Firebase 의 실질적 구현체인 시점을 기준으로 작성되었습니다. Flutter 가 드라이버 전용으로 축소된 이후에도 이 문서는 유지됩니다 (서비스 로직과 스키마는 축소판에서도 그대로 존재).

스키마/룰이 변경될 때는 **반드시 이 문서를 먼저 업데이트** 한 뒤 코드 반영하는 순서를 유지하세요.

---

# § 10. JS 웹 ↔ Firebase 연동 구현 상태 (2026-04-17)

> **Claude Code 세션 이관용 섹션**. 바닐라 JS 웹을 Firebase(RTDB + Auth + Storage) 에 연결하는 작업을 Phase 1~5 로 나누어 진행했으며, 모든 Phase 가 완료된 상태. 타 로컬/세션에서 작업을 이어갈 때 이 섹션을 먼저 참조하세요.

## 10.1 Phase 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| **1** | SDK 로드 + Firebase 초기화 + 룰·스토리지 배포 파일 | ✅ 완료 + 배포됨 |
| **2** | Auth 이관 (Firebase Email/Password + 승인 플로우) | ✅ 완료 |
| **3** | Data 이관 (localStorage → RTDB 구독·쓰기·트랜잭션) | ✅ 완료 |
| **4** | 사진 업로드 (Firebase Storage, 고정 파일명 덮어쓰기) | ✅ 완료 |
| **5** | DeliveryPanel 에서 `/driverStatus` 구독 | ✅ 완료 |

## 10.2 파일 변경 목록

### 신규 (Phase 1 배포 산출물)
| 파일 | 용도 |
|------|------|
| `database.rules.json` | RTDB 룰. **§3.4 (1) driver-lookup 해결안 반영** — `orders/$orderId` 의 driver write 분기가 Driver 레코드의 `linkedUserId` 를 lookup 해서 auth.uid 와 비교함. `/driverStatus` indexOn 오타 `"ts"` → `"lastUpdate"` 수정 포함 |
| `storage.rules` | Storage 룰. `orders/{orderId}/{fileName}` 에 대해 5MB + `image/*` MIME 가드 |
| `firebase.json` | `database` + `storage` 배포 매니페스트 |
| `.firebaserc` | `default: mayflower-5c9dd` 바인딩 |

**배포 완료됨** — `firebase deploy --only database,storage` 성공 (2026-04-17).
재배포: `firebase deploy --only database,storage`

### 수정 (Phase 1~5)
| 파일 | 핵심 변경 |
|------|----------|
| `js/firebase-config.js` | `FirebaseDB` + `FirebaseAuth` + `FirebaseStorage` 전역 노출 |
| `index.html` | 4개 Firebase SDK CDN 로드 + `firebase-config.js` + `Auth.waitForReady(3000)` 기반 자동 라우팅. 스크립트 태그에 `?v=4` 캐시 버스터 |
| `app.html` | Firebase Auth/Storage SDK 추가 로드. Auth 복원 대기 후 AppShell 부트, 드라이버 접근 시 자동 로그아웃 + `?error=driver_only` 리다이렉트. `Store.startSubscriptions()` + `whenReady()` + `onUpdate` 를 통한 라이브 리렌더. `👥 사용자 승인` 네비 추가. `DeliveryPanel._ensureDriverStatusSubscription()` 으로 `/driverStatus` 구독 |
| `js/auth.js` | **완전 재작성** — Firebase Auth 래퍼. `toEmail()`, `waitForReady(timeoutMs)`, `login/register/logout`, 4단계 세션 검증, driver 웹 차단, 첫 사용자 자동 `admin+isApproved` 부트스트랩, `changePassword(current, new)` with 재인증 |
| `js/store.js` | **완전 재작성** — RTDB 투영 레이어. `/users`, `/orders`, `/products`, `/drivers`, `/categories` 를 `on('value')` 구독하여 메모리 캐시. 동기 API 유지 (뷰 호환). `Store.startSubscriptions()` · `Store.whenReady(timeout)` · `Store.onUpdate(key, fn)` 이벤트 버스 |
| `js/api.js` | **완전 재작성** — RTDB writes + Storage uploads. 모든 CRUD 가 `FirebaseDB.ref(path).set/update/push/transaction`. 배차는 **트랜잭션** (중복 배차 차단). `approveUser/updateUser/toggleUserActive`, `createCategory/renameCategory/deleteCategory` 신규. 사진 업로드는 `orders/{orderId}/store-photo.jpg` / `delivery-photo.jpg` 고정 경로 (덮어쓰기) |
| `js/views/login.js` | 역할 선택 필드 제거 (관리자 승인 시 부여). 가입 직후 `signOut()` + "승인 대기" 안내. `?error=...` 쿼리 파싱 (driver_only / unauth / not_approved) |
| `js/views/admin.js` | **사용자 승인 UI 신규** (`showUsers`) — 역할 드롭다운 + 승인/역할변경/활성토글. 기사 테이블에 **🔗 계정 연결** 모달 — 승인된 driver-role 사용자 드롭다운으로 `linkedUserId` 연결. `passwordHash` / `createUser` 직접 호출 전량 제거. 카테고리 CRUD 가 `Store.*` → `Api.*` 경유 |
| `js/views/floor1.js` | `data-id` 파싱에서 `+` 제거 (string ID 유지). 사진 업로드 호출부에 `orderId` 전달 |
| `js/views/floor2.js` | `+btn.dataset.id` → `btn.dataset.id`, `+productId.value` → `productId.value` |
| `js/views/driver.js` | 상동 |

### 변경 없음
- `js/chat.js` — 이미 Firebase RTDB `/messages` 사용 중, 정상 작동
- `js/ui.js`, `js/router.js` — UI 유틸/라우터 (Firebase 무관)
- `css/*`, `assets/*` — 스타일/정적 리소스

## 10.3 기능 매트릭스 (현재 상태)

| 기능 | 구현체 | 저장소 |
|------|-------|-------|
| 로그인/로그아웃 | Firebase Auth (Email/Password) | `auth.users` |
| 회원가입 + 승인 | `Auth.register` + 관리자 `Api.approveUser` | `/users/{uid}` |
| 첫 관리자 부트스트랩 | 사용자 테이블 비어있을 때 자동 `admin+isApproved` | `/users` |
| 드라이버 웹 차단 | 로그인 성공 직후 role 검사 → `signOut` + redirect | — |
| 세션 복원 | `Auth.waitForReady(3000)` — onAuthStateChanged 1회 대기 | — |
| 주문 CRUD | `Api.*` → RTDB `.update/.push` | `/orders` |
| 주문 필터·검색 | 뷰 내 `Floor1View._filterState` → Store 캐시 필터 | 메모리 |
| 배차 (중복 방지) | `Api.assignDriver` → RTDB 트랜잭션 | `/orders/{id}` |
| 벌크 배차 | 순차 루프 + `_openAssignModal([ids])` | — |
| 상태 전환 | `Api.updateOrderStatus(id, status)` | `/orders/{id}/status` |
| 사진 업로드 | `Api.upload*Photo(file, orderId)` → Storage 업로드 후 DB 링크 | `orders/{id}/store-photo.jpg` / `delivery-photo.jpg` |
| 상품 관리 | admin 전용, RTDB `/products` | `/products` |
| 카테고리 관리 | admin 전용, `{name, order}` 객체 스키마 | `/categories/{id}` |
| 기사 관리 | admin 전용. `linkedUserId` 를 승인된 user 에서 선택 | `/drivers` |
| 사용자 승인 | admin 전용, 역할 부여 + 활성 토글 | `/users/{uid}` |
| 채팅 | Chat 모듈, `/messages` 기존 구현 유지 | `/messages` |
| 기사 현황 패널 | DeliveryPanel — `/driverStatus.badge` 우선, 미존재 시 주문 기반 | `/driverStatus` |
| 통계 | Admin, 완료 주문만 집계 | 메모리 |

## 10.4 ID 전략

- **모든 레코드 ID 는 Firebase push key (문자열)** — 예: `"-NxK8OrderId001"`
- 기존 localStorage 의 numeric ID 는 전부 제거. 뷰에서 `+dataset.id` / `+id` 전량 제거 완료
- `data-id="${id}"`, `findIndex(x => x.id === id)` 모두 문자열 비교로 동작

## 10.5 인증·세션 계약

### 세션 객체 (`Auth.getSession()`)
```js
{
  token:       string,   // firebase.user.getIdToken() 결과
  userId:      string,   // auth.uid
  username:    string,   // /users/{uid}.username
  displayName: string,
  role:        'admin' | 'floor1' | 'floor2' | 'driver',
  email:       string,   // synthesized maydaegu.internal
  driverId?:   string,   // role=driver 일 때만, /drivers 에서 linkedUserId==auth.uid 로 매핑
}
```

### 이메일 합성 규칙
- `toEmail(username) = username.trim().toLowerCase() + '@maydaegu.internal'`
- 로그인/가입 양쪽 동일 규칙
- 상수: `js/auth.js` 상단 `EMAIL_DOMAIN = 'maydaegu.internal'`

### 권한 3계층 방어
1. **UI 숨김** (`Auth.can(feature, role)`) — `auth.js` 의 `rules` 객체
2. **`Api.*` 런타임 가드** — role 검증 후 RTDB 접근
3. **RTDB Security Rules** — `database.rules.json` 에서 최종 거절

## 10.6 라이브 리렌더 메커니즘

```
RTDB 변경 감지 (타인 client write 포함)
  ↓
Store 내부 on('value') 콜백
  ↓
cache[key] 갱신 + _emit(key)
  ↓
listeners[key] 순회 호출
  ↓
app.html 의 refreshOrders() 등록자:
  Floor1View._loadOrders() / Floor2View._loadMyOrders() / DeliveryPanel.render()
```

- 자기 write 도 이 경로로 되돌아옴 → 뷰가 이중 렌더될 수 있지만 idempotent 이므로 안전
- 성능 이슈 생기면 `refreshOrders` 를 `requestAnimationFrame` + debounce 로 래핑 권장

## 10.7 운영 안내 (첫 배포/타 세션에서 이어서 작업할 때)

### 시작 시 첫 관리자 생성
1. Firebase Console → Authentication → Users 가 **비어 있고**, RTDB `/users` 가 **비어 있는지** 확인
2. 웹에서 `index.html` → 회원가입 탭 → username/password/displayName 입력
3. 자동으로 `admin + isApproved:true` 로 생성됨 (토스트: "첫 관리자 계정이 생성되었습니다")
4. 로그인 → `👥 사용자 승인` 에서 다른 가입자 승인

### 기사 계정 연결 (CLAUDE.md §4.3 + 본 섹션)
1. 기사 → **모바일 Flutter 앱**에서 회원가입 (별도 레포)
2. 관리자 웹 → `👥 사용자 승인` → 해당 사용자에 `driver` 역할 부여 + 승인
3. 관리자 웹 → `🚗 기사 관리` → **+ 기사 추가** (이름·연락처) → 생성된 기사 행의 **🔗 계정 연결** → 승인된 driver 사용자 드롭다운에서 선택
4. 이후 그 기사 Flutter 앱이 배차/완료/GPS 를 정상 write 가능

### 스크립트 캐시 버스터
- `index.html` / `app.html` 의 각 `<script src="js/...">` 에 `?v=4` 로 수기 관리 중
- 대규모 JS 변경 후 새 세션/사용자에게 배포 시 버전 숫자를 올리면 브라우저 강제 재로드
- 더 체계적으로 가려면 build step 에서 해시 삽입 방식으로 전환 가능

### 프리뷰 서버 구성
- `.claude/launch.json` 에 `mayflower` 이름으로 `python -m http.server 3000` 정의됨
- Claude Code 에서 `preview_start` 로 기동 가능

## 10.8 알려진 한계 / 남은 과제

### CLAUDE.md §3.4 미처리 플래그
| # | 항목 | 처리 상태 | 비고 |
|---|------|----------|------|
| (1) | orders driver write 룰 | ✅ 수정 + 배포 완료 | `driver_lookup(linkedUserId)` 방식 |
| (2) | `/drivers/{id}/fcmToken` 쓰기 권한 | ❌ 미처리 | **Flutter 팀 작업** — 웹은 영향 없음. 필요 시 `/drivers/$driverId/fcmToken` 전용 세부 룰 또는 `/driverTokens/{driverId}` 분리 |
| (3) | `/driverStatus.indexOn: ["ts"]` 오타 | ✅ `["lastUpdate"]` 로 정정 + 배포 | |
| (4) | `/auditLog` 미구현 | 유지 | 현재 사용 없음. 도입 여부 결정 필요 |

### 원자성 미보장 구간
- 주문 수정: 사진 업로드(2회) → `updateOrder` → `updateOrderStatus` 가 비원자 → 중간 실패 시 **고아 파일**이 Storage 에 남을 수 있음
- 개선안: Cloud Functions cron 으로 1일 지난 고아 파일 청소 (후순위)

### 회귀 위험 영역 (실제 데이터 투입 후 확인 권장)
- 주문 필터 날짜 비교 (ISO 문자열 대소 비교)
- `checkedBy` List/Map 이중 파싱 (`chat.js` 기존 방어 코드 유지됨)
- 벌크 배차 순차 루프의 부분 실패 UX
- DeliveryPanel 의 `priority` 정렬 — `/driverStatus.badge` 가 remote 에서 오면 localStorage offduty 플래그와 충돌 가능성 (remote 우선이므로 실질 영향은 미미)

### UX 개선 여지
- Auth 세션 만료 시 자동 index.html 리다이렉트 (현재는 요청 실패 토스트만)
- 모달 ESC 키 닫기
- 카테고리 drag&drop 으로 `order` 재배치

## 10.9 디버그 체크리스트

DevTools Console 에서:
```js
// 1. SDK 로드
typeof firebase, !!window.FirebaseDB, !!window.FirebaseAuth, !!window.FirebaseStorage

// 2. Auth 세션
Auth.getSession()

// 3. Store 캐시 크기
Store._cache.users.length, Store._cache.orders.length, Store._cache.products.length, Store._cache.drivers.length

// 4. RTDB 직접 read 테스트
firebase.database().ref('users').limitToFirst(1).once('value').then(s => console.log(s.val()))

// 5. permission_denied 에러 발생 시 확인 순서
//    (a) Auth.getSession() 이 null 인가? → Firebase Auth 로그인 필요
//    (b) role 이 올바른가? → 관리자 승인 필요
//    (c) database.rules.json 과 실제 배포된 룰이 일치하는가? → Firebase Console 확인
```

## 10.10 다음 세션 진입 시

**Claude Code 를 새 로컬에서 띄운 경우**, 이 섹션(§10)을 먼저 읽은 뒤 다음 순서로 진행:
1. `git pull` 또는 폴더 동기화
2. `firebase login --reauth` 확인
3. `preview_start mayflower` 로 `localhost:3000` 기동
4. 첫 사용자가 이미 생성돼 있으면 관리자로 로그인, 없으면 회원가입(자동 admin)
5. 이 문서의 "남은 과제" 목록에서 작업 항목 선택

스키마/룰 변경 시에는 반드시 §1-8 의 해당 섹션 + §10.8 의 플래그 목록을 함께 업데이트.

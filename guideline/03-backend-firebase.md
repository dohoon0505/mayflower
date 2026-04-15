# 03. 백엔드 (Firebase) 가이드

> **대상 독자:** DB 설계와 Firebase 연동을 담당하는 백엔드 개발자
> **목표:** 현재 localStorage에 저장된 모든 데이터를 **Firebase Realtime Database + Storage + Auth**로 전환

---

## 1. 왜 Firebase인가?

| 장점 | 설명 |
|------|------|
| **서버리스** | 별도 백엔드 서버가 없어도 작동 — 꽃집처럼 규모 작은 사내 시스템에 딱 |
| **실시간 동기화** | `onValue` 리스너 하나면 다른 사용자의 변경이 자동 반영 |
| **무료 플랜 충분** | Realtime DB 1GB / Storage 5GB / 월 10GB 트래픽 — 메이대구 규모에 넉넉 |
| **웹 + Flutter 공용** | 같은 SDK로 웹(React)과 앱(Flutter) 모두 접근 가능 |

---

## 2. Firebase 프로젝트 정보 (이미 생성됨)

```
Project ID: mayflower-5c9dd
Database URL: https://mayflower-5c9dd-default-rtdb.asia-southeast1.firebasedatabase.app
Region: asia-southeast1 (싱가포르)
```

현재 파일 `js/firebase-config.js`에 설정값이 들어 있고, **채팅** 기능만 실제 Firebase를 사용 중입니다.

---

## 3. 사용하는 Firebase 서비스 3가지

### (1) Realtime Database — 모든 구조화된 데이터
주문, 사용자, 상품, 기사, 채팅 등

### (2) Cloud Storage — 사진 파일
매장 촬영 사진(`storePhotoUrl`), 배송 완료 사진(`deliveryPhotoUrl`)

### (3) Authentication — 로그인
현재는 `passwordHash: '1234'` 평문 — 반드시 Firebase Auth로 대체

---

## 4. Realtime Database 스키마 (전체)

Realtime DB는 **JSON 트리 구조**입니다. 최상위 경로를 다음과 같이 설계합니다:

```
mayflower-5c9dd-default-rtdb/
├── users/
│   └── {uid}/              ← Firebase Auth UID
│       ├── username: "floor2"
│       ├── displayName: "2층 담당자"
│       ├── role: "floor2"
│       ├── isActive: true
│       └── createdAt: "2025-01-01T00:00:00Z"
│
├── products/
│   └── {pushKey}/
│       ├── name: "개업 화환"
│       ├── category: "화환"
│       ├── isActive: true
│       └── createdAt: "..."
│
├── drivers/
│   └── {pushKey}/
│       ├── name: "이민준"
│       ├── phone: "010-1111-2222"
│       ├── linkedUserId: "{Auth UID}"   ← 기사 로그인 연결
│       ├── isActive: true
│       └── createdAt: "..."
│
├── orders/
│   └── {pushKey}/
│       ├── chainName: "행복꽃집"
│       ├── productId: "{products pushKey}"
│       ├── productName: "개업 화환"
│       ├── deliveryDatetime: "2026-04-15T14:00:00Z"
│       ├── isImmediate: false
│       ├── deliveryAddress: "대구시 중구 동성로 123"
│       ├── recipientName: "김철수"
│       ├── recipientPhone: "010-1234-5678"
│       ├── ribbonText: "개업을 축하합니다"
│       ├── occasionText: ""
│       ├── status: 0
│       ├── assignedDriverId: "{drivers pushKey}" or null
│       ├── assignedDriverName: "이민준" or null
│       ├── assignedAt: "..." or null
│       ├── storePhotoUrl: "https://..."
│       ├── deliveryPhotoUrl: "https://..."
│       ├── createdByUserId: "{users uid}"
│       ├── createdByName: "2층 담당자"
│       ├── createdAt: "..."
│       └── updatedAt: "..."
│
├── messages/                 ← 채팅 (이미 구현됨)
│   └── {pushKey}/
│       ├── sender: "{uid}"
│       ├── name: "홍길동"
│       ├── role: "floor1"
│       ├── text: "..."
│       ├── checkedBy: [ { userId, name, role, ts }, ... ]
│       └── ts: "..."
│
└── driverStatus/             ← 기사 실시간 상태 (Flutter 앱이 업데이트)
    └── {driverId}/
        ├── badge: "waiting" | "assigned" | "delivering" | "returning"
        ├── lat: 35.8293
        ├── lng: 128.5453
        ├── lastUpdate: "..."
        └── resetTs: "..."    ← 타임라인 초기화 기준 시각
```

### 설계 원칙

1. **평면 구조 선호:** 중첩을 피하고 `pushKey`로 참조 (Realtime DB는 deep query가 약함)
2. **비정규화 허용:** `productName`, `assignedDriverName`을 주문 문서에 복사 저장 — 조회 속도 우선
3. **타임스탬프는 ISO 문자열:** 정렬과 호환성이 좋음 (`new Date().toISOString()`)
4. **`push()`로 자동 키 생성:** 충돌 없는 고유 ID, 시간순 정렬 자동

---

## 5. 주문 상태 코드 (변경 금지)

```
0, 1, 2 → 주문접수
   3    → 배송중
   4    → 배송완료
5, 6    → 주문취소
```

웹/앱 공통 규약이므로 상수로 관리:

```js
// shared/orderStatus.js
export const ORDER_STATUS = {
  RECEIVED: 0, CONFIRMED: 1, PRODUCING: 2,
  DELIVERING: 3, COMPLETED: 4,
  CANCELLED_A: 5, CANCELLED_B: 6,
};
```

---

## 6. Firebase Authentication 전환

### 현재 (보안 취약)
```js
// store.js
{ username: 'floor2', passwordHash: '1234', ... }
```
평문 비밀번호가 localStorage에 그대로 노출됨.

### 전환 후

**옵션 A: 이메일 + 비밀번호 (권장)**
- 각 직원에게 `floor2@maydaegu.internal` 같은 내부 이메일 부여
- Firebase Auth가 비밀번호 해싱·관리 자동 처리

**옵션 B: Custom Token**
- 자체 username/password를 유지하고 싶다면 Cloud Functions에서 발급
- 더 복잡함

**옵션 A 예시 (웹):**

```js
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const cred = await signInWithEmailAndPassword(auth, email, password);
// cred.user.uid 로 /users/{uid} 조회하여 role 가져오기
```

### 로그인 플로우

```
1. 사용자가 username + password 입력
2. username을 이메일로 변환 (floor2 → floor2@maydaegu.internal)
3. signInWithEmailAndPassword()
4. 성공 시 /users/{uid}에서 role, displayName 조회
5. 세션 저장 (Zustand)
```

---

## 7. 보안 규칙 (Security Rules) — 매우 중요

현재는 **테스트 모드** (30일 후 만료, 누구나 읽기/쓰기). 실서비스 전 반드시 잠가야 합니다.

### 권장 규칙 예시

```json
{
  "rules": {
    ".read": "auth != null",

    "users": {
      "$uid": {
        ".write": "auth.uid === $uid || root.child('users').child(auth.uid).child('role').val() === 'admin'"
      }
    },

    "orders": {
      ".read": "auth != null",
      "$orderId": {
        ".write": "auth != null && (
          root.child('users').child(auth.uid).child('role').val() === 'floor2' ||
          root.child('users').child(auth.uid).child('role').val() === 'floor1' ||
          root.child('users').child(auth.uid).child('role').val() === 'admin' ||
          (root.child('users').child(auth.uid).child('role').val() === 'driver' &&
           data.child('assignedDriverId').val() === auth.uid)
        )",
        ".validate": "newData.hasChildren(['chainName', 'productId', 'deliveryAddress', 'status'])"
      }
    },

    "products": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },

    "drivers": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },

    "messages": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["ts"]
    },

    "driverStatus": {
      ".read": "auth != null",
      "$driverId": {
        ".write": "auth.uid === $driverId || root.child('users').child(auth.uid).child('role').val() === 'admin'"
      }
    }
  }
}
```

### 인덱스 설정

정렬/필터 성능을 위해 `.indexOn` 추가:

```json
"orders": {
  ".indexOn": ["createdAt", "assignedDriverId", "status", "deliveryDatetime"]
},
"messages": {
  ".indexOn": ["ts"]
}
```

---

## 8. Cloud Storage 설계

### 버킷 구조

```
gs://mayflower-5c9dd.appspot.com/
├── orders/
│   ├── {orderId}/
│   │   ├── store-photo.jpg        ← 매장 촬영 사진
│   │   └── delivery-photo.jpg     ← 배송 완료 사진
└── profiles/
    └── {uid}.jpg                  ← (선택) 프로필 이미지
```

### Storage 보안 규칙

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /orders/{orderId}/{filename} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024  // 10MB
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### 업로드 & URL 저장 패턴

```js
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDatabase, ref as dbRef, update } from 'firebase/database';

async function uploadDeliveryPhoto(orderId, file) {
  const storage = getStorage();
  const path = `orders/${orderId}/delivery-photo.jpg`;
  const snap = await uploadBytes(ref(storage, path), file);
  const url = await getDownloadURL(snap.ref);

  // DB에 URL 저장 + 상태 업데이트
  await update(dbRef(getDatabase(), `orders/${orderId}`), {
    deliveryPhotoUrl: url,
    status: 4,
    updatedAt: new Date().toISOString(),
  });
}
```

---

## 9. Realtime DB CRUD 패턴 (Modular SDK v10)

### 읽기 (일회성)

```js
import { getDatabase, ref, get } from 'firebase/database';
const snap = await get(ref(db, 'orders'));
const orders = [];
snap.forEach(child => orders.push({ id: child.key, ...child.val() }));
```

### 읽기 (실시간 구독)

```js
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';

const q = query(ref(db, 'orders'), orderByChild('createdAt'), limitToLast(200));
const unsub = onValue(q, snap => { /* ... */ });
// 해제: unsub();
```

### 쓰기 (신규)

```js
import { push, ref, set } from 'firebase/database';

const newRef = push(ref(db, 'orders'));
await set(newRef, { chainName: '...', status: 0, /* ... */ });
// newRef.key 가 자동 생성된 pushKey
```

### 업데이트

```js
import { update } from 'firebase/database';
await update(ref(db, `orders/${orderId}`), {
  status: 3,
  updatedAt: new Date().toISOString(),
});
```

### 트랜잭션 (예: 배차 충돌 방지)

```js
import { runTransaction } from 'firebase/database';

await runTransaction(ref(db, `orders/${orderId}/assignedDriverId`), cur => {
  if (cur) return;           // 이미 배정된 경우 abort
  return newDriverId;
});
```

---

## 10. 마이그레이션 체크리스트

현재 `js/store.js`의 각 메서드를 Firebase로 전환:

| Vanilla 메서드 | Firebase 대체 | 주의사항 |
|----------------|---------------|----------|
| `Store.getOrders()` | `onValue(query(ref(db,'orders'), orderByChild('createdAt')))` | 필터는 클라이언트에서 |
| `Store.createOrder()` | `push()` + `set()` | pushKey = order.id |
| `Store.updateOrder()` | `update(ref(db,'orders/'+id), {...})` | `updatedAt` 자동 갱신 |
| `Store.assignDriver()` | 위와 동일 (트랜잭션 권장) | 중복 배차 방지 |
| `Store.completeOrder()` | Storage 업로드 → DB update | 2단계 |
| `Store.getProducts()` | `onValue(ref(db,'products'))` | 거의 변경 없음 |
| `Store.getDrivers()` | `onValue(ref(db,'drivers'))` | 앱과 공유 |
| `Store.getUsers()` | `onValue(ref(db,'users'))` | 비밀번호 필드 제거 |

---

## 11. 데이터 마이그레이션 (일회성 시드)

기존 localStorage 더미 데이터를 Firebase에 옮기고 싶다면:

```js
// scripts/seed-firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const seedData = {
  users: { /* 기존 SEED_USERS */ },
  products: { /* ... */ },
  drivers: { /* ... */ },
  orders: { /* ... */ },
};

await set(ref(db), seedData);
console.log('Seeding complete.');
```

한 번만 실행하고 커밋하지 마세요 (비밀 키 노출 방지).

---

## 12. Cloud Functions (선택 사항)

기본 기능은 클라이언트 SDK만으로 충분하지만, 다음은 Functions 권장:

| 기능 | 이유 |
|------|------|
| **배송 완료 푸시 알림** | 기사가 사진 업로드 시 관리자에게 알림 |
| **통계 집계 (일/월)** | 대량 데이터를 실시간으로 집계하는 건 비효율 |
| **비활성 주문 자동 취소** | 24시간 지난 대기 주문 자동 `status=5` |
| **Auth 사용자 생성 시 /users/{uid} 자동 작성** | `onCreate` 트리거 |

예시:

```js
// functions/index.js
exports.onUserCreate = functions.auth.user().onCreate(async user => {
  await admin.database().ref(`users/${user.uid}`).set({
    username: user.email.split('@')[0],
    displayName: user.displayName || '신규 사용자',
    role: 'floor2',                  // 기본값, 관리자가 나중에 수정
    isActive: true,
    createdAt: new Date().toISOString(),
  });
});
```

---

## 13. 모니터링 & 백업

- **Firebase Console → Realtime Database → Usage**: 일일 읽기/쓰기 모니터링
- **Backups**: Console에서 수동 백업 or `gcloud` CLI로 자동화
- **감사 로그**: 중요 변경(배차, 취소)은 `/auditLog/{pushKey}`에 별도 기록 권장

---

## 14. 백엔드 개발자 체크리스트

- [ ] Firebase Console → **Authentication** 활성화 (이메일/비밀번호)
- [ ] 각 직원 계정 생성 (`floor2@maydaegu.internal` 등)
- [ ] `/users/{uid}` 초기 데이터 작성 (role 포함)
- [ ] Realtime DB 보안 규칙 작성 & 배포
- [ ] `.indexOn` 설정 (orders, messages)
- [ ] Cloud Storage 버킷 생성 + 규칙 배포
- [ ] (선택) Cloud Functions — Auth 트리거, 통계 집계
- [ ] 로컬 더미 데이터를 Firebase에 시드
- [ ] 웹/앱 팀에 `firebaseConfig` 전달
- [ ] Realtime DB 백업 정책 수립 (주 1회 권장)

---

다음 문서: [04-flutter-driver-app.md](./04-flutter-driver-app.md)

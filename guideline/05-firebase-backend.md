# 05. Firebase 백엔드 가이드 (Flutter 통합)

> **대상 독자:** Flutter 앱과 Firebase 연동을 담당하는 개발자
> **목표:** 메이대구 Flutter 앱(`maydaegu_app`)에서 Firebase Realtime DB, Storage, Auth, Cloud Functions를 통합하는 구체적인 패턴과 규칙을 제공

---

## 1. Firebase 프로젝트 정보

```
Project ID    : mayflower-5c9dd
Database URL  : https://mayflower-5c9dd-default-rtdb.asia-southeast1.firebasedatabase.app
Storage Bucket: mayflower-5c9dd.firebasestorage.app
Region        : asia-southeast1 (싱가포르)
```

### Flutter 연결 (최초 1회)

```bash
# Firebase CLI 설치
npm install -g firebase-tools
firebase login

# FlutterFire CLI 설치 & 프로젝트 연결
dart pub global activate flutterfire_cli
flutterfire configure --project=mayflower-5c9dd
```

→ `lib/firebase_options.dart`가 자동 생성됩니다.

### 앱 초기화

```dart
// lib/main.dart
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'firebase_options.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const ProviderScope(child: MaydaeguApp()));
}
```

---

## 2. 사용 서비스 4가지

| 서비스 | 용도 | Flutter 패키지 |
|--------|------|----------------|
| Realtime Database | 주문, 사용자, 상품, 기사, 채팅, 기사 상태 | `firebase_database` |
| Cloud Storage | 매장 촬영 사진, 배송 완료 사진 | `firebase_storage` |
| Authentication | 로그인/세션 관리 | `firebase_auth` |
| Cloud Functions | 트리거 (FCM 푸시, 통계 집계, 자동 취소) | 서버 측 (Node.js) |

---

## 3. Realtime Database 전체 스키마

Realtime DB는 **JSON 트리 구조**입니다. 최상위 경로:

```
mayflower-5c9dd-default-rtdb/
│
├── users/{uid}/                      ← Firebase Auth UID를 키로 사용
│   ├── username: "floor2"            ← 로그인용 아이디
│   ├── displayName: "2층 담당자"
│   ├── role: "floor2"                ← "floor2" | "floor1" | "driver" | "admin"
│   ├── isActive: true
│   └── createdAt: "2025-01-01T00:00:00Z"
│
├── products/{pushKey}/
│   ├── name: "개업 화환"
│   ├── category: "화환"
│   ├── isActive: true
│   └── createdAt: "2025-01-01T00:00:00Z"
│
├── categories/{pushKey}/
│   ├── name: "화환"
│   └── order: 0                      ← 정렬 순서
│
├── drivers/{pushKey}/
│   ├── name: "이민준"
│   ├── phone: "010-1111-2222"
│   ├── linkedUserId: "{Auth UID}"    ← 기사 로그인 계정 연결
│   ├── isActive: true
│   ├── fcmToken: "dAPq..."          ← FCM 푸시 토큰
│   └── createdAt: "2025-01-01T00:00:00Z"
│
├── orders/{pushKey}/
│   ├── chainName: "행복꽃집"
│   ├── productId: "{products pushKey}"
│   ├── productName: "개업 화환"       ← 비정규화 (조회 성능)
│   ├── deliveryDatetime: "2026-04-15T14:00:00Z"
│   ├── isImmediate: false
│   ├── deliveryAddress: "대구시 중구 동성로 123"
│   ├── recipientName: "김철수"
│   ├── recipientPhone: "010-1234-5678"
│   ├── ribbonText: "개업을 축하합니다"
│   ├── occasionText: ""
│   ├── status: 0                     ← 주문 상태 코드 (0~6)
│   ├── assignedDriverId: "{drivers pushKey}" | null
│   ├── assignedDriverName: "이민준" | null
│   ├── assignedAt: "2026-04-15T10:00:00Z" | null
│   ├── storePhotoUrl: "https://..." | null
│   ├── deliveryPhotoUrl: "https://..." | null
│   ├── createdByUserId: "{users uid}"
│   ├── createdByName: "2층 담당자"
│   ├── createdAt: "2026-04-15T09:00:00Z"
│   └── updatedAt: "2026-04-15T09:00:00Z"
│
├── messages/{pushKey}/               ← 실시간 채팅 (이미 구현됨)
│   ├── sender: "{uid}"
│   ├── name: "홍길동"
│   ├── role: "floor1"
│   ├── text: "3번 주문 제작 완료했습니다"
│   ├── checkedBy: [                  ← 확인한 사용자 목록
│   │   { userId: "...", name: "...", role: "...", ts: "..." }
│   │ ]
│   └── ts: "2026-04-15T09:30:00Z"
│
└── driverStatus/{driverId}/          ← 기사 실시간 상태 (앱이 업데이트)
    ├── badge: "waiting"              ← "waiting"|"assigned"|"delivering"|"returning"
    ├── lat: 35.8293
    ├── lng: 128.5453
    ├── lastUpdate: "2026-04-15T10:15:00Z"
    └── resetTs: "2026-04-15T08:00:00Z"  ← 타임라인 초기화 기준 시각
```

### 스키마 설계 원칙

| 원칙 | 설명 | 이유 |
|------|------|------|
| **평면 구조** | 중첩 최소화, `pushKey`로 참조 | Realtime DB는 deep query가 약함 |
| **비정규화** | `productName`, `assignedDriverName`을 주문에 복사 | 매번 JOIN 없이 즉시 표시 |
| **ISO 타임스탬프** | `"2026-04-15T14:00:00Z"` 형식 | 정렬 호환성, 시간대 안전 |
| **push() 자동키** | `-Oabc123` 같은 고유 키 자동 생성 | 충돌 없는 고유 ID + 시간순 정렬 |
| **null 허용** | `assignedDriverId: null` | 배차 전 상태 표현 |

---

## 4. 주문 상태 코드 (변경 금지)

```
코드   의미        색상 (CSS)                 설명
────   ────        ──────────                ────
 0     주문접수    --s0-bg/#f1f5f9            2층에서 방금 등록
 1     확인완료    --s1-bg/#eff6ff            1층이 확인
 2     제작중      --s2-bg/#f5f3ff            1층이 제작 시작
 3     배송중      --s3-bg/#fffbeb            기사 배정 + 출발
 4     배송완료    --s4-bg/#f0fdf4            사진 업로드 완료
 5     주문취소    --s5-bg/#fef2f2            취소
 6     반품        --s6-bg/#fff7ed            반품 처리
```

이 코드는 웹과 앱이 공유하므로 **절대 변경하지 마세요.** Dart 상수:

```dart
// lib/core/constants/order_status.dart
abstract final class OrderStatus {
  static const int received   = 0;
  static const int confirmed  = 1;
  static const int producing  = 2;
  static const int delivering = 3;
  static const int completed  = 4;
  static const int cancelledA = 5;
  static const int cancelledB = 6;
}
```

---

## 5. Dart(Flutter)에서 CRUD 패턴

`firebase_database` 패키지 기준으로 모든 DB 접근 패턴을 정리합니다.

### 5-1. 읽기 (일회성 — `get`)

```dart
import 'package:firebase_database/firebase_database.dart';

final ref = FirebaseDatabase.instance.ref('orders');
final snapshot = await ref.get();

if (snapshot.exists) {
  final data = snapshot.value as Map<dynamic, dynamic>;
  final orders = data.entries.map((e) {
    return Order.fromMap(e.key as String, e.value as Map);
  }).toList();
}
```

### 5-2. 읽기 (실시간 구독 — `onValue`)

```dart
/// 전체 주문 실시간 스트림
final allOrdersProvider = StreamProvider<List<Order>>((ref) {
  final dbRef = FirebaseDatabase.instance
      .ref('orders')
      .orderByChild('createdAt');

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map<dynamic, dynamic>?;
    if (data == null) return <Order>[];
    return data.entries
        .map((e) => Order.fromMap(e.key as String, e.value as Map))
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  });
});
```

### 5-3. 읽기 (필터 — 특정 기사의 주문)

```dart
/// 특정 기사에게 배정된 주문만 실시간 구독
final myOrdersProvider = StreamProvider.family<List<Order>, String>(
  (ref, driverId) {
    final dbRef = FirebaseDatabase.instance
        .ref('orders')
        .orderByChild('assignedDriverId')
        .equalTo(driverId);

    return dbRef.onValue.map((event) {
      final data = event.snapshot.value as Map<dynamic, dynamic>?;
      if (data == null) return <Order>[];
      return data.entries
          .map((e) => Order.fromMap(e.key as String, e.value as Map))
          .toList()
        ..sort((a, b) =>
            a.deliveryDatetime.compareTo(b.deliveryDatetime));
    });
  },
);
```

### 5-4. 쓰기 (신규 — `push` + `set`)

```dart
/// 신규 주문 생성
Future<String> createOrder(Map<String, dynamic> orderData) async {
  final ref = FirebaseDatabase.instance.ref('orders');
  final newRef = ref.push();
  final now = DateTime.now().toIso8601String();

  await newRef.set({
    ...orderData,
    'status': OrderStatus.received,
    'assignedDriverId': null,
    'assignedDriverName': null,
    'assignedAt': null,
    'storePhotoUrl': null,
    'deliveryPhotoUrl': null,
    'createdAt': now,
    'updatedAt': now,
  });

  return newRef.key!; // 자동 생성된 pushKey 반환
}
```

### 5-5. 업데이트 (`update`)

```dart
/// 주문 상태 변경
Future<void> updateOrderStatus(String orderId, int status) async {
  await FirebaseDatabase.instance.ref('orders/$orderId').update({
    'status': status,
    'updatedAt': DateTime.now().toIso8601String(),
  });
}
```

### 5-6. 트랜잭션 (`runTransaction` — 배차 충돌 방지)

여러 관리자가 동시에 같은 주문에 기사를 배정하면 충돌이 발생합니다.
`runTransaction`으로 원자적 업데이트를 보장합니다.

```dart
/// 기사 배차 (동시 배차 충돌 방지)
Future<bool> assignDriver({
  required String orderId,
  required String driverId,
  required String driverName,
}) async {
  final ref = FirebaseDatabase.instance.ref('orders/$orderId');

  final result = await ref.runTransaction((currentData) {
    if (currentData == null) return Transaction.abort();

    final current = Map<String, dynamic>.from(currentData as Map);

    // 이미 다른 기사가 배정된 경우 abort
    if (current['assignedDriverId'] != null) {
      return Transaction.abort();
    }

    final now = DateTime.now().toIso8601String();
    current['assignedDriverId'] = driverId;
    current['assignedDriverName'] = driverName;
    current['assignedAt'] = now;
    current['updatedAt'] = now;

    return Transaction.success(current);
  });

  return result.committed;
}
```

---

## 6. Cloud Storage 설계

### 버킷 구조

```
gs://mayflower-5c9dd.firebasestorage.app/
├── orders/
│   └── {orderId}/
│       ├── store-photo.jpg         ← 매장 촬영 사진 (1층에서 업로드)
│       └── delivery-photo.jpg      ← 배송 완료 사진 (기사가 업로드)
└── profiles/
    └── {uid}.jpg                   ← (선택) 프로필 이미지
```

### 업로드 + URL 저장 패턴 (Dart)

```dart
import 'dart:io';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_database/firebase_database.dart';

class StorageService {
  final _storage = FirebaseStorage.instance;
  final _db = FirebaseDatabase.instance;

  /// 배송 완료 사진 업로드 후 주문 상태를 '완료'로 변경
  Future<String> uploadDeliveryPhoto({
    required String orderId,
    required File imageFile,
  }) async {
    // 1. Storage에 업로드
    final storageRef = _storage.ref(
      'orders/$orderId/delivery-photo.jpg',
    );

    final uploadTask = storageRef.putFile(
      imageFile,
      SettableMetadata(contentType: 'image/jpeg'),
    );

    // 업로드 진행률 모니터링 (선택)
    uploadTask.snapshotEvents.listen((event) {
      final progress =
          event.bytesTransferred / event.totalBytes;
      debugPrint('Upload progress: ${(progress * 100).toStringAsFixed(0)}%');
    });

    final snapshot = await uploadTask;
    final downloadUrl = await snapshot.ref.getDownloadURL();

    // 2. DB에 URL 저장 + 상태 업데이트
    await _db.ref('orders/$orderId').update({
      'deliveryPhotoUrl': downloadUrl,
      'status': OrderStatus.completed,
      'updatedAt': DateTime.now().toIso8601String(),
    });

    return downloadUrl;
  }

  /// 매장 촬영 사진 업로드
  Future<String> uploadStorePhoto({
    required String orderId,
    required File imageFile,
  }) async {
    final ref = _storage.ref(
      'orders/$orderId/store-photo.jpg',
    );
    await ref.putFile(imageFile);
    final url = await ref.getDownloadURL();

    await _db.ref('orders/$orderId').update({
      'storePhotoUrl': url,
      'updatedAt': DateTime.now().toIso8601String(),
    });

    return url;
  }
}
```

---

## 7. 보안 규칙 (Security Rules)

### 현재 상태: 테스트 모드 (30일 만료)

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**경고:** 이 상태로 실서비스 운영 금지.

### 실서비스용 Realtime Database 보안 규칙

```json
{
  "rules": {
    ".read": "auth != null",

    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth.uid === $uid || root.child('users').child(auth.uid).child('role').val() === 'admin'"
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
      ".indexOn": ["createdAt", "assignedDriverId", "status", "deliveryDatetime"],
      "$orderId": {
        ".write": "auth != null && (
          root.child('users').child(auth.uid).child('role').val() === 'floor2' ||
          root.child('users').child(auth.uid).child('role').val() === 'floor1' ||
          root.child('users').child(auth.uid).child('role').val() === 'admin' ||
          (root.child('users').child(auth.uid).child('role').val() === 'driver' &&
           data.child('assignedDriverId').val() === auth.uid)
        )",
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
        ".write": "auth != null && (
          root.child('drivers').child($driverId).child('linkedUserId').val() === auth.uid ||
          root.child('users').child(auth.uid).child('role').val() === 'admin'
        )"
      }
    }
  }
}
```

### Cloud Storage 보안 규칙

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 주문 사진: 인증된 사용자만 읽기, 10MB 이하 이미지만 쓰기
    match /orders/{orderId}/{filename} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // 프로필 이미지: 본인만 쓰기
    match /profiles/{uid}.jpg {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## 8. 인덱스 설정 (`.indexOn`)

Firebase Realtime DB에서 `orderByChild`를 사용하려면 해당 필드에 인덱스가 필요합니다.
인덱스가 없으면 콘솔에 경고가 나오고 전체 데이터를 클라이언트로 내려받습니다.

```json
"orders": {
  ".indexOn": [
    "createdAt",
    "assignedDriverId",
    "status",
    "deliveryDatetime"
  ]
},
"messages": {
  ".indexOn": ["ts"]
},
"products": {
  ".indexOn": ["createdAt", "category"]
},
"categories": {
  ".indexOn": ["order"]
},
"drivers": {
  ".indexOn": ["linkedUserId", "isActive"]
}
```

---

## 9. Cloud Functions 시나리오

Cloud Functions는 서버에서 실행되므로, 클라이언트(앱)에서 직접 처리하기 어려운 작업에 사용합니다.

### 9-1. Auth onCreate -- `/users/{uid}` 자동 생성

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onUserCreate = functions
  .region('asia-southeast1')
  .auth.user()
  .onCreate(async (user) => {
    await admin.database().ref(`users/${user.uid}`).set({
      username: user.email ? user.email.split('@')[0] : '',
      displayName: user.displayName || '신규 사용자',
      role: 'floor2', // 기본값, 관리자가 수정
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  });
```

### 9-2. 배차 시 FCM 푸시 알림

```javascript
exports.onOrderAssigned = functions
  .region('asia-southeast1')
  .database.ref('/orders/{orderId}/assignedDriverId')
  .onWrite(async (change, context) => {
    const newDriverId = change.after.val();
    if (!newDriverId || newDriverId === change.before.val()) return;

    // 기사의 FCM 토큰 조회
    const driverSnap = await admin
      .database()
      .ref(`drivers/${newDriverId}`)
      .once('value');
    const driver = driverSnap.val();
    if (!driver || !driver.fcmToken) return;

    // 주문 정보 조회
    const orderSnap = await admin
      .database()
      .ref(`orders/${context.params.orderId}`)
      .once('value');
    const order = orderSnap.val();

    await admin.messaging().send({
      token: driver.fcmToken,
      notification: {
        title: '신규 배차',
        body: `${order.chainName} - ${order.productName} (${order.deliveryAddress})`,
      },
      data: {
        orderId: context.params.orderId,
        type: 'new_assignment',
      },
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: { sound: 'default' },
        },
      },
    });
  });
```

### 9-3. 통계 집계

```javascript
exports.aggregateDailyStats = functions
  .region('asia-southeast1')
  .pubsub.schedule('every day 23:59')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const today = new Date().toISOString().split('T')[0];
    const ordersSnap = await admin.database().ref('orders').once('value');

    let total = 0, completed = 0, cancelled = 0;
    ordersSnap.forEach((child) => {
      const order = child.val();
      const orderDate = order.createdAt?.split('T')[0];
      if (orderDate === today) {
        total++;
        if (order.status === 4) completed++;
        if (order.status === 5 || order.status === 6) cancelled++;
      }
    });

    await admin.database().ref(`statistics/${today}`).set({
      total,
      completed,
      cancelled,
      completionRate: total > 0 ? (completed / total * 100).toFixed(1) : '0',
      updatedAt: new Date().toISOString(),
    });
  });
```

### 9-4. 비활성 주문 자동 취소

```javascript
exports.autoCancelStaleOrders = functions
  .region('asia-southeast1')
  .pubsub.schedule('every 1 hours')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    const cutoffIso = cutoff.toISOString();

    const snap = await admin
      .database()
      .ref('orders')
      .orderByChild('status')
      .equalTo(0)
      .once('value');

    const updates = {};
    snap.forEach((child) => {
      const order = child.val();
      if (order.createdAt < cutoffIso) {
        updates[`${child.key}/status`] = 5;
        updates[`${child.key}/updatedAt`] = new Date().toISOString();
      }
    });

    if (Object.keys(updates).length > 0) {
      await admin.database().ref('orders').update(updates);
    }
  });
```

---

## 10. 데이터 마이그레이션 (localStorage --> Firebase 일회성 시드)

현재 `js/store.js`에 있는 시드 데이터를 Firebase로 옮기는 일회성 스크립트:

```javascript
// scripts/seed-firebase.js
// 실행: node scripts/seed-firebase.js
// 주의: 한 번만 실행하고, API 키가 포함되므로 커밋하지 마세요.

const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://mayflower-5c9dd-default-rtdb.asia-southeast1.firebasedatabase.app',
});

const db = admin.database();

async function seed() {
  // 상품
  const products = {
    p1: { name: '개업 화환', category: '화환', isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    p2: { name: '졸업 화환', category: '화환', isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    p3: { name: '축하 화환', category: '화환', isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    p4: { name: '근조 화환', category: '화환', isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    p5: { name: '꽃바구니',  category: '꽃바구니', isActive: true, createdAt: '2025-01-01T00:00:00Z' },
  };

  // 카테고리
  const categories = {
    c1: { name: '화환',     order: 0 },
    c2: { name: '꽃바구니', order: 1 },
    c3: { name: '화분',     order: 2 },
    c4: { name: '생화',     order: 3 },
    c5: { name: '조화',     order: 4 },
    c6: { name: '기타',     order: 5 },
  };

  // 기사 (linkedUserId는 Auth 계정 생성 후 매핑)
  const drivers = {
    d1:  { name: '이민준', phone: '010-1111-2222', linkedUserId: null, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    d2:  { name: '박서연', phone: '010-3333-4444', linkedUserId: null, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    d3:  { name: '정지훈', phone: '010-5555-6666', linkedUserId: null, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // ... 나머지 기사 동일 패턴
  };

  await db.ref('products').set(products);
  await db.ref('categories').set(categories);
  await db.ref('drivers').set(drivers);
  // 주문은 운영 시작 후 실제 데이터로 쌓이므로 시드 불필요

  console.log('Seeding complete.');
  process.exit(0);
}

seed().catch(console.error);
```

---

## 11. 오프라인 지원

Realtime Database는 기본적으로 오프라인 캐시를 지원합니다. 기사 앱에서 반드시 활성화하세요.

```dart
// main.dart 또는 앱 초기화 시점
FirebaseDatabase.instance.setPersistenceEnabled(true);

// 캐시 크기 제한 (기본 10MB, 필요 시 조절)
FirebaseDatabase.instance.setPersistenceCacheSizeBytes(10 * 1024 * 1024);
```

**주의사항:**
- 오프라인 중 쓰기 작업은 큐에 저장되고 네트워크 복구 시 자동 전송
- 트랜잭션(`runTransaction`)은 오프라인에서 동작하지 않음
- `get()`은 오프라인 시 캐시에서 반환, `onValue`는 캐시 데이터로 콜백 발생

---

## 12. 모니터링 및 백업

### Firebase Console 모니터링

- **Realtime Database > Usage** : 일일 연결 수, 읽기/쓰기 횟수
- **Authentication > Users** : 활성 사용자 수
- **Storage > Usage** : 저장 용량, 대역폭

### 백업 권장 사항

| 항목 | 주기 | 방법 |
|------|------|------|
| Realtime DB | 주 1회 | Firebase Console > Export JSON |
| Cloud Storage | 월 1회 | `gsutil cp -r gs://bucket ./backup` |
| Auth 사용자 목록 | 분기 1회 | `firebase auth:export users.json` |

### 감사 로그 (Audit Log)

배차, 취소 등 중요 변경은 별도 로그 경로에 기록 권장:

```dart
Future<void> writeAuditLog({
  required String action,   // 'assign_driver', 'cancel_order' 등
  required String userId,
  required String targetId, // orderId, driverId 등
  Map<String, dynamic>? details,
}) async {
  await FirebaseDatabase.instance.ref('auditLog').push().set({
    'action': action,
    'userId': userId,
    'targetId': targetId,
    'details': details,
    'ts': DateTime.now().toIso8601String(),
  });
}
```

---

## 13. 서비스 계층 설계 패턴

모든 Firebase 접근은 `services/` 폴더의 클래스를 통해야 합니다. Provider에서 직접 Firebase를 호출하지 마세요.

```
[Screen] → [Provider] → [Service] → [Firebase]
```

```dart
// services/order_service.dart
class OrderService {
  final _db = FirebaseDatabase.instance;

  Stream<List<Order>> watchAll() { ... }
  Stream<List<Order>> watchByDriver(String driverId) { ... }
  Future<String> create(Map<String, dynamic> data) { ... }
  Future<void> updateStatus(String id, int status) { ... }
  Future<bool> assignDriver(String orderId, String driverId, String name) { ... }
}

// providers/order_provider.dart
final orderServiceProvider = Provider((ref) => OrderService());

final allOrdersProvider = StreamProvider<List<Order>>((ref) {
  return ref.watch(orderServiceProvider).watchAll();
});
```

---

## 14. 백엔드 개발 체크리스트

### 초기 설정

- [ ] Firebase Console > **Authentication** 활성화 (이메일/비밀번호)
- [ ] 직원 계정 생성 (`floor2@maydaegu.internal` 등)
- [ ] `/users/{uid}` 초기 데이터 작성 (role, displayName 포함)
- [ ] `flutterfire configure --project=mayflower-5c9dd` 실행

### 보안

- [ ] Realtime DB 보안 규칙 작성 및 배포
- [ ] Cloud Storage 보안 규칙 작성 및 배포
- [ ] `.indexOn` 설정 (orders, messages, products, drivers)

### 기능

- [ ] Cloud Functions 배포 (`firebase deploy --only functions`)
- [ ] FCM 설정 (Android: 자동, iOS: APNs 인증서)
- [ ] 시드 데이터 마이그레이션 실행

### 운영

- [ ] 백업 정책 수립 (주 1회 DB 백업)
- [ ] Firebase Console Usage 알림 설정
- [ ] 감사 로그 경로(`/auditLog`) 활성화

---

이전 문서: [04-project-structure.md](./04-project-structure.md) -- 프로젝트 구조 및 코드 컨벤션
다음 문서: [06-authentication.md](./06-authentication.md) -- 인증 및 권한 관리

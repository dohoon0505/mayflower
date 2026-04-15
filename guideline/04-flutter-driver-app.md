# 04. Flutter 배송기사 앱 개발 가이드

> **대상 독자:** Flutter 앱 개발자
> **목표:** 배송 기사 전용 모바일 앱 개발. 웹(React) 쪽은 관리자/사무직이 사용하고, 기사는 오직 앱만 사용.

---

## 1. 앱의 역할 한 줄 요약

> **"내가 배정받은 주문을 확인하고, 배송 출발/완료를 기록하며, 내 위치를 자동 공유하는 앱"**

웹 버전과 동일한 Firebase 데이터를 공유하므로, 관리자가 웹에서 기사를 배차하면 앱에 즉시 나타나야 합니다.

---

## 2. 왜 기사 전용 앱인가?

| 이유 | 설명 |
|------|------|
| **현장성** | 기사는 이동 중이라 PC를 쓸 수 없음 |
| **카메라** | 배송 완료 사진을 찍는 게 필수 |
| **GPS** | 위치 기반 자동 상태 전환 (복귀중 → 배송대기) |
| **푸시 알림** | 신규 배차 시 즉시 알림 필요 |
| **간단한 UX** | 화면 복잡도 최소화 — 주문 목록 + 상세 + 사진 버튼 |

---

## 3. 권장 기술 스택

| 영역 | 라이브러리 | 비고 |
|------|-----------|------|
| Flutter 버전 | **3.19+** | Dart 3 |
| 상태 관리 | **Riverpod** 또는 **Provider** | |
| Firebase | `firebase_core`, `firebase_auth`, `firebase_database`, `firebase_storage`, `firebase_messaging` | |
| 라우팅 | **go_router** | 선언형 |
| 위치 | **geolocator** | GPS 권한 + 거리 계산 |
| 카메라 | **image_picker** | 카메라/갤러리 |
| 지도 | **google_maps_flutter** (선택) | 배송지 지도 표시 |
| 백그라운드 위치 | **flutter_background_geolocation** 또는 **workmanager** | 복귀 감지용 |

### pubspec.yaml 초기 예시

```yaml
name: maydaegu_driver
description: 메이대구 배송 기사 앱

dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^2.27.0
  firebase_auth: ^4.17.0
  firebase_database: ^10.4.0
  firebase_storage: ^11.6.0
  firebase_messaging: ^14.7.0
  flutter_riverpod: ^2.5.0
  go_router: ^13.2.0
  geolocator: ^11.0.0
  image_picker: ^1.0.7
  intl: ^0.19.0
  permission_handler: ^11.3.0
```

---

## 4. 앱 화면 구성 (4개 화면)

```
┌──────────────────────────┐
│  1. 로그인                 │
│     username + password    │
└──────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│  2. 내 배송 목록 (홈)        │
│                          │
│  [ 주문 #5 — 배송중 ]       │
│  [ 주문 #6 — 배차완료 ]     │
│  [ 주문 #7 — 배송완료 ]     │
│                          │
│  [ 배송 출발 ] 버튼         │
└──────────────────────────┘
           │ 주문 탭
           ▼
┌──────────────────────────┐
│  3. 주문 상세              │
│                          │
│  체인명: 행복꽃집             │
│  상품: 개업 화환             │
│  받는분: 김철수              │
│  주소: 대구시...             │
│  리본: 개업을 축하합니다       │
│                          │
│  [ 지도 보기 ]              │
│  [ 전화 걸기 ]              │
│  [ 📷 배송완료 사진 ]        │
└──────────────────────────┘
           │ 사진 버튼
           ▼
┌──────────────────────────┐
│  4. 카메라 → 업로드          │
│  (image_picker)           │
│  → Firebase Storage       │
│  → status=4 자동 변경       │
└──────────────────────────┘
```

---

## 5. 폴더 구조 제안

```
maydaegu_driver/
├── lib/
│   ├── main.dart
│   ├── firebase_options.dart       ← flutterfire configure 자동 생성
│   ├── app.dart                    ← MaterialApp + 라우터
│   ├── models/
│   │   ├── order.dart
│   │   ├── driver.dart
│   │   └── session.dart
│   ├── providers/
│   │   ├── auth_provider.dart      ← Riverpod
│   │   ├── orders_provider.dart    ← Realtime DB 구독
│   │   └── location_provider.dart
│   ├── services/
│   │   ├── firebase_service.dart
│   │   ├── location_service.dart   ← GPS + 거리 계산
│   │   ├── photo_service.dart      ← 업로드 로직
│   │   └── notification_service.dart
│   ├── screens/
│   │   ├── login_screen.dart
│   │   ├── home_screen.dart        ← 내 배송 목록
│   │   ├── order_detail_screen.dart
│   │   └── camera_screen.dart
│   └── widgets/
│       ├── order_card.dart
│       ├── status_badge.dart
│       └── loading_overlay.dart
└── pubspec.yaml
```

---

## 6. Order 모델 (웹과 완전 일치해야 함)

```dart
// lib/models/order.dart
class Order {
  final String id;
  final String chainName;
  final String productId;
  final String productName;
  final DateTime deliveryDatetime;
  final bool isImmediate;
  final String deliveryAddress;
  final String recipientName;
  final String recipientPhone;
  final String ribbonText;
  final String occasionText;
  final int status;                   // 0~6
  final String? assignedDriverId;
  final String? assignedDriverName;
  final DateTime? assignedAt;
  final String? storePhotoUrl;
  final String? deliveryPhotoUrl;
  final String createdByUserId;
  final String createdByName;
  final DateTime createdAt;
  final DateTime updatedAt;

  Order({
    required this.id,
    required this.chainName,
    /* ... 생략 ... */
  });

  factory Order.fromMap(String id, Map<dynamic, dynamic> m) => Order(
    id: id,
    chainName: m['chainName'] ?? '',
    productId: m['productId']?.toString() ?? '',
    productName: m['productName'] ?? '',
    deliveryDatetime: DateTime.parse(m['deliveryDatetime']),
    isImmediate: m['isImmediate'] ?? false,
    deliveryAddress: m['deliveryAddress'] ?? '',
    recipientName: m['recipientName'] ?? '',
    recipientPhone: m['recipientPhone'] ?? '',
    ribbonText: m['ribbonText'] ?? '',
    occasionText: m['occasionText'] ?? '',
    status: m['status'] ?? 0,
    assignedDriverId: m['assignedDriverId']?.toString(),
    assignedDriverName: m['assignedDriverName'],
    assignedAt: m['assignedAt'] != null ? DateTime.parse(m['assignedAt']) : null,
    storePhotoUrl: m['storePhotoUrl'],
    deliveryPhotoUrl: m['deliveryPhotoUrl'],
    createdByUserId: m['createdByUserId']?.toString() ?? '',
    createdByName: m['createdByName'] ?? '',
    createdAt: DateTime.parse(m['createdAt']),
    updatedAt: DateTime.parse(m['updatedAt']),
  );
}
```

### 상태 코드 상수 (웹과 동일)

```dart
class OrderStatus {
  static const int received = 0;
  static const int confirmed = 1;
  static const int producing = 2;
  static const int delivering = 3;
  static const int completed = 4;
  static const int cancelledA = 5;
  static const int cancelledB = 6;
}
```

---

## 7. Firebase 연결

### 초기 셋업

```bash
# 1. Firebase CLI 설치
npm install -g firebase-tools
firebase login

# 2. FlutterFire CLI 설치 & 설정
dart pub global activate flutterfire_cli
flutterfire configure --project=mayflower-5c9dd
```

→ `lib/firebase_options.dart`가 자동 생성됩니다.

### 초기화

```dart
// main.dart
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const ProviderScope(child: MyApp()));
}
```

---

## 8. 실시간 주문 구독 (핵심 코드)

내 주문만 필터하여 실시간으로 받아오기:

```dart
// lib/providers/orders_provider.dart
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/order.dart';

final myOrdersProvider = StreamProvider.family<List<Order>, String>((ref, driverId) {
  final dbRef = FirebaseDatabase.instance
      .ref('orders')
      .orderByChild('assignedDriverId')
      .equalTo(driverId);

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map<dynamic, dynamic>?;
    if (data == null) return <Order>[];
    return data.entries
        .map((e) => Order.fromMap(e.key, e.value))
        .toList()
      ..sort((a, b) => a.deliveryDatetime.compareTo(b.deliveryDatetime));
  });
});
```

### 사용

```dart
class HomeScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driverId = ref.watch(authProvider).session?.driverId;
    if (driverId == null) return const LoginScreen();

    final asyncOrders = ref.watch(myOrdersProvider(driverId));
    return asyncOrders.when(
      data: (orders) => ListView(children: orders.map((o) => OrderCard(order: o)).toList()),
      loading: () => const CircularProgressIndicator(),
      error: (e, _) => Text('오류: $e'),
    );
  }
}
```

---

## 9. 웹과의 핵심 연동 포인트 ⭐

앱이 Firebase에 **쓰기**를 하는 순간마다 웹 관리자 화면이 자동 업데이트됩니다. 반드시 지켜야 할 3가지 쓰기 동작:

### (A) 배송 출발 버튼 클릭

```dart
// "배송 출발" 버튼
Future<void> onDepart(String orderId) async {
  await FirebaseDatabase.instance.ref('orders/$orderId').update({
    'status': OrderStatus.delivering,           // 3
    'updatedAt': DateTime.now().toIso8601String(),
  });
}
```

→ 웹 DeliveryPanel의 뱃지가 자동으로 **"배송중"**으로 전환됩니다.

### (B) 배송 완료 사진 업로드

```dart
Future<void> onComplete(String orderId, XFile photo) async {
  // 1. Storage 업로드
  final ref = FirebaseStorage.instance.ref('orders/$orderId/delivery-photo.jpg');
  await ref.putFile(File(photo.path));
  final url = await ref.getDownloadURL();

  // 2. DB 업데이트 — status=4 + URL
  await FirebaseDatabase.instance.ref('orders/$orderId').update({
    'status': OrderStatus.completed,            // 4
    'deliveryPhotoUrl': url,
    'updatedAt': DateTime.now().toIso8601String(),
  });
}
```

→ **이 주문이 기사가 배정받은 마지막 주문이면** 웹의 뱃지가 자동으로 "복귀중"으로 바뀝니다. (웹 쪽 로직이 자동 감지)

### (C) 위치 업데이트 (주기적)

```dart
// lib/services/location_service.dart
import 'package:geolocator/geolocator.dart';
import 'package:firebase_database/firebase_database.dart';

const double companyLat = 35.8293;   // 대구 달서구 장기동 666-1 (실제 좌표 확인 필요)
const double companyLng = 128.5453;
const double returnRadius = 100.0;   // meters

Future<void> updateLocation(String driverId) async {
  final pos = await Geolocator.getCurrentPosition();

  final distance = Geolocator.distanceBetween(
    pos.latitude, pos.longitude, companyLat, companyLng,
  );

  final update = <String, dynamic>{
    'lat': pos.latitude,
    'lng': pos.longitude,
    'lastUpdate': DateTime.now().toIso8601String(),
  };

  // 100m 이내 진입 시 배송대기로 자동 전환 + 타임라인 리셋
  if (distance <= returnRadius) {
    update['resetTs'] = DateTime.now().toIso8601String();
  }

  await FirebaseDatabase.instance.ref('driverStatus/$driverId').update(update);
}
```

주기: 배송 중이면 30초~1분, 대기 중이면 5분마다. 배터리 절약을 위해 `geolocator`의 `distanceFilter`를 사용하세요.

---

## 10. 카메라 & 사진 업로드

```dart
import 'package:image_picker/image_picker.dart';

Future<XFile?> takePhoto() async {
  final picker = ImagePicker();
  return await picker.pickImage(
    source: ImageSource.camera,
    imageQuality: 70,            // 파일 크기 절감
    maxWidth: 1600,
  );
}
```

**권한 (AndroidManifest.xml):**

```xml
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
<uses-permission android:name="android.permission.INTERNET"/>
```

**iOS (Info.plist):**

```xml
<key>NSCameraUsageDescription</key>
<string>배송 완료 사진 촬영을 위해 카메라에 접근합니다.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>배송 상태 자동 업데이트를 위해 위치를 사용합니다.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>배송 복귀 감지를 위해 백그라운드 위치를 사용합니다.</string>
```

---

## 11. 푸시 알림 (신규 배차 알림)

### 설정
1. Firebase Console → Cloud Messaging 활성화
2. `firebase_messaging` 플러그인 추가
3. iOS는 APNs 인증서, Android는 자동

### 신규 배차 감지 방법
1. **클라이언트 구독:** 앱이 `/orders` 실시간 리스너로 감지하고 로컬 알림 생성
2. **서버 푸시 (권장):** Cloud Functions에서 `onCreate` 또는 `onUpdate` 트리거 → FCM 전송

```js
// functions/index.js
exports.onOrderAssigned = functions.database
  .ref('/orders/{orderId}/assignedDriverId')
  .onWrite(async (change, context) => {
    const newDriverId = change.after.val();
    if (!newDriverId || newDriverId === change.before.val()) return;

    const driver = await admin.database().ref(`drivers/${newDriverId}`).once('value');
    const fcmToken = driver.val().fcmToken;
    if (!fcmToken) return;

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: '신규 배차',
        body: `주문 #${context.params.orderId}가 배정되었습니다.`,
      },
    });
  });
```

앱에서 FCM 토큰을 얻어서 `/drivers/{driverId}/fcmToken`에 저장하면 됩니다.

---

## 12. 배지 자동 알고리즘 (앱 측에서도 동일하게 표시)

웹의 `DeliveryPanel` 로직과 **완전히 동일**하게 구현:

```dart
enum DriverBadge { waiting, assigned, delivering, returning }

DriverBadge computeBadge(List<Order> myOrders, DateTime? resetTs) {
  final active = myOrders.where((o) =>
    resetTs == null || o.updatedAt.isAfter(resetTs));

  final delivering = active.where((o) => o.status == 3);
  final assigned = active.where((o) => o.status >= 0 && o.status <= 2);
  final completed = active.where((o) => o.status == 4);

  if (delivering.isNotEmpty) return DriverBadge.delivering;
  if (assigned.isNotEmpty)   return DriverBadge.assigned;
  if (completed.isNotEmpty)  return DriverBadge.returning;
  return DriverBadge.waiting;
}
```

---

## 13. 웹 ↔ 앱 연동 요약표

| 사용자 액션 | 어디서 | Firebase 경로 | 결과 |
|-------------|--------|---------------|------|
| 관리자가 기사 배차 | 웹 | `orders/{id}/assignedDriverId` | 앱에 푸시 + 배차완료 뱃지 |
| 기사가 "배송 출발" 터치 | 앱 | `orders/{id}/status=3` | 웹 뱃지 → 배송중 |
| 기사가 사진 업로드 | 앱 | `storage://orders/{id}/...` + `status=4` | 웹 주문 → 완료 표시 |
| 기사가 회사 100m 진입 | 앱 (자동) | `driverStatus/{id}/resetTs` | 웹 → 배송대기 + 타임라인 초기화 |
| 기사 위치 업데이트 | 앱 (주기) | `driverStatus/{id}/lat,lng` | 관리자 지도에 실시간 표시 |
| 관리자가 상품 추가 | 웹 | `products/{pushKey}` | (앱 화면엔 직접 노출 안 됨) |

---

## 14. 개발 단계별 체크리스트

### Phase 1 — 기본 구조 (1~2주)
- [ ] `flutter create maydaegu_driver`
- [ ] `flutterfire configure`로 Firebase 연결
- [ ] 로그인 화면 + Firebase Auth 연동
- [ ] 세션 저장 (shared_preferences)
- [ ] go_router 라우팅 설정

### Phase 2 — 주문 조회 (1주)
- [ ] `myOrdersProvider` 실시간 구독
- [ ] 홈 화면 주문 리스트 + 뱃지 표시
- [ ] 주문 상세 화면

### Phase 3 — 배송 동작 (1~2주)
- [ ] "배송 출발" 버튼 → status=3
- [ ] 카메라 촬영 + Storage 업로드
- [ ] "배송 완료" 처리 → status=4

### Phase 4 — 위치 & 알림 (2주)
- [ ] 위치 권한 요청 + `geolocator`
- [ ] 주기적 위치 업데이트 (foreground)
- [ ] 회사 반경 100m 도착 감지 로직
- [ ] FCM 토큰 저장 + 푸시 알림 수신

### Phase 5 — 백그라운드 위치 (1~2주 — 난이도 높음)
- [ ] `flutter_background_geolocation` 설정
- [ ] iOS/Android 각각 백그라운드 권한 테스트
- [ ] 배터리 최적화 예외 요청

### Phase 6 — QA & 배포
- [ ] 실기기 테스트 (Android + iOS)
- [ ] Play Store / App Store 빌드
- [ ] 내부 배포 (Firebase App Distribution)

---

## 15. 주의사항 ⚠️

1. **주문 상태 코드(0~6)는 웹과 앱이 완전히 동일해야 함.** 한쪽에서 7번을 추가하면 다른 쪽 화면이 깨집니다.
2. **`updatedAt` 필드는 모든 쓰기에서 갱신.** 안 그러면 `resetTs` 필터가 오작동합니다.
3. **배터리:** GPS를 너무 자주 쏘면 기사 폰이 하루를 못 버팁니다. `distanceFilter: 50`(미터) 권장.
4. **iOS 백그라운드 위치:** 앱 심사가 까다롭습니다. 심사용 설명 문구(`NSLocationAlwaysAndWhenInUseUsageDescription`)를 구체적으로 작성하세요.
5. **오프라인 대응:** Realtime DB는 `setPersistenceEnabled(true)`로 오프라인 캐시 활성화 권장.
   ```dart
   FirebaseDatabase.instance.setPersistenceEnabled(true);
   ```
6. **촬영한 사진 권한:** 갤러리에 저장하지 않고 바로 업로드만 하면 권한 관리가 쉬워집니다.

---

## 16. 참고 — 웹의 기사 화면

현재 웹에 있는 `js/views/driver.js`가 **동일 기능의 데스크톱 버전**입니다. 앱 화면을 만들 때 이 파일을 참고하면 필드, 필터, 상태 전환 흐름을 한눈에 볼 수 있습니다.

앱 출시 후에는 웹의 기사 화면을 비활성화하거나 "모바일 앱 설치 안내" 페이지로 대체할 수 있습니다.

---

## 17. 연락 & 데이터 규약 확인 체크

앱 개발 시작 전에 백엔드 개발자와 다음을 **반드시 합의**하세요:

- [ ] Firebase 프로젝트 액세스 권한 (colab/invite)
- [ ] `/drivers/{id}`의 `linkedUserId` 매핑 방식
- [ ] FCM 토큰 저장 경로 및 갱신 주기
- [ ] 회사 정확 좌표 (위도/경도) 공식 값
- [ ] Storage 이미지 파일명 규약 (`delivery-photo.jpg` 고정 vs 타임스탬프 접미)
- [ ] 주문 상태 코드표 최종 확정
- [ ] 보안 규칙 — 기사는 자기 주문만 `assignedDriverId === auth.uid` 제약 확인

---

이전 문서:
- [01-workflow-overview.md](./01-workflow-overview.md)
- [02-frontend-react.md](./02-frontend-react.md)
- [03-backend-firebase.md](./03-backend-firebase.md)

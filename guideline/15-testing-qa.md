# 15. 테스트 & QA 가이드

> **대상 독자:** Flutter 개발자, QA 담당자  
> **목표:** Unit Test, Widget Test, Integration Test 작성법과 QA 체크리스트를 정리하여 안정적인 품질을 보장

---

## 1. 테스트 피라미드

```
          ╱╲
         ╱  ╲
        ╱ E2E╲         Integration Test (10%)
       ╱ 10%  ╲        — 로그인→주문→배송 시나리오
      ╱────────╲
     ╱  Widget  ╲      Widget Test (20%)
    ╱    20%     ╲     — UI 컴포넌트 렌더링/상호작용
   ╱──────────────╲
  ╱     Unit       ╲   Unit Test (70%)
 ╱      70%         ╲  — 모델, 서비스, 유틸 로직
╱────────────────────╲
```

| 레벨 | 비중 | 대상 | 속도 |
|------|------|------|------|
| **Unit Test** | 70% | Model, Service, Util 순수 로직 | 매우 빠름 (ms) |
| **Widget Test** | 20% | UI 컴포넌트 렌더링, 사용자 상호작용 | 빠름 (수백 ms) |
| **Integration Test** | 10% | 전체 앱 시나리오 (E2E) | 느림 (초~분) |

---

## 2. Unit Test

비즈니스 로직을 검증합니다. Firebase나 UI에 의존하지 않는 순수 함수/클래스를 테스트합니다.

### 2.1 테스트 파일 구조

```
test/
├── models/
│   ├── order_test.dart
│   ├── driver_model_test.dart
│   └── product_test.dart
├── services/
│   ├── order_service_test.dart
│   └── auth_service_test.dart
├── utils/
│   └── date_utils_test.dart
└── providers/
    └── order_provider_test.dart
```

### 2.2 Model 테스트

```dart
// test/models/order_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:maydaegu_app/models/order.dart';

void main() {
  group('Order', () {
    test('Order.fromMap creates valid order', () {
      final map = {
        'chainName': '행복꽃집',
        'status': 0,
        'productName': '장미 바구니',
        'price': 50000,
        'recipientName': '김철수',
        'recipientPhone': '010-1234-5678',
        'address': '대구시 중구 동성로 1길',
        'ribbon': '축 결혼',
        'createdAt': 1700000000000,
        'createdBy': 'user1',
      };

      final order = Order.fromMap('key1', map);

      expect(order.id, 'key1');
      expect(order.chainName, '행복꽃집');
      expect(order.status, 0);
      expect(order.productName, '장미 바구니');
      expect(order.price, 50000);
      expect(order.recipientName, '김철수');
    });

    test('Order.toMap converts correctly', () {
      final order = Order(
        id: 'key1',
        chainName: '행복꽃집',
        status: 0,
        productName: '장미 바구니',
        price: 50000,
        recipientName: '김철수',
        recipientPhone: '010-1234-5678',
        address: '대구시 중구 동성로 1길',
        ribbon: '축 결혼',
        createdAt: DateTime.fromMillisecondsSinceEpoch(1700000000000),
        createdBy: 'user1',
      );

      final map = order.toMap();

      expect(map['chainName'], '행복꽃집');
      expect(map['status'], 0);
      expect(map['price'], 50000);
      expect(map.containsKey('id'), false); // id는 key로만 사용
    });

    test('Order.fromMap handles missing optional fields', () {
      final map = {
        'chainName': '행복꽃집',
        'status': 0,
        'productName': '장미 바구니',
        'price': 50000,
      };

      final order = Order.fromMap('key2', map);

      expect(order.recipientName, isNull);
      expect(order.driverName, isNull);
      expect(order.shopPhoto, isNull);
    });
  });
}
```

### 2.3 OrderStatus 테스트

```dart
// test/models/order_status_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:maydaegu_app/models/order_status.dart';

void main() {
  group('OrderStatus', () {
    test('label returns correct Korean text', () {
      expect(OrderStatus.received.label, '접수');
      expect(OrderStatus.confirmed.label, '접수확인');
      expect(OrderStatus.making.label, '제작중');
      expect(OrderStatus.made.label, '제작완료');
      expect(OrderStatus.delivering.label, '배송중');
      expect(OrderStatus.delivered.label, '배송완료');
    });

    test('color returns correct color for each status', () {
      expect(OrderStatus.received.color, Colors.grey);
      expect(OrderStatus.delivering.color, Colors.blue);
      expect(OrderStatus.delivered.color, Colors.green);
    });

    test('fromIndex returns correct status', () {
      expect(OrderStatus.fromIndex(0), OrderStatus.received);
      expect(OrderStatus.fromIndex(5), OrderStatus.delivered);
    });

    test('fromIndex throws for invalid index', () {
      expect(() => OrderStatus.fromIndex(99), throwsArgumentError);
    });
  });
}
```

### 2.4 Badge 알고리즘 테스트

```dart
// test/utils/badge_utils_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:maydaegu_app/models/driver_badge.dart';

void main() {
  group('computeBadge', () {
    test('returns idle when no active deliveries', () {
      final badge = computeBadge(
        activeDeliveries: 0,
        isReturning: false,
        isDayOff: false,
      );
      expect(badge, DriverBadge.idle);       // 배송대기
    });

    test('returns delivering when has active deliveries', () {
      final badge = computeBadge(
        activeDeliveries: 3,
        isReturning: false,
        isDayOff: false,
      );
      expect(badge, DriverBadge.delivering); // 배송중
    });

    test('returns returning when flagged', () {
      final badge = computeBadge(
        activeDeliveries: 0,
        isReturning: true,
        isDayOff: false,
      );
      expect(badge, DriverBadge.returning);  // 복귀중
    });

    test('returns dayOff regardless of other states', () {
      final badge = computeBadge(
        activeDeliveries: 5,
        isReturning: true,
        isDayOff: true,
      );
      expect(badge, DriverBadge.dayOff);     // 휴무
    });
  });
}
```

### 2.5 날짜 유틸 테스트

```dart
// test/utils/date_utils_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:maydaegu_app/utils/date_utils.dart';

void main() {
  group('DateUtils', () {
    test('formatOrderDate returns correct format', () {
      final date = DateTime(2025, 3, 15, 14, 30);
      expect(formatOrderDate(date), '2025-03-15 14:30');
    });

    test('isToday returns true for today', () {
      expect(isToday(DateTime.now()), true);
    });

    test('isToday returns false for yesterday', () {
      final yesterday = DateTime.now().subtract(Duration(days: 1));
      expect(isToday(yesterday), false);
    });

    test('formatRelativeTime returns 방금 전 for < 1 min', () {
      final now = DateTime.now();
      expect(formatRelativeTime(now), '방금 전');
    });
  });
}
```

### 2.6 테스트 실행

```bash
# 전체 Unit Test 실행
flutter test

# 특정 파일만
flutter test test/models/order_test.dart

# 커버리지 리포트
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
# 브라우저에서 coverage/html/index.html 열기
```

---

## 3. Widget Test

UI 컴포넌트가 올바르게 렌더링되고, 사용자 상호작용에 정확히 반응하는지 테스트합니다.

### 3.1 BadgeWidget 테스트

```dart
// test/widgets/badge_widget_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydaegu_app/core/widgets/badge_widget.dart';
import 'package:maydaegu_app/models/driver_badge.dart';

void main() {
  group('BadgeWidget', () {
    testWidgets('shows correct text for delivering badge', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: BadgeWidget(badge: DriverBadge.delivering),
        ),
      ));

      expect(find.text('배송중'), findsOneWidget);
    });

    testWidgets('shows correct color for idle badge', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: BadgeWidget(badge: DriverBadge.idle),
        ),
      ));

      final container = tester.widget<Container>(find.byType(Container).first);
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.color, DriverBadge.idle.color);
    });

    testWidgets('shows correct color for dayOff badge', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: BadgeWidget(badge: DriverBadge.dayOff),
        ),
      ));

      expect(find.text('휴무'), findsOneWidget);
    });
  });
}
```

### 3.2 OrderCard 테스트

```dart
// test/widgets/order_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydaegu_app/core/widgets/order_card.dart';
import 'package:maydaegu_app/models/order.dart';

void main() {
  group('OrderCard', () {
    final testOrder = Order(
      id: 'test1',
      chainName: '행복꽃집',
      status: 0,
      productName: '장미 바구니',
      price: 50000,
      recipientName: '김철수',
      recipientPhone: '010-1234-5678',
      address: '대구시 중구',
      ribbon: '축 결혼',
      createdAt: DateTime(2025, 3, 15),
      createdBy: 'user1',
    );

    testWidgets('renders chain name', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: OrderCard(order: testOrder)),
      ));

      expect(find.text('행복꽃집'), findsOneWidget);
    });

    testWidgets('renders product name and price', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: OrderCard(order: testOrder)),
      ));

      expect(find.text('장미 바구니'), findsOneWidget);
      expect(find.textContaining('50,000'), findsOneWidget);
    });

    testWidgets('shows status badge', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: OrderCard(order: testOrder)),
      ));

      expect(find.text('접수'), findsOneWidget);
    });

    testWidgets('calls onTap when tapped', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: OrderCard(
            order: testOrder,
            onTap: () => tapped = true,
          ),
        ),
      ));

      await tester.tap(find.byType(OrderCard));
      expect(tapped, true);
    });
  });
}
```

### 3.3 LoginScreen 유효성 검증 테스트

```dart
// test/screens/login_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydaegu_app/screens/login_screen.dart';

void main() {
  group('LoginScreen', () {
    testWidgets('shows error when username is empty', (tester) async {
      await tester.pumpWidget(MaterialApp(home: LoginScreen()));

      // 비밀번호만 입력
      await tester.enterText(
        find.byKey(Key('password_field')),
        'test1234',
      );

      // 로그인 버튼 클릭
      await tester.tap(find.byKey(Key('login_button')));
      await tester.pump();

      // 에러 메시지 확인
      expect(find.text('아이디를 입력해주세요'), findsOneWidget);
    });

    testWidgets('shows error when password is empty', (tester) async {
      await tester.pumpWidget(MaterialApp(home: LoginScreen()));

      // 아이디만 입력
      await tester.enterText(
        find.byKey(Key('username_field')),
        'testuser',
      );

      await tester.tap(find.byKey(Key('login_button')));
      await tester.pump();

      expect(find.text('비밀번호를 입력해주세요'), findsOneWidget);
    });

    testWidgets('login button is enabled with both fields filled', (tester) async {
      await tester.pumpWidget(MaterialApp(home: LoginScreen()));

      await tester.enterText(find.byKey(Key('username_field')), 'testuser');
      await tester.enterText(find.byKey(Key('password_field')), 'test1234');
      await tester.pump();

      final button = tester.widget<ElevatedButton>(
        find.byKey(Key('login_button')),
      );
      expect(button.onPressed, isNotNull);
    });
  });
}
```

---

## 4. Integration Test

앱 전체를 실행하여 실제 사용자 시나리오를 검증합니다.

### 4.1 폴더 구조

```
integration_test/
├── app_test.dart                  # 진입점
├── scenarios/
│   ├── login_flow_test.dart       # 로그인 시나리오
│   ├── order_flow_test.dart       # 주문 접수→배정→배송 E2E
│   └── admin_flow_test.dart       # 관리자 CRUD 시나리오
└── helpers/
    └── test_helpers.dart          # 공통 헬퍼
```

### 4.2 E2E 시나리오: 주문 접수 → 기사 배정 → 배송 완료

```dart
// integration_test/scenarios/order_flow_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:maydaegu_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('주문 E2E 시나리오', () {
    testWidgets('주문 접수 → 기사 배정 → 배송 완료', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // === 1. floor2로 로그인 ===
      await tester.enterText(find.byKey(Key('username_field')), 'floor2_user');
      await tester.enterText(find.byKey(Key('password_field')), 'test1234');
      await tester.tap(find.byKey(Key('login_button')));
      await tester.pumpAndSettle();

      // === 2. 신규 주문 접수 ===
      await tester.tap(find.text('신규 접수'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(Key('chain_name_field')), '테스트꽃집');
      await tester.enterText(find.byKey(Key('recipient_field')), '홍길동');
      await tester.enterText(find.byKey(Key('address_field')), '대구시 중구 테스트길 1');
      // ... 나머지 필드 입력

      await tester.tap(find.text('접수'));
      await tester.pumpAndSettle();

      // 접수 완료 토스트 확인
      expect(find.text('주문이 접수되었습니다'), findsOneWidget);

      // === 3. floor1으로 전환하여 기사 배정 ===
      // (실제 E2E에서는 로그아웃 → floor1 로그인)
      // ...

      // === 4. driver로 전환하여 배송 완료 ===
      // ...
    });
  });
}
```

### 4.3 실행

```bash
# Web에서 Integration Test
flutter test integration_test --platform chrome

# Android 실기기에서 Integration Test
flutter test integration_test -d <device_id>

# 모든 디바이스에서 실행
flutter test integration_test
```

---

## 5. Firebase 에뮬레이터 활용

테스트 시 실제 Firebase를 사용하면 데이터가 오염되고 비용이 발생합니다. 로컬 에뮬레이터를 사용합니다.

### 5.1 에뮬레이터 설치 & 실행

```bash
# Firebase 에뮬레이터 초기화 (최초 1회)
firebase init emulators
# 선택: Authentication, Realtime Database, Storage

# 에뮬레이터 시작
firebase emulators:start

# 결과:
# ┌──────────────────────────────────────────────┐
# │ Emulator       │ Host:Port                    │
# ├──────────────────────────────────────────────┤
# │ Authentication │ localhost:9099               │
# │ Realtime DB    │ localhost:9000               │
# │ Storage        │ localhost:9199               │
# │ Emulator UI    │ localhost:4000               │
# └──────────────────────────────────────────────┘
```

### 5.2 Flutter에서 에뮬레이터 연결

```dart
// lib/main.dart
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:firebase_storage/firebase_storage.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // 디버그 모드에서만 에뮬레이터 사용
  if (kDebugMode) {
    // Auth 에뮬레이터
    await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);

    // Realtime Database 에뮬레이터
    FirebaseDatabase.instance.useDatabaseEmulator('localhost', 9000);

    // Storage 에뮬레이터
    await FirebaseStorage.instance.useStorageEmulator('localhost', 9199);

    debugPrint('Firebase Emulators connected');
  }

  runApp(MyApp());
}
```

### 5.3 에뮬레이터용 시드 데이터

```json
// firebase-emulator-data/database_export.json
{
  "users": {
    "test_floor2": {
      "name": "테스트 수주",
      "role": "floor2"
    },
    "test_floor1": {
      "name": "테스트 제작",
      "role": "floor1"
    },
    "test_driver": {
      "name": "테스트 기사",
      "role": "driver"
    },
    "test_admin": {
      "name": "테스트 관리자",
      "role": "admin"
    }
  },
  "products": {
    "prod1": {
      "name": "장미 바구니",
      "price": 50000,
      "category": "바구니"
    }
  }
}
```

```bash
# 시드 데이터로 에뮬레이터 시작
firebase emulators:start --import=./firebase-emulator-data
```

---

## 6. QA 체크리스트 (플랫폼별)

### 6.1 Web (Chrome, Safari, Edge)

#### 공통 기능

- [ ] 로그인 / 로그아웃 정상 동작
- [ ] 역할별 화면 접근 제한 (floor2 사용자가 admin 화면 접근 불가)
- [ ] 주문 CRUD (접수, 조회, 수정, 상태변경)
- [ ] 실시간 채팅 (메시지 송수신, 스크롤)
- [ ] 실시간 데이터 동기화 (다른 탭에서 변경 시 즉시 반영)

#### 반응형 레이아웃

- [ ] 1920x1080 (Full HD) — 사이드바 + 메인 + 채팅 패널 3단
- [ ] 1440x900 (노트북) — 사이드바 + 메인 2단
- [ ] 1024x768 (태블릿 가로) — 축소된 사이드바
- [ ] 768x1024 (태블릿 세로) — Drawer 네비게이션
- [ ] 360x800 (모바일) — 바텀 네비게이션 또는 Drawer

#### 브라우저별

- [ ] Chrome 최신 — 정상 동작
- [ ] Safari 최신 (macOS/iOS) — 정상 동작
- [ ] Edge 최신 — 정상 동작
- [ ] Firefox 최신 — 정상 동작 (canvaskit 호환)

### 6.2 Android (API 24+)

#### 설치 & 기본

- [ ] APK 설치 정상 완료
- [ ] 앱 아이콘 & 스플래시 화면 표시
- [ ] 로그인 / 로그아웃
- [ ] 역할별 화면 전환

#### 네이티브 기능

- [ ] 카메라 촬영 (배송 완료 사진)
- [ ] 갤러리에서 사진 선택
- [ ] GPS 위치 수집 (foreground)
- [ ] 백그라운드 위치 수집 (배송 중)
- [ ] 푸시 알림 수신 (FCM)
- [ ] 앱 백그라운드 → 포그라운드 전환 시 데이터 동기화

#### 기기별

- [ ] Android 7 (API 24) — 최소 지원 버전
- [ ] Android 12 (API 31) — Splash Screen API
- [ ] Android 13+ (API 33) — 알림 권한
- [ ] 저사양 기기 (RAM 2GB) — 성능 확인

### 6.3 iOS (14+)

#### 설치 & 기본

- [ ] Xcode 시뮬레이터에서 정상 실행
- [ ] 실기기 (iPhone) 설치 및 실행
- [ ] 앱 아이콘 & 스플래시 화면 표시
- [ ] 로그인 / 로그아웃

#### 권한 & 네이티브

- [ ] 카메라 권한 요청 팝업 표시 및 동작
- [ ] 위치 권한 — "앱 사용 중" (foreground)
- [ ] 위치 권한 — "항상 허용" (background)
- [ ] 푸시 알림 권한 요청 및 수신 (APNs + FCM)
- [ ] 권한 거부 시 안내 메시지 표시

#### 기기별

- [ ] iPhone SE (작은 화면) — 레이아웃 깨지지 않음
- [ ] iPhone 15 Pro (노치/Dynamic Island) — Safe Area 정상
- [ ] iPad — 반응형 레이아웃

---

## 7. 접근성 테스트

### 7.1 Semantics 확인

```dart
// 모든 인터랙티브 위젯에 Semantics 적용 확인
Semantics(
  label: '주문 접수 버튼',
  button: true,
  child: ElevatedButton(
    onPressed: _submitOrder,
    child: Text('접수'),
  ),
)

// 이미지에 대체 텍스트
Semantics(
  label: '배송 완료 사진',
  image: true,
  child: Image.network(photoUrl),
)
```

### 7.2 색상 대비

WCAG AA 기준 (최소 대비 비율):

| 요소 | 최소 대비 | 확인 방법 |
|------|----------|----------|
| 일반 텍스트 | 4.5:1 | Chrome DevTools > Rendering > CSS Overview |
| 큰 텍스트 (18pt+) | 3:1 | 동일 |
| UI 컴포넌트 | 3:1 | 버튼, 아이콘, 입력 필드 테두리 |

```dart
// 색상 대비 검증 테스트
test('primary color has sufficient contrast with white', () {
  const primary = Color(0xFF2196F3);
  const white = Color(0xFFFFFFFF);

  // 상대 휘도 계산
  final contrastRatio = _calculateContrast(primary, white);
  expect(contrastRatio, greaterThanOrEqualTo(4.5));
});
```

### 7.3 화면 리더 호환

- [ ] Android TalkBack으로 전체 화면 탐색 가능
- [ ] iOS VoiceOver로 전체 화면 탐색 가능
- [ ] 포커스 순서가 논리적 (위→아래, 좌→우)
- [ ] 버튼/링크에 의미 있는 라벨 부여

---

## 8. 성능 테스트

### 8.1 DevTools 활용

```bash
# DevTools 실행 (디버그 모드에서)
flutter run --profile
# DevTools URL이 출력됨 → 브라우저에서 접속
```

| 탭 | 확인 항목 |
|-----|----------|
| **Performance** | 프레임 드롭, jank 여부 (60fps 유지) |
| **Memory** | 메모리 누수 (리스너 해제 누락) |
| **Network** | Firebase 요청 횟수 및 응답 시간 |
| **Widget Inspector** | 불필요한 리빌드 감지 |

### 8.2 대량 데이터 테스트

실제 운영 데이터와 비슷한 규모로 테스트합니다.

| 시나리오 | 목표 | 측정 방법 |
|----------|------|----------|
| 주문 200건 목록 렌더링 | 초기 로드 < 2초, 스크롤 60fps | DevTools Performance |
| 주문 500건 목록 스크롤 | 프레임 드롭 없음 | DevTools Performance |
| 채팅 1000개 메시지 | 스크롤 끊김 없음 | 체감 측정 |
| 동시 접속 10명 | Firebase 동시 연결 제한 확인 | Firebase Console |

```dart
// 대량 데이터 시드 (테스트용)
Future<void> seedTestOrders(int count) async {
  final ref = FirebaseDatabase.instance.ref('orders');
  for (int i = 0; i < count; i++) {
    await ref.push().set({
      'chainName': '테스트꽃집 $i',
      'status': i % 6,
      'productName': '장미 바구니',
      'price': 50000 + (i * 1000),
      'createdAt': ServerValue.timestamp,
    });
  }
}
```

### 8.3 Firebase 읽기/쓰기 모니터링

```
Firebase Console > Realtime Database > Usage 탭

모니터링 항목:
- 동시 연결 수 (Spark 무료: 100개 제한)
- 다운로드 대역폭 (월 10GB 제한)
- 저장 용량 (1GB 제한)
```

### 8.4 리스트 성능 최적화

```dart
// 나쁜 예: 전체 리스트를 한번에 빌드
ListView(
  children: orders.map((o) => OrderCard(order: o)).toList(),
)

// 좋은 예: 화면에 보이는 것만 빌드 (lazy)
ListView.builder(
  itemCount: orders.length,
  itemBuilder: (context, index) => OrderCard(order: orders[index]),
)

// 더 좋은 예: 스크롤 방향으로 캐싱
ListView.builder(
  itemCount: orders.length,
  cacheExtent: 500,  // 화면 밖 500px까지 미리 빌드
  itemBuilder: (context, index) => OrderCard(order: orders[index]),
)
```

---

## 9. 버그 리포트 템플릿

버그 발견 시 다음 형식으로 기록합니다.

```markdown
## 버그 설명

주문 접수 화면에서 상품 선택 드롭다운이 열리지 않음

## 재현 순서

1. floor2 계정으로 로그인
2. "신규 접수" 메뉴 클릭
3. "상품 선택" 드롭다운 클릭
4. 드롭다운 목록이 표시되지 않음

## 예상 동작

상품 목록이 드롭다운으로 표시되어야 함

## 실제 동작

드롭다운 클릭 시 아무 반응 없음. 콘솔에 `RangeError` 표시

## 스크린샷

(해당 스크린샷 첨부)

## 환경

- **OS:** Android 13 / Chrome 121
- **기기:** Galaxy S23 / MacBook Pro 16"
- **Flutter 버전:** 3.19.0
- **앱 버전:** 1.0.2 (build 5)
- **발생 빈도:** 항상 재현
```

### 버그 심각도 기준

| 등급 | 설명 | 예시 | 대응 |
|------|------|------|------|
| **Critical** | 앱 사용 불가 | 로그인 불가, 크래시 | 즉시 수정 |
| **Major** | 핵심 기능 장애 | 주문 접수 불가, 배정 실패 | 당일 수정 |
| **Minor** | 부가 기능 장애 | 통계 수치 오류, 정렬 버그 | 다음 릴리스 |
| **Cosmetic** | 외관 문제 | 글자 잘림, 아이콘 미정렬 | 우선순위 낮음 |

---

## 10. 테스트 자동화 (CI 연동)

### GitHub Actions에서 테스트 실행

```yaml
# .github/workflows/test.yml
name: Run Tests

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Flutter
        uses: subosher/flutter-action@v2
        with:
          flutter-version: '3.19.0'
          channel: 'stable'

      - name: Install dependencies
        run: flutter pub get

      - name: Analyze code
        run: flutter analyze

      - name: Run unit & widget tests
        run: flutter test --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: coverage/lcov.info
```

### 커버리지 목표

| 영역 | 목표 커버리지 | 비고 |
|------|-------------|------|
| Models | 90%+ | fromMap/toMap 필수 |
| Services | 80%+ | Mock Firebase 사용 |
| Providers | 80%+ | Riverpod 테스트 유틸 |
| Widgets | 60%+ | 주요 컴포넌트만 |
| Screens | 50%+ | Integration으로 보완 |
| **전체** | **70%+** | |

---

## 11. 요약: 테스트 작성 우선순위

시간이 부족할 때 어디부터 테스트를 작성할지 우선순위입니다.

```
1순위  Order.fromMap / toMap        ← 데이터 변환 오류 = 전체 장애
2순위  OrderStatus.label / color    ← 상태 표시 오류 = 혼란
3순위  computeBadge 알고리즘        ← 기사 뱃지 잘못 표시
4순위  LoginScreen 유효성 검증      ← 사용자 첫 화면
5순위  OrderCard 렌더링             ← 가장 많이 보는 컴포넌트
6순위  주문 E2E 시나리오            ← 핵심 비즈니스 플로우
```

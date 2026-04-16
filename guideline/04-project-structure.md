# 04. 프로젝트 구조 및 코드 컨벤션

> **대상 독자:** Flutter 앱 개발에 참여하는 모든 개발자 (초급~중급)
> **목표:** 메이대구 Flutter 통합 앱(`maydaegu_app`)의 폴더 구조, 파일 네이밍, 코드 스타일을 통일하여 팀 전체가 일관된 코드를 작성

---

## 1. 프로젝트 개요

기존 Vanilla JS + HTML + CSS 웹 프로토타입을 **Flutter 단일 코드베이스**로 전환합니다.

| 항목 | 내용 |
|------|------|
| 앱 이름 | `maydaegu_app` |
| 지원 플랫폼 | Web, Android, iOS |
| 언어 | Dart 3.x |
| Flutter 버전 | 3.19+ |
| 상태 관리 | Riverpod (flutter_riverpod) |
| 라우팅 | GoRouter (go_router) |
| 백엔드 | Firebase (Realtime DB, Storage, Auth, Cloud Functions) |

### 4가지 사용자 역할

| 역할 | 코드 | 주 사용 플랫폼 |
|------|------|----------------|
| 2층 수주 | `floor2` | Web |
| 1층 제작 | `floor1` | Web |
| 배송 기사 | `driver` | Android / iOS |
| 관리자 | `admin` | Web |

---

## 2. 폴더 구조 상세

```
maydaegu_app/
├── lib/
│   ├── main.dart                       # 앱 진입점 (Firebase 초기화 + ProviderScope)
│   ├── app.dart                        # MaterialApp + GoRouter 설정
│   ├── firebase_options.dart           # flutterfire configure 자동 생성
│   │
│   ├── core/                           # 앱 전역 공통 요소
│   │   ├── constants/
│   │   │   ├── app_colors.dart         # 테마 색상 (CSS var(--primary) 등 매핑)
│   │   │   ├── app_text_styles.dart    # 공통 텍스트 스타일
│   │   │   ├── order_status.dart       # 주문 상태 코드 상수 (0~6)
│   │   │   └── breakpoints.dart        # 반응형 브레이크포인트
│   │   ├── theme/
│   │   │   └── app_theme.dart          # light/dark ThemeData
│   │   ├── utils/
│   │   │   ├── date_utils.dart         # 날짜 포매팅 헬퍼
│   │   │   ├── validators.dart         # 폼 유효성 검사
│   │   │   └── extensions.dart         # Dart 확장 메서드
│   │   └── widgets/                    # 앱 전역 재사용 위젯
│   │       ├── app_button.dart         # 공통 버튼
│   │       ├── app_modal.dart          # 모달 다이얼로그
│   │       ├── app_toast.dart          # 토스트 알림
│   │       ├── badge_widget.dart       # 상태 뱃지
│   │       ├── loading_overlay.dart    # 로딩 오버레이
│   │       └── responsive_builder.dart # 반응형 레이아웃 빌더
│   │
│   ├── models/                         # 데이터 모델 (Freezed 또는 수동)
│   │   ├── order.dart                  # 주문
│   │   ├── user.dart                   # 사용자 (세션 포함)
│   │   ├── driver.dart                 # 배송 기사
│   │   ├── product.dart                # 상품
│   │   ├── category.dart               # 상품 카테고리
│   │   └── chat_message.dart           # 채팅 메시지
│   │
│   ├── providers/                      # Riverpod providers
│   │   ├── auth_provider.dart          # 인증 상태 (세션)
│   │   ├── order_provider.dart         # 주문 실시간 구독
│   │   ├── driver_provider.dart        # 기사 목록/상태
│   │   ├── product_provider.dart       # 상품/카테고리
│   │   ├── chat_provider.dart          # 채팅 메시지 스트림
│   │   └── location_provider.dart      # GPS 위치 스트림
│   │
│   ├── services/                       # Firebase 및 외부 서비스 래퍼
│   │   ├── auth_service.dart           # Firebase Auth CRUD
│   │   ├── order_service.dart          # /orders CRUD
│   │   ├── driver_service.dart         # /drivers, /driverStatus CRUD
│   │   ├── product_service.dart        # /products, /categories CRUD
│   │   ├── chat_service.dart           # /messages 실시간 읽기/쓰기
│   │   ├── storage_service.dart        # Cloud Storage 업로드/다운로드
│   │   ├── location_service.dart       # GPS + 회사 반경 감지
│   │   └── notification_service.dart   # FCM 푸시 알림
│   │
│   ├── screens/                        # 페이지(화면) 위젯
│   │   ├── login_screen.dart           # 로그인
│   │   ├── shell_screen.dart           # 메인 레이아웃 (사이드바 + 메인 + 패널)
│   │   ├── floor2/                     # 2층 수주 화면
│   │   │   ├── my_orders_screen.dart
│   │   │   └── new_order_screen.dart
│   │   ├── floor1/                     # 1층 제작 화면
│   │   │   └── all_orders_screen.dart
│   │   ├── driver/                     # 배송 기사 화면
│   │   │   ├── my_deliveries_screen.dart
│   │   │   └── order_detail_screen.dart
│   │   └── admin/                      # 관리자 화면
│   │       ├── admin_orders_screen.dart
│   │       ├── manage_products_screen.dart
│   │       ├── manage_drivers_screen.dart
│   │       └── statistics_screen.dart
│   │
│   └── widgets/                        # 화면별 전용 위젯 (재사용 범위 제한)
│       ├── order/
│       │   ├── order_card.dart
│       │   ├── order_form.dart
│       │   ├── order_filter_bar.dart
│       │   └── assign_driver_modal.dart
│       ├── chat/
│       │   ├── chat_panel.dart
│       │   ├── chat_bubble.dart
│       │   └── chat_input.dart
│       ├── delivery_panel/
│       │   ├── delivery_panel.dart
│       │   ├── driver_status_card.dart
│       │   └── progress_bar.dart
│       └── sidebar/
│           ├── sidebar.dart
│           └── nav_item.dart
│
├── web/                                # Flutter Web 진입점
├── android/                            # Android 네이티브 설정
├── ios/                                # iOS 네이티브 설정
├── test/                               # 유닛/위젯 테스트
│   ├── models/
│   ├── providers/
│   ├── services/
│   └── widgets/
├── integration_test/                   # 통합 테스트
├── assets/                             # 이미지, 폰트 등 정적 리소스
│   ├── images/
│   └── fonts/
├── pubspec.yaml                        # 의존성 관리
├── analysis_options.yaml               # 린트 규칙
└── .env.example                        # 환경 변수 템플릿 (커밋 대상)
```

### 폴더 역할 구분

| 폴더 | 역할 | 예시 |
|------|------|------|
| `core/constants/` | 변하지 않는 상수값 | 색상, 주문 상태 코드, 브레이크포인트 |
| `core/widgets/` | 2개 이상 화면에서 재사용 | `AppButton`, `AppModal` |
| `models/` | 순수 데이터 클래스 (로직 없음) | `Order`, `User` |
| `providers/` | 상태 관리 (Riverpod) | `orderProvider`, `authProvider` |
| `services/` | Firebase/외부 API 호출 | `OrderService.create()` |
| `screens/` | 전체 페이지 위젯 | `LoginScreen`, `MyOrdersScreen` |
| `widgets/` (루트) | 특정 기능 전용 위젯 | `OrderCard`, `ChatBubble` |

---

## 3. 핵심 파일 예시

### `lib/core/constants/app_colors.dart`

현재 CSS `base.css`의 `:root` 변수를 Dart 상수로 1:1 매핑합니다.

```dart
import 'package:flutter/material.dart';

/// CSS var(--primary) 등을 Flutter Color로 매핑.
/// 기존 웹과 동일한 색상 톤을 유지합니다.
abstract final class AppColors {
  // Brand
  static const primary      = Color(0xFF2563EB);
  static const primaryHover = Color(0xFF1D4ED8);
  static const primaryLight = Color(0xFF3B82F6);
  static const primaryDim   = Color(0x142563EB); // rgba(37,99,235,0.08)

  // Background — Light
  static const bgBase     = Color(0xFFF1F5F9);
  static const bgSurface  = Color(0xFFFFFFFF);
  static const bgElevated = Color(0xFFF8FAFC);
  static const bgCard     = Color(0xFFFFFFFF);
  static const bgInput    = Color(0xFFFFFFFF);

  // Text
  static const textPrimary   = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF475569);
  static const textMuted     = Color(0xFF94A3B8);

  // Border
  static const border       = Color(0xFFE2E8F0);
  static const borderStrong = Color(0xFFCBD5E1);

  // Semantic
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFD97706);
  static const error   = Color(0xFFDC2626);
  static const info    = Color(0xFF0284C7);

  // Status badge colours
  static const s0Bg = Color(0xFFF1F5F9); static const s0Fg = Color(0xFF475569);
  static const s1Bg = Color(0xFFEFF6FF); static const s1Fg = Color(0xFF2563EB);
  static const s2Bg = Color(0xFFF5F3FF); static const s2Fg = Color(0xFF7C3AED);
  static const s3Bg = Color(0xFFFFFBEB); static const s3Fg = Color(0xFFD97706);
  static const s4Bg = Color(0xFFF0FDF4); static const s4Fg = Color(0xFF16A34A);
  static const s5Bg = Color(0xFFFEF2F2); static const s5Fg = Color(0xFFDC2626);
  static const s6Bg = Color(0xFFFFF7ED); static const s6Fg = Color(0xFFEA580C);
}
```

### `lib/core/constants/order_status.dart`

```dart
/// 주문 상태 코드 — 웹/앱 공통 규약. 절대 변경 금지.
/// 0,1,2 = 주문접수 / 3 = 배송중 / 4 = 배송완료 / 5,6 = 주문취소
abstract final class OrderStatus {
  static const int received   = 0;
  static const int confirmed  = 1;
  static const int producing  = 2;
  static const int delivering = 3;
  static const int completed  = 4;
  static const int cancelledA = 5;
  static const int cancelledB = 6;

  /// 접수 상태인지 (0, 1, 2)
  static bool isReceived(int s) => s >= 0 && s <= 2;

  /// 취소 상태인지 (5, 6)
  static bool isCancelled(int s) => s == 5 || s == 6;

  /// 상태 코드 → 한글 라벨
  static String label(int s) => switch (s) {
    0 => '주문접수',
    1 => '확인완료',
    2 => '제작중',
    3 => '배송중',
    4 => '배송완료',
    5 => '주문취소',
    6 => '반품',
    _ => '알 수 없음',
  };
}
```

### `lib/core/constants/breakpoints.dart`

```dart
/// 반응형 브레이크포인트.
/// 웹에서는 데스크톱 레이아웃, 모바일에서는 단일 칼럼.
abstract final class Breakpoints {
  static const double mobile  = 640;
  static const double tablet  = 1024;
  static const double desktop = 1280;

  static const double sidebarWidth      = 240;
  static const double chatPanelWidth    = 340;
  static const double deliveryPanelWidth = 360;
}
```

---

## 4. 파일 네이밍 규칙

### 파일/폴더: `snake_case`

```
my_orders_screen.dart      (O)
MyOrdersScreen.dart        (X)
myOrdersScreen.dart        (X)
my-orders-screen.dart      (X)
```

### 클래스: `PascalCase`

```dart
class MyOrdersScreen extends ConsumerWidget { ... }
class OrderService { ... }
class AppColors { ... }
```

### 변수/함수: `camelCase`

```dart
final orderList = <Order>[];
void fetchOrders() { ... }
final isLoading = StateProvider<bool>((ref) => false);
```

### 상수: `camelCase` 또는 `SCREAMING_SNAKE_CASE`

```dart
// Dart 관례상 camelCase 권장
const maxRetries = 3;
const defaultPageSize = 20;

// 상태 코드처럼 팀 규약으로 고정된 값은 클래스 상수 사용
abstract final class OrderStatus {
  static const int received = 0;
}
```

### Riverpod Provider: `camelCase` + `Provider` 접미사

```dart
final authProvider = ...;
final orderListProvider = ...;
final myOrdersProvider = ...;
```

---

## 5. import 순서 규칙

Dart 공식 스타일 가이드를 따릅니다. 각 그룹 사이에 빈 줄 하나를 넣습니다.

```dart
// 1. dart: 내장 라이브러리
import 'dart:async';
import 'dart:io';

// 2. package: 외부 패키지 (알파벳순)
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

// 3. 프로젝트 내부 (package:maydaegu_app/ 또는 상대 경로)
import 'package:maydaegu_app/core/constants/order_status.dart';
import 'package:maydaegu_app/models/order.dart';
import 'package:maydaegu_app/providers/order_provider.dart';
```

**규칙:**
- 절대 경로(`package:maydaegu_app/...`) 사용 권장 (상대 경로 `../` 보다 명확)
- `dart:` > `package:` > 프로젝트 내부 순서 고정
- 각 그룹 내에서 알파벳순 정렬
- `export` 구문은 `import` 뒤에 별도 그룹으로 배치

---

## 6. 파일당 하나의 public 클래스 원칙

```dart
// order.dart — 하나의 public 클래스만 포함
class Order {
  final String id;
  final String chainName;
  // ...
}

// 같은 파일에 private 헬퍼는 허용
String _formatOrderId(String id) => '#${id.substring(0, 6)}';
```

**예외:**
- 밀접하게 관련된 작은 enum/typedef는 같은 파일에 허용

```dart
// order.dart
enum OrderSortField { createdAt, deliveryDatetime, status }

class Order { ... }
```

---

## 7. Dart 코드 포매팅

### 자동 포매터 사용

```bash
# 전체 프로젝트 포매팅
dart format .

# 특정 파일
dart format lib/models/order.dart
```

### 줄 길이: 80자

`analysis_options.yaml`에 설정:

```yaml
analyzer:
  language:
    strict-casts: true
    strict-raw-types: true

linter:
  rules:
    - prefer_const_constructors
    - prefer_const_declarations
    - prefer_final_locals
    - avoid_print
    - always_declare_return_types
    - annotate_overrides
    - prefer_single_quotes
    - sort_child_properties_last
    - use_key_in_widget_constructors
    - sized_box_for_whitespace
    - avoid_unnecessary_containers
```

### trailing comma 필수

위젯 트리에서 trailing comma를 붙이면 `dart format`이 자동으로 줄바꿈합니다.

```dart
// Good — trailing comma 있음
Container(
  padding: const EdgeInsets.all(16),
  child: const Text('hello'),  // <-- trailing comma
)

// Bad — 한 줄로 뭉개짐
Container(padding: const EdgeInsets.all(16), child: const Text('hello'))
```

---

## 8. 주석 규칙

### `///` Doc comment — public API에 필수

```dart
/// 주문 데이터를 Firebase Realtime DB에서 실시간 구독합니다.
///
/// [driverId]가 지정되면 해당 기사에게 배정된 주문만 필터합니다.
/// `null`이면 전체 주문을 반환합니다.
final orderListProvider = StreamProvider.family<List<Order>, String?>(...);
```

### `//` 인라인 주석 — 복잡한 로직에만

```dart
// 100m 이내 진입 시 배송대기로 자동 전환
if (distance <= returnRadius) {
  update['resetTs'] = DateTime.now().toIso8601String();
}
```

### `TODO` / `FIXME` 태그

```dart
// TODO(dohoon): 오프라인 캐시 구현 후 제거
// FIXME: iOS에서 백그라운드 위치 권한 누락 시 크래시 발생
```

---

## 9. 권장 pubspec.yaml

```yaml
name: maydaegu_app
description: 메이대구 꽃집 주문-배송 관리 시스템 (통합 앱)
version: 1.0.0+1

environment:
  sdk: '>=3.3.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # Firebase
  firebase_core: ^2.27.0
  firebase_auth: ^4.17.0
  firebase_database: ^10.4.0
  firebase_storage: ^11.6.0
  firebase_messaging: ^14.7.0

  # State Management
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0

  # Routing
  go_router: ^13.2.0

  # UI
  intl: ^0.19.0
  cached_network_image: ^3.3.1
  flutter_svg: ^2.0.10

  # Device Features
  geolocator: ^11.0.0
  image_picker: ^1.0.7
  permission_handler: ^11.3.0
  url_launcher: ^6.2.0

  # Utilities
  shared_preferences: ^2.2.2
  connectivity_plus: ^6.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
  riverpod_generator: ^2.4.0
  build_runner: ^2.4.0
  mockito: ^5.4.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
```

---

## 10. 라우팅 매핑 (GoRouter)

현재 Vanilla JS 해시 라우트를 GoRouter 경로로 매핑합니다.

| 현재 (Vanilla JS) | Flutter GoRouter | 접근 가능 역할 |
|-------------------|------------------|---------------|
| `index.html` | `/login` | 전체 |
| `#my-orders` | `/floor2/my-orders` | floor2 |
| `#new-order` | `/floor2/new-order` | floor2, admin |
| `#all-orders` | `/floor1/all-orders` | floor1, admin |
| `#my-deliveries` | `/driver/my-deliveries` | driver |
| `#manage-products` | `/admin/products` | admin |
| `#manage-drivers` | `/admin/drivers` | admin |
| `#statistics` | `/admin/statistics` | admin |

### `app.dart` 라우터 구조 예시

```dart
final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final loggedIn = auth.session != null;
      final isLoginRoute = state.matchedLocation == '/login';

      if (!loggedIn && !isLoginRoute) return '/login';
      if (loggedIn && isLoginRoute) {
        return _defaultRouteForRole(auth.session!.role);
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (_, __, child) => ShellScreen(child: child),
        routes: [
          GoRoute(path: '/floor2/my-orders', ...),
          GoRoute(path: '/floor2/new-order', ...),
          GoRoute(path: '/floor1/all-orders', ...),
          GoRoute(path: '/driver/my-deliveries', ...),
          GoRoute(path: '/admin/products', ...),
          GoRoute(path: '/admin/drivers', ...),
          GoRoute(path: '/admin/statistics', ...),
        ],
      ),
    ],
  );
});

String _defaultRouteForRole(String role) => switch (role) {
  'floor2' => '/floor2/my-orders',
  'floor1' => '/floor1/all-orders',
  'driver' => '/driver/my-deliveries',
  'admin'  => '/floor1/all-orders',
  _        => '/login',
};
```

---

## 11. 코드 품질 체크리스트

개발 시 매번 확인:

- [ ] `dart format .` 실행 후 변경 없음
- [ ] `dart analyze` 경고 0건
- [ ] 모든 public 클래스/메서드에 `///` doc comment 작성
- [ ] import 순서: `dart:` > `package:` > 프로젝트 내부
- [ ] 파일당 public 클래스 1개
- [ ] 상태 코드(0~6) 직접 숫자 사용 금지 — `OrderStatus.received` 등 상수 사용
- [ ] `print()` 대신 `debugPrint()` 또는 로깅 라이브러리 사용
- [ ] `const` 생성자 사용 가능한 곳에 `const` 명시

---

## 12. Git 브랜치 전략

```
main                    ← 배포 가능 상태
├── develop             ← 개발 통합 브랜치
│   ├── feature/login   ← 기능 단위 브랜치
│   ├── feature/orders
│   ├── feature/chat
│   └── fix/camera-crash
└── release/1.0.0       ← 배포 준비
```

### 커밋 메시지 규칙

```
feat(orders): 신규 주문 접수 화면 구현
fix(driver): 배송 완료 사진 업로드 실패 수정
refactor(auth): AuthService 싱글톤 → Riverpod provider 전환
docs(guideline): Flutter 프로젝트 구조 가이드 추가
test(models): Order.fromMap 유닛 테스트 추가
```

---

## 13. 현재 웹 파일 → Flutter 파일 매핑 참고표

| Vanilla JS 파일 | Flutter 대응 | 비고 |
|-----------------|-------------|------|
| `js/store.js` | `services/*.dart` + `providers/*.dart` | localStorage → Firebase |
| `js/auth.js` | `services/auth_service.dart` + `providers/auth_provider.dart` | 세션 관리 |
| `js/router.js` | `app.dart` (GoRouter) | 해시 → 경로 |
| `js/chat.js` | `services/chat_service.dart` + `widgets/chat/` | 이미 Firebase 사용 |
| `js/ui.js` | `core/widgets/app_toast.dart`, `app_modal.dart` | Toast, Modal |
| `js/views/login.js` | `screens/login_screen.dart` | |
| `js/views/floor2.js` | `screens/floor2/*.dart` | |
| `js/views/floor1.js` | `screens/floor1/*.dart` | 가장 큰 파일 |
| `js/views/driver.js` | `screens/driver/*.dart` | |
| `js/views/admin.js` | `screens/admin/*.dart` | |
| `css/base.css` | `core/constants/app_colors.dart` + `core/theme/app_theme.dart` | CSS 변수 매핑 |

---

다음 문서: [05-firebase-backend.md](./05-firebase-backend.md) -- Firebase 백엔드 가이드

# 02. 시스템 아키텍처

> **대상 독자:** Flutter 통합 프로젝트의 전체 구조를 이해하고 싶은 개발자  
> **목표:** 시스템 구성도, 레이어 구조, 반응형 전략, 데이터 흐름을 한눈에 파악

---

## 1. 전체 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Flutter App (단일 코드베이스)                   │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  Flutter Web     │  │ Flutter Android  │  │  Flutter iOS        │  │
│  │                 │  │                 │  │                     │  │
│  │  - 2층 수주      │  │  - 배송 기사 앱   │  │  - 배송 기사 앱      │  │
│  │  - 1층 제작      │  │  - GPS 추적      │  │  - GPS 추적         │  │
│  │  - 관리자 대시보드 │  │  - 카메라 촬영    │  │  - 카메라 촬영       │  │
│  │  - (기사도 가능)  │  │  - 푸시 알림      │  │  - 푸시 알림        │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                      │             │
└───────────┼────────────────────┼──────────────────────┼─────────────┘
            │                    │                      │
            └────────────────────┼──────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Firebase (asia-southeast1)                       │
│                    Project: mayflower-5c9dd                          │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Realtime DB      │  │  Storage     │  │  Authentication      │  │
│  │                  │  │              │  │                      │  │
│  │  /orders         │  │  /orders/    │  │  Email + Password    │  │
│  │  /users          │  │    {id}/     │  │  Custom Claims       │  │
│  │  /drivers        │  │    photo.jpg │  │  (role 정보)         │  │
│  │  /products       │  │              │  │                      │  │
│  │  /messages       │  │  /profiles/  │  │                      │  │
│  │  /driverStatus   │  │    {uid}.jpg │  │                      │  │
│  └──────────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Cloud Functions (선택)                                       │   │
│  │  - 푸시 알림 전송 (배차 시 기사에게 FCM)                         │   │
│  │  - 통계 집계 (일별/월별 자동 계산)                               │   │
│  │  - Auth 트리거 (신규 사용자 생성 시 /users/{uid} 자동 작성)       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 플랫폼별 사용 시나리오

| 사용자 | 주 사용 플랫폼 | 이유 |
|--------|----------------|------|
| 2층 수주 담당 | **Flutter Web** | 사무실 PC에서 주문 입력 (키보드 + 큰 화면) |
| 1층 제작 담당 | **Flutter Web** | 사무실/작업대 옆 PC에서 주문 확인 |
| 관리자 | **Flutter Web** | 대시보드 4열 레이아웃, 통계 차트 등 큰 화면 필요 |
| 배송 기사 | **Flutter Mobile** (Android/iOS) | 이동 중 사용, 카메라/GPS 필수 |

---

## 2. 레이어 구조 (Clean Architecture)

Flutter 앱의 코드는 아래 5개 레이어로 분리합니다. 위에서 아래로만 의존합니다 (역방향 의존 금지).

```
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                  │
│                                                     │
│  화면(Screen), 위젯(Widget), 페이지(Page)              │
│  사용자에게 보이는 모든 것                               │
│                                                     │
│  예: LoginScreen, OrderCard, DeliveryPanel           │
├─────────────────────────────────────────────────────┤
│                  Application Layer                   │
│                                                     │
│  Riverpod Provider, 상태 관리, 비즈니스 로직 조합         │
│  화면과 도메인을 연결하는 다리 역할                       │
│                                                     │
│  예: OrderNotifier, AuthProvider, LocationProvider    │
├─────────────────────────────────────────────────────┤
│                    Domain Layer                      │
│                                                     │
│  모델(Model), 상수, 순수 비즈니스 로직                   │
│  Firebase나 Flutter에 의존하지 않는 순수 Dart 코드        │
│                                                     │
│  예: Order, DriverBadge, OrderStatus, computeBadge() │
├─────────────────────────────────────────────────────┤
│                     Data Layer                       │
│                                                     │
│  Repository, Service                                 │
│  외부 시스템(Firebase)과의 통신을 담당                    │
│                                                     │
│  예: OrderRepository, PhotoService, LocationService  │
├─────────────────────────────────────────────────────┤
│                  Firebase (External)                  │
│                                                     │
│  Realtime Database, Cloud Storage, Auth, FCM         │
│  Google이 관리하는 클라우드 인프라                       │
└─────────────────────────────────────────────────────┘
```

### 레이어별 규칙

| 레이어 | 할 수 있는 것 | 하면 안 되는 것 |
|--------|--------------|----------------|
| **Presentation** | 위젯 렌더링, Provider 구독, 사용자 입력 처리 | 직접 Firebase 호출, 비즈니스 로직 포함 |
| **Application** | Provider 정의, Domain/Data 레이어 조합 | UI 코드 포함, Widget 직접 반환 |
| **Domain** | 모델 정의, 순수 함수, 상수 | Firebase import, Flutter import |
| **Data** | Firebase CRUD, 파일 업로드, GPS 읽기 | UI 코드 포함, Widget 반환 |

---

## 3. 플랫폼별 차이점

### 공유 코드 (전체의 약 85%)

대부분의 코드는 플랫폼에 관계없이 공유됩니다:

- **모든 모델** (Order, User, Driver, Product)
- **모든 Provider** (상태 관리 로직)
- **모든 Repository** (Firebase CRUD)
- **대부분의 위젯** (OrderCard, StatusBadge, ChatBubble)
- **라우팅 로직** (go_router)
- **테마 및 스타일**

### 플랫폼 분기 코드 (약 15%)

| 기능 | Web | Mobile (Android/iOS) |
|------|-----|---------------------|
| **레이아웃** | 4열 그리드 대시보드 | 단일 열 + 하단 탭 네비게이션 |
| **사이드바** | 항상 표시 | NavigationDrawer (햄버거 메뉴) |
| **배송 패널** | 메인 화면 우측 고정 | 별도 탭 / 전체 화면 |
| **채팅** | 메인 화면 우측 패널 | 별도 화면 (오버레이) |
| **카메라** | 웹 카메라 (제한적) | 네이티브 카메라 (image_picker) |
| **GPS** | 브라우저 Geolocation API | 네이티브 GPS (geolocator) |
| **푸시 알림** | 브라우저 Notification API | FCM 네이티브 |
| **백그라운드 위치** | 불가 | flutter_background_geolocation |
| **파일 선택** | `<input type="file">` | 카메라 직접 촬영 |

### 플랫폼 분기 코드 작성 방법

```dart
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:io' show Platform;

// 방법 1: kIsWeb 체크
if (kIsWeb) {
  // 웹 전용 코드
} else if (Platform.isAndroid) {
  // Android 전용 코드
} else if (Platform.isIOS) {
  // iOS 전용 코드
}

// 방법 2: LayoutBuilder로 반응형 (권장)
LayoutBuilder(
  builder: (context, constraints) {
    if (constraints.maxWidth > 1200) {
      return DesktopLayout();    // 4열 그리드
    } else if (constraints.maxWidth > 600) {
      return TabletLayout();     // 2열
    } else {
      return MobileLayout();     // 단일 열
    }
  },
)
```

---

## 4. 반응형 전략 -- LayoutBuilder + Breakpoint

### Breakpoint 정의

```dart
// lib/core/breakpoints.dart
class Breakpoints {
  static const double mobile  = 600;
  static const double tablet  = 900;
  static const double desktop = 1200;
}
```

### 3단계 레이아웃

#### Desktop (> 1200px) -- 관리자/사무직 주 사용

```
┌────────┬────────────────────────┬─────────┬──────────────┐
│        │                        │         │              │
│ 사이드바 │      메인 컨텐츠         │ 배송기사  │   채팅 패널    │
│  220px │  (주문 리스트/폼)         │ 현황 패널 │              │
│        │   flex: 1               │  360px  │    400px     │
│        │                        │         │              │
│ - 로고  │                        │ (admin  │ - 메시지 목록  │
│ - 메뉴  │                        │  전용)  │ - 입력 필드   │
│ - 로그아웃│                       │         │              │
└────────┴────────────────────────┴─────────┴──────────────┘
```

- 4열 그리드: 사이드바 + 메인 컨텐츠 + 배송 패널 + 채팅 패널
- `Row` + `Expanded`로 구현
- admin이 아닌 역할은 배송 패널 숨김 (3열)

#### Tablet (600 ~ 1200px)

```
┌────────────────────────────────┐
│  상단 AppBar (메뉴 + 채팅 토글)   │
├────────────────┬───────────────┤
│                │               │
│   메인 컨텐츠    │  배송 패널      │
│   (주문 리스트)  │  또는 채팅      │
│                │               │
├────────────────┴───────────────┤
│  하단 탭 네비게이션                │
│  [주문] [배송] [채팅] [설정]      │
└────────────────────────────────┘
```

- 2열 레이아웃 + 하단 `BottomNavigationBar`
- 채팅은 토글로 오른쪽 패널에 표시

#### Mobile (< 600px) -- 기사 주 사용

```
┌──────────────────────┐
│  AppBar + 햄버거 메뉴    │
├──────────────────────┤
│                      │
│                      │
│     단일 화면 컨텐츠     │
│     (주문 목록 등)      │
│                      │
│                      │
├──────────────────────┤
│  하단 네비게이션         │
│  [홈] [배송] [채팅]     │
└──────────────────────┘
```

- 단일 열 레이아웃
- 사이드바 → `Drawer` (햄버거 메뉴)
- 채팅 → 별도 전체 화면
- 배송 패널 → 별도 탭

### 반응형 Shell 위젯 구조

```dart
// lib/presentation/shell/app_shell.dart
class AppShell extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth > Breakpoints.desktop;
        final isTablet  = constraints.maxWidth > Breakpoints.mobile;

        if (isDesktop) {
          return DesktopShell();   // 4열 그리드
        } else if (isTablet) {
          return TabletShell();    // 2열 + 하단 탭
        } else {
          return MobileShell();    // 단일 열 + Drawer
        }
      },
    );
  }
}
```

---

## 5. Firebase 서비스 상세

### (1) Realtime Database -- 모든 구조화된 데이터

실시간으로 변경사항을 감지할 수 있는 JSON 기반 NoSQL 데이터베이스입니다.

```
mayflower-5c9dd-default-rtdb/
├── users/           사용자 계정 정보 (역할, 이름 등)
├── products/        상품 목록 (화환, 꽃다발, 꽃바구니 등)
├── drivers/         배송 기사 정보 (이름, 연락처, 활성 상태)
├── orders/          주문 데이터 (핵심 비즈니스 데이터)
├── messages/        실시간 채팅 메시지
└── driverStatus/    기사 실시간 상태 (위치, 뱃지, 마지막 업데이트)
```

**왜 Realtime DB인가?**
- 한 사람이 주문을 변경하면 모든 사용자 화면에 **즉시** 반영
- `onValue` / `onChildAdded` 리스너 하나면 실시간 구독 완료
- 오프라인 지원: 인터넷이 끊겨도 로컬 캐시로 동작, 재접속 시 자동 동기화
- 꽃집 규모(일 수십~수백 건)에 무료 플랜으로 충분

### (2) Cloud Storage -- 사진 파일

```
gs://mayflower-5c9dd.appspot.com/
├── orders/
│   └── {orderId}/
│       ├── store-photo.jpg        매장 촬영 사진 (제작 완료)
│       └── delivery-photo.jpg     배송 완료 사진 (기사 촬영)
└── profiles/
    └── {uid}.jpg                  사용자 프로필 이미지 (선택)
```

- 최대 파일 크기: 10MB 제한 (Security Rules)
- 이미지 형식만 허용 (`image/*`)
- 업로드 후 Download URL을 Realtime DB에 저장

### (3) Authentication -- 로그인 인증

| 항목 | 설정 |
|------|------|
| 인증 방식 | 이메일 + 비밀번호 |
| 이메일 형식 | `{username}@maydaegu.internal` |
| 역할(role) | `/users/{uid}/role` 필드로 관리 |
| 세션 유지 | Firebase SDK 자동 관리 (토큰 자동 갱신) |

### Cloud Functions (선택 사항)

기본 기능은 클라이언트 SDK만으로 충분하지만, 다음은 Functions 사용을 권장합니다:

| 기능 | 트리거 | 설명 |
|------|--------|------|
| 배차 알림 | `orders/{id}/assignedDriverId` 변경 | 기사에게 FCM 푸시 알림 전송 |
| 통계 집계 | 매일 00:00 (Scheduled) | 일별/월별 배송 건수, 매출 자동 집계 |
| 사용자 초기화 | Auth `onCreate` | 신규 계정 생성 시 `/users/{uid}` 자동 작성 |
| 비활성 주문 정리 | 매일 06:00 (Scheduled) | 24시간 방치된 주문 자동 취소 |

---

## 6. 데이터 흐름도

### 주문 생성 -> 배차 -> 배송 -> 완료 전체 흐름

```
[2층 수주 - Flutter Web]
    │
    │  1) 주문 등록
    │     push(ref(db, 'orders'), { status: 0, ... })
    │
    ▼
┌─────────────────────────────────┐
│  Firebase Realtime Database     │
│  /orders/{newPushKey}           │
│  status: 0                      │
└──────────┬──────────────────────┘
           │
           │  onValue 리스너 자동 트리거
           │
           ▼
[1층 제작 - Flutter Web]
    │
    │  2) 접수 확인 + 제작
    │     update(ref, { status: 1 })  -->  status: 2
    │
    │  3) 기사 배정 (배차)
    │     update(ref, { assignedDriverId: 'driver1', status: 2 })
    │
    ▼
┌─────────────────────────────────┐
│  Firebase Realtime Database     │
│  /orders/{key}                  │
│  status: 2                      │
│  assignedDriverId: 'driver1'    │
└──────────┬──────────────────────┘
           │
           │  onValue 리스너 자동 트리거
           │  + Cloud Functions --> FCM 푸시 알림
           │
           ▼
[배송 기사 - Flutter Mobile]
    │
    │  4) 배송 출발
    │     update(ref, { status: 3 })
    │
    │  5) 배송 완료 + 사진 업로드
    │     uploadBytes(storageRef, photo)
    │     update(ref, { status: 4, deliveryPhotoUrl: url })
    │
    ▼
┌─────────────────────────────────┐
│  Firebase Realtime Database     │
│  /orders/{key}                  │
│  status: 4                      │
│  deliveryPhotoUrl: 'https://...'│
└──────────┬──────────────────────┘
           │
           │  onValue 리스너 자동 트리거
           │
           ▼
[관리자 - Flutter Web]
    배송 완료 확인, 통계 반영
```

### 기사 위치 추적 흐름

```
[배송 기사 앱 - 백그라운드]
    │
    │  30초마다 GPS 위치 읽기
    │  Geolocator.getCurrentPosition()
    │
    ├── 위치 업데이트
    │   update(ref(db, 'driverStatus/{id}'), {
    │     lat: 35.xxxx, lng: 128.xxxx,
    │     lastUpdate: DateTime.now()
    │   })
    │
    ├── 회사 100m 이내 진입 감지?
    │   ├── YES --> badge: 'waiting' + resetTs 갱신
    │   └── NO  --> badge 유지 (delivering / returning)
    │
    ▼
┌─────────────────────────────────┐
│  Firebase Realtime Database     │
│  /driverStatus/{driverId}       │
│  badge: 'waiting'               │
│  lat: 35.8293                   │
│  lng: 128.5453                  │
│  resetTs: '2026-04-16T...'      │
└──────────┬──────────────────────┘
           │
           │  onValue 리스너 자동 트리거
           │
           ▼
[관리자 웹 - 배송기사 현황 패널]
    기사별 뱃지/위치 실시간 표시
```

---

## 7. 실시간 동기화 원리

### Firebase Realtime Database의 동작 방식

Firebase Realtime Database는 **WebSocket 기반** 실시간 통신을 사용합니다.

```
┌──────────┐         WebSocket 연결         ┌──────────────┐
│  클라이언트  │ ◄──────────────────────────► │  Firebase     │
│  (앱/웹)   │    양방향 실시간 데이터 전송       │  서버          │
└──────────┘                                └──────────────┘
```

**작동 순서:**

1. 앱이 시작되면 Firebase SDK가 서버와 **WebSocket 연결**을 맺음
2. `onValue(ref(db, 'orders'))` 같은 **리스너를 등록**하면 해당 경로의 현재 데이터를 즉시 수신
3. 다른 사용자(다른 기기)가 같은 경로의 데이터를 **변경하면**, Firebase 서버가 모든 구독자에게 **즉시 변경사항을 전송**
4. 앱의 리스너 콜백이 실행되어 UI가 자동으로 업데이트

### Flutter에서의 구현

```dart
// 실시간 구독 -- StreamProvider (Riverpod)
final ordersProvider = StreamProvider<List<Order>>((ref) {
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

### 오프라인 지원

```dart
// main.dart에서 한 번만 호출
FirebaseDatabase.instance.setPersistenceEnabled(true);
```

- 인터넷이 끊겨도 **로컬 캐시**에서 데이터를 읽을 수 있음
- 오프라인에서 쓰기를 하면 **큐에 저장**되었다가 재접속 시 자동 동기화
- 배송 기사가 터널이나 지하에서도 앱을 사용할 수 있음

### 연결 상태 감지

```dart
// 네트워크 상태 모니터링
final connectedRef = FirebaseDatabase.instance.ref('.info/connected');
connectedRef.onValue.listen((event) {
  final connected = event.snapshot.value as bool? ?? false;
  if (connected) {
    // 온라인 -- 정상 동작
  } else {
    // 오프라인 -- UI에 "오프라인" 배너 표시
  }
});
```

---

## 8. 프로젝트 폴더 구조 (전체)

```
maydaegu_app/
├── lib/
│   ├── main.dart                          앱 진입점
│   ├── firebase_options.dart              FlutterFire CLI 자동 생성
│   ├── app.dart                           MaterialApp + GoRouter
│   │
│   ├── core/                              공통 유틸리티
│   │   ├── constants.dart                 상태 코드, 색상, breakpoint 등
│   │   ├── theme.dart                     앱 테마 (색상, 폰트)
│   │   └── extensions.dart                Dart 확장 메서드
│   │
│   ├── domain/                            Domain Layer
│   │   ├── models/
│   │   │   ├── order.dart
│   │   │   ├── user.dart
│   │   │   ├── driver.dart
│   │   │   ├── product.dart
│   │   │   └── chat_message.dart
│   │   └── enums/
│   │       ├── order_status.dart
│   │       ├── user_role.dart
│   │       └── driver_badge.dart
│   │
│   ├── data/                              Data Layer
│   │   ├── repositories/
│   │   │   ├── order_repository.dart
│   │   │   ├── user_repository.dart
│   │   │   ├── driver_repository.dart
│   │   │   ├── product_repository.dart
│   │   │   └── chat_repository.dart
│   │   └── services/
│   │       ├── auth_service.dart
│   │       ├── photo_service.dart
│   │       ├── location_service.dart
│   │       └── notification_service.dart
│   │
│   ├── application/                       Application Layer
│   │   ├── providers/
│   │   │   ├── auth_provider.dart
│   │   │   ├── orders_provider.dart
│   │   │   ├── drivers_provider.dart
│   │   │   ├── products_provider.dart
│   │   │   ├── chat_provider.dart
│   │   │   └── location_provider.dart
│   │   └── notifiers/
│   │       ├── order_form_notifier.dart
│   │       └── driver_status_notifier.dart
│   │
│   └── presentation/                      Presentation Layer
│       ├── shell/
│       │   ├── app_shell.dart             반응형 Shell (Desktop/Tablet/Mobile)
│       │   ├── desktop_shell.dart         4열 그리드
│       │   ├── tablet_shell.dart          2열 + 하단 탭
│       │   └── mobile_shell.dart          단일 열 + Drawer
│       ├── common/
│       │   ├── widgets/
│       │   │   ├── order_card.dart
│       │   │   ├── status_badge.dart
│       │   │   ├── loading_overlay.dart
│       │   │   └── photo_viewer.dart
│       │   └── dialogs/
│       │       ├── confirm_dialog.dart
│       │       └── driver_assign_dialog.dart
│       ├── floor2/
│       │   ├── new_order_screen.dart
│       │   └── my_orders_screen.dart
│       ├── floor1/
│       │   └── all_orders_screen.dart
│       ├── driver/
│       │   ├── my_deliveries_screen.dart
│       │   ├── order_detail_screen.dart
│       │   └── camera_screen.dart
│       ├── admin/
│       │   ├── admin_orders_screen.dart
│       │   ├── manage_products_screen.dart
│       │   ├── manage_drivers_screen.dart
│       │   └── statistics_screen.dart
│       ├── chat/
│       │   ├── chat_panel.dart
│       │   └── chat_screen.dart
│       ├── delivery_panel/
│       │   ├── delivery_panel.dart
│       │   └── driver_status_card.dart
│       └── auth/
│           └── login_screen.dart
│
├── android/                               Android 네이티브 설정
├── ios/                                   iOS 네이티브 설정
├── web/                                   Web 설정
├── test/                                  테스트 코드
├── pubspec.yaml                           의존성 관리
└── firebase.json                          Firebase 설정
```

---

## 9. 핵심 설계 원칙 요약

| 원칙 | 설명 |
|------|------|
| **단일 소스 오브 트루스** | 모든 데이터는 Firebase에만 존재. 로컬은 캐시일 뿐 |
| **실시간 우선** | 모든 데이터 조회는 `onValue` 스트림 구독. 일회성 `get()` 최소화 |
| **역할 기반 접근** | 라우팅 + Firebase Security Rules 양쪽에서 권한 체크 |
| **반응형 레이아웃** | LayoutBuilder로 Desktop/Tablet/Mobile 3단계 분기 |
| **공유 코드 극대화** | 플랫폼 분기는 레이아웃과 네이티브 기능에만 사용 |
| **오프라인 내구성** | Firebase 오프라인 캐시로 네트워크 끊김에도 앱 사용 가능 |
| **상태 코드 불변** | 0~6 상태 코드는 웹/앱/DB 모두 동일한 규약 |

---

이전 문서: [01-project-overview.md](./01-project-overview.md) -- 프로젝트 전체 개요  
다음 문서: [03-dev-environment-setup.md](./03-dev-environment-setup.md) -- 개발 환경 설정

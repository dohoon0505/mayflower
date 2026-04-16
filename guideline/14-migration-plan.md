# 14. Vanilla JS → Flutter 마이그레이션 전략

> **대상 독자:** 프로젝트 매니저, Flutter 개발자, 기존 웹 앱 유지보수 담당자  
> **목표:** 현재 Vanilla JS + HTML + CSS 웹 프로토타입을 Flutter 단일 코드베이스로 안전하게 전환하는 전체 로드맵 제시

---

## 1. 마이그레이션 원칙

전환 과정에서 반드시 지켜야 할 4가지 원칙입니다.

| # | 원칙 | 설명 |
|---|------|------|
| 1 | **기존 UX 100% 유지** | 디자인, 색상, 버튼 위치, 워크플로우를 동일하게 재현. 사용자가 "바뀐 게 없네?" 라고 느껴야 성공 |
| 2 | **점진적 전환 (Big Bang 금지)** | 한 번에 모든 것을 바꾸지 않음. 역할별, 기능별로 나눠서 순차 전환 |
| 3 | **기존 앱 계속 운영** | 마이그레이션 기간 동안 Vanilla JS 앱은 정상 가동. Flutter 앱과 병행 운영 |
| 4 | **Firebase 스키마 변경 최소화** | 기존 DB 구조를 최대한 유지하여 양쪽 앱이 같은 데이터를 읽고 쓸 수 있도록 함 |

---

## 2. 현재 코드 → Flutter 매핑표

기존 Vanilla JS 파일이 Flutter에서 어디에 대응되는지 한눈에 보는 표입니다.

| 현재 파일 | 역할 | Flutter 대응 | 비고 |
|-----------|------|-------------|------|
| `index.html` + `js/views/login.js` | 로그인 화면 | `screens/login_screen.dart` | Firebase Auth로 전환 |
| `app.html` (Shell) | 메인 앱 레이아웃 | `screens/shell_screen.dart` | Row + Column 기반 반응형 |
| `css/base.css` | 전역 스타일 (색상, 폰트) | `core/theme/app_theme.dart` | ThemeData, ColorScheme |
| `css/layout.css` | 사이드바 + 메인 레이아웃 | `screens/shell_screen.dart` | Row(Sidebar, Expanded) |
| `css/components.css` | 재사용 컴포넌트 스타일 | `core/widgets/*.dart` | Badge, OrderCard, Modal 등 |
| `css/views.css` | 각 뷰별 스타일 | `screens/**/*.dart` | 각 Screen에 인라인 |
| `js/store.js` | 전역 상태 관리 | `services/*.dart` + `providers/*.dart` | Riverpod StateNotifier |
| `js/firebase-config.js` | Firebase 초기화 | `firebase_options.dart` | flutterfire configure로 생성 |
| `js/auth.js` | 인증 로직 | `services/auth_service.dart` | FirebaseAuth 사용 |
| `js/ui.js` | UI 유틸 (모달, 토스트, 배지) | `core/widgets/` | modal.dart, toast.dart, badge.dart |
| `js/router.js` | 라우팅 | `app.dart` (GoRouter) | 선언형 라우팅 |
| `js/api.js` | Firebase CRUD | `services/order_service.dart` 등 | Realtime DB 서비스 |
| `js/chat.js` | 실시간 채팅 | `services/chat_service.dart` + `widgets/chat/` | 이미 Firebase 기반 |
| `js/views/floor2.js` | 2층 수주 화면 | `screens/floor2/*.dart` | NewOrderScreen, MyOrdersScreen |
| `js/views/floor1.js` | 1층 제작 화면 | `screens/floor1/*.dart` | AllOrdersScreen, AssignModal |
| `js/views/driver.js` | 배송 기사 화면 | `screens/driver/*.dart` | MyDeliveriesScreen, CameraWidget |
| `js/views/admin.js` | 관리자 화면 | `screens/admin/*.dart` | ProductsScreen, DriversScreen 등 |

### Flutter 프로젝트 구조 (목표)

```
lib/
├── main.dart
├── app.dart                      # GoRouter + MaterialApp
├── firebase_options.dart          # flutterfire configure
│
├── core/
│   ├── config/
│   │   └── env_config.dart        # 환경 설정
│   ├── theme/
│   │   └── app_theme.dart         # ← css/base.css
│   └── widgets/
│       ├── badge_widget.dart      # ← css/components.css (.badge)
│       ├── order_card.dart        # ← css/components.css (.order-card)
│       ├── modal_widget.dart      # ← js/ui.js (showModal)
│       └── toast_widget.dart      # ← js/ui.js (showToast)
│
├── models/
│   ├── order.dart
│   ├── driver_model.dart
│   ├── product.dart
│   └── chat_message.dart
│
├── services/
│   ├── auth_service.dart          # ← js/auth.js
│   ├── order_service.dart         # ← js/api.js + js/store.js
│   ├── driver_service.dart
│   ├── product_service.dart
│   ├── chat_service.dart          # ← js/chat.js
│   └── storage_service.dart
│
├── providers/
│   ├── auth_provider.dart
│   ├── order_provider.dart
│   ├── driver_provider.dart
│   └── chat_provider.dart
│
└── screens/
    ├── login_screen.dart          # ← index.html + login.js
    ├── shell_screen.dart          # ← app.html
    ├── floor2/
    │   ├── new_order_screen.dart
    │   └── my_orders_screen.dart
    ├── floor1/
    │   ├── all_orders_screen.dart
    │   └── assign_modal.dart
    ├── driver/
    │   ├── my_deliveries_screen.dart
    │   └── delivery_detail_screen.dart
    └── admin/
        ├── products_screen.dart
        ├── categories_screen.dart
        ├── drivers_screen.dart
        └── statistics_screen.dart
```

---

## 3. 데이터 마이그레이션

### 3.1 단계별 데이터 전환

#### 단계 1: localStorage 의존성 제거

현재 Vanilla JS 앱은 일부 데이터를 `localStorage`에 저장합니다. Flutter 전환 전에 이를 모두 Firebase Realtime DB로 옮겨야 합니다.

| localStorage 키 | 마이그레이션 대상 | 방법 |
|-----------------|------------------|------|
| 로그인 세션 | Firebase Auth | `signInWithEmailAndPassword` |
| 사용자 설정 | `users/{uid}/settings` | DB에 저장 |
| 캐시 데이터 | 불필요 | Firebase 실시간 동기화로 대체 |

```dart
// Flutter에서는 localStorage 대신 Firebase를 직접 사용
// 오프라인 캐시가 필요하면 shared_preferences 패키지 활용
final prefs = await SharedPreferences.getInstance();
await prefs.setString('lastRole', 'floor2');
```

#### 단계 2: Auth 전환 (평문 비밀번호 → Firebase Auth)

현재 시스템은 비밀번호를 평문으로 DB에 저장하고 있을 수 있습니다. Firebase Auth로 전환합니다.

```
[기존 방식]
users/
  user1/
    password: "1234"     ← 보안 취약

[Firebase Auth 전환 후]
- Firebase Auth에 이메일/비밀번호 계정 생성
- DB의 password 필드 삭제
- users/{uid}/ 에는 역할(role), 이름 등만 저장
```

마이그레이션 스크립트 (Cloud Functions 또는 Admin SDK):

```javascript
// scripts/migrate-auth.js (Node.js + Firebase Admin SDK)
const admin = require('firebase-admin');
admin.initializeApp();

async function migrateUsers() {
  const db = admin.database();
  const snapshot = await db.ref('users').once('value');
  const users = snapshot.val();

  for (const [key, user] of Object.entries(users)) {
    try {
      // Firebase Auth에 사용자 생성
      const authUser = await admin.auth().createUser({
        email: `${user.username}@maydaegu.com`,
        password: user.password,   // 기존 비밀번호 그대로
        displayName: user.name,
      });

      // DB에 uid 매핑 저장
      await db.ref(`users/${authUser.uid}`).set({
        name: user.name,
        role: user.role,
        // password 필드는 저장하지 않음
      });

      console.log(`Migrated: ${user.name} → ${authUser.uid}`);
    } catch (e) {
      console.error(`Failed: ${user.name}`, e.message);
    }
  }
}

migrateUsers();
```

#### 단계 3: Storage 연동 (사진 파일)

배송 완료 사진, 매장 사진 등의 파일 관리:

```dart
// services/storage_service.dart
class StorageService {
  final _storage = FirebaseStorage.instance;

  /// 배송 완료 사진 업로드
  Future<String> uploadDeliveryPhoto(String orderId, File photo) async {
    final ref = _storage.ref('deliveries/$orderId/${DateTime.now().millisecondsSinceEpoch}.jpg');
    await ref.putFile(photo);
    return await ref.getDownloadURL();
  }

  /// 매장 사진 업로드
  Future<String> uploadShopPhoto(String orderId, File photo) async {
    final ref = _storage.ref('shop_photos/$orderId/${DateTime.now().millisecondsSinceEpoch}.jpg');
    await ref.putFile(photo);
    return await ref.getDownloadURL();
  }
}
```

---

## 4. UI 마이그레이션 단계 (10주 플랜)

### Week 1: 프로젝트 초기 설정

| 작업 | 세부 내용 |
|------|----------|
| Flutter 프로젝트 생성 | `flutter create maydaegu_app --platforms=web,android,ios` |
| Firebase 연결 | `flutterfire configure` 실행 |
| 패키지 설치 | Riverpod, GoRouter, firebase_*, intl 등 |
| 테마 설정 | `css/base.css`의 색상/폰트를 `app_theme.dart`로 전환 |
| 폴더 구조 생성 | models/, services/, providers/, screens/, core/ |
| Linting 설정 | `analysis_options.yaml` 커스텀 규칙 |

```dart
// core/theme/app_theme.dart — css/base.css 에서 가져온 값
class AppTheme {
  static ThemeData get light => ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: Color(0xFF2196F3),  // --primary-color
      brightness: Brightness.light,
    ),
    fontFamily: 'Pretendard',
    useMaterial3: true,
    cardTheme: CardTheme(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}
```

### Week 2: 로그인 화면 + Auth

| 작업 | 세부 내용 |
|------|----------|
| LoginScreen | 아이디/비밀번호 입력 + 로그인 버튼 |
| AuthService | `signInWithEmailAndPassword`, `signOut`, `currentUser` |
| AuthProvider | 로그인 상태 Riverpod StateNotifier |
| 역할 기반 리다이렉트 | 로그인 후 `users/{uid}/role` 읽어서 해당 화면으로 이동 |

### Week 3: ShellScreen (메인 레이아웃)

| 작업 | 세부 내용 |
|------|----------|
| ShellScreen | 사이드바 + 메인 콘텐츠 영역 |
| 반응형 레이아웃 | Desktop: Row(Sidebar, Expanded), Mobile: Drawer |
| Sidebar | 역할별 메뉴 아이템 (floor2: 신규접수/내주문, floor1: 전체주문 등) |
| GoRouter 설정 | ShellRoute + 하위 라우트 |

```dart
// 반응형 기준점
class Breakpoints {
  static const double mobile = 600;
  static const double tablet = 1024;
  static const double desktop = 1440;
}

// ShellScreen 핵심 구조
Widget build(BuildContext context) {
  final width = MediaQuery.of(context).size.width;
  final isMobile = width < Breakpoints.mobile;

  return Scaffold(
    drawer: isMobile ? Sidebar() : null,
    body: Row(
      children: [
        if (!isMobile) Sidebar(),
        Expanded(child: child),  // GoRouter의 ShellRoute child
      ],
    ),
  );
}
```

### Week 4: 채팅 패널

| 작업 | 세부 내용 |
|------|----------|
| ChatService | Firebase Realtime DB `onChildAdded` 스트림 |
| ChatProvider | 메시지 목록 실시간 관리 |
| ChatPanel | 메시지 목록 + 입력란 + 전송 버튼 |
| 채팅 위치 | ShellScreen 우측에 접을 수 있는 패널 |

채팅은 **이미 Firebase 기반**이라 데이터 호환이 가장 쉬운 기능입니다.

### Week 5: floor2 화면 (2층 수주)

| 작업 | 세부 내용 |
|------|----------|
| NewOrderScreen | 주문 접수 폼 (체인명, 상품, 배송지, 받는분, 리본 문구) |
| MyOrdersScreen | 본인이 등록한 주문 목록 |
| OrderService | CRUD — `ordersRef.push()`, `ordersRef.onValue` |
| OrderProvider | 주문 목록 실시간 스트림 |
| 상품 선택 드롭다운 | `products/` 에서 카테고리별 로드 |

### Week 6: floor1 화면 (1층 제작)

| 작업 | 세부 내용 |
|------|----------|
| AllOrdersScreen | 전체 주문 목록 (상태별 탭/필터) |
| 상태 변경 | 접수확인 → 제작중 → 제작완료 |
| 기사 배정 모달 | 기사 목록 + 선택 + 배차 확인 |
| 매장 사진 업로드 | `image_picker` + `StorageService` |

### Week 7: driver 화면 (배송 기사)

| 작업 | 세부 내용 |
|------|----------|
| MyDeliveriesScreen | 배정된 주문 목록 |
| DeliveryDetailScreen | 주문 상세 + 배송 출발/완료 버튼 |
| 카메라 기능 | 배송 완료 사진 촬영 + Storage 업로드 |
| GPS 위치 추적 | `geolocator` + 위치 DB 저장 |
| 백그라운드 위치 | 배송 중 자동 위치 업데이트 |

### Week 8: admin 화면 (관리자)

| 작업 | 세부 내용 |
|------|----------|
| ProductsScreen | 상품 CRUD (이름, 가격, 카테고리, 사진) |
| CategoriesScreen | 카테고리 CRUD (이름, 정렬 순서) |
| DriversScreen | 기사 CRUD (이름, 전화번호, 상태, 자격) |
| 비밀번호 초기화 | Firebase Auth `sendPasswordResetEmail` |

### Week 9: DeliveryPanel + 통계

| 작업 | 세부 내용 |
|------|----------|
| DeliveryPanel | 기사 상태 대시보드 (배송대기/배송중/복귀중/휴무) |
| 뱃지별 통계 | 각 뱃지별 기사 수 실시간 표시 |
| 일별 통계 | 주문 수, 완료 수, 평균 배송 시간 |
| 정산 화면 | 기사별 배송 건수/금액 합산 |

### Week 10: 반응형 QA + 모바일 최적화

| 작업 | 세부 내용 |
|------|----------|
| Desktop QA | 1920x1080, 1440x900 등 테스트 |
| Tablet QA | 1024x768 (iPad), 800x1280 테스트 |
| Mobile QA | 360x800, 390x844 (iPhone) 테스트 |
| 터치 최적화 | 버튼 크기 48dp 이상, 스와이프 제스처 |
| 성능 최적화 | 불필요한 리빌드 제거, 리스트 지연 로딩 |

### 10주 플랜 타임라인 시각화

```
Week  1 ████ 프로젝트 설정 + 테마
Week  2 ████ 로그인 + Auth
Week  3 ████ ShellScreen + 반응형
Week  4 ████ 채팅 패널
Week  5 ████ floor2 (수주)
Week  6 ████ floor1 (제작)
Week  7 ████ driver (배송) + GPS + 카메라
Week  8 ████ admin (관리)
Week  9 ████ DeliveryPanel + 통계
Week 10 ████ QA + 모바일 최적화
         ─────────────────────────
         ▲ Vanilla JS 앱 병행 운영 ▲
```

---

## 5. 병행 운영 전략

마이그레이션 기간 동안 Vanilla JS 앱과 Flutter 앱을 동시에 운영합니다.

### 5.1 핵심: 같은 Firebase DB 공유

```
Firebase Realtime Database
         │
    ┌────┴────┐
    │         │
Vanilla JS  Flutter
  (기존)     (신규)
    │         │
    └────┬────┘
         │
    동일 데이터
```

양쪽 앱이 같은 DB 경로(`orders/`, `users/`, `drivers/`, `chat/` 등)를 읽고 쓰므로:
- Vanilla JS에서 접수한 주문이 Flutter에서 보이고
- Flutter에서 상태 변경한 것이 Vanilla JS에서도 반영됨

### 5.2 팀별 순차 전환 순서

전환 위험도가 낮은 역할부터 먼저 전환합니다.

| 순서 | 역할 | 이유 | 롤백 영향 |
|------|------|------|----------|
| 1 | **driver** (배송 기사) | 모바일 앱이 필수인 역할, 화면 수 적음 | 낮음 (기사만 영향) |
| 2 | **floor2** (2층 수주) | 화면 2개(신규접수, 내주문)로 단순 | 낮음 |
| 3 | **floor1** (1층 제작) | 핵심 기능(배차), 약간 복잡 | 중간 |
| 4 | **admin** (관리자) | 가장 복잡, 마지막에 전환 | 높음 |

### 5.3 전환 프로세스 (역할별)

```
1. Flutter 앱에서 해당 역할 기능 개발 완료
2. 내부 테스트 (개발자 + 해당 역할 담당자 1명)
3. 병행 운영 기간 (1~2주: 양쪽 다 사용 가능)
4. 전환 확정 → 해당 역할은 Flutter만 사용
5. 문제 발생 시 → 즉시 Vanilla JS로 롤백 (DB 공유라 가능)
```

### 5.4 Vanilla JS 앱 종료 시점

모든 역할이 Flutter로 전환 완료되고, 최소 2주간 안정 운영 확인 후:

1. Vanilla JS 앱 접속 시 "Flutter 앱으로 이동" 안내 표시
2. 추가 2주 후 Vanilla JS 앱 비활성화
3. 기존 코드는 삭제하지 않고 별도 브랜치(`legacy/vanilla-js`)에 보존

---

## 6. CSS → Flutter 스타일 전환 가이드

주요 CSS 패턴과 Flutter 대응을 정리합니다.

```css
/* css/base.css (기존) */
:root {
  --primary-color: #2196F3;
  --success-color: #4CAF50;
  --warning-color: #FF9800;
  --danger-color: #F44336;
  --bg-color: #F5F5F5;
  --font-family: 'Pretendard', sans-serif;
}
```

```dart
// core/theme/app_theme.dart (Flutter 전환)
class AppColors {
  static const primary = Color(0xFF2196F3);
  static const success = Color(0xFF4CAF50);
  static const warning = Color(0xFFFF9800);
  static const danger  = Color(0xFFF44336);
  static const bg      = Color(0xFFF5F5F5);
}
```

```css
/* css/components.css (기존) */
.order-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
```

```dart
// core/widgets/order_card.dart (Flutter 전환)
Card(
  elevation: 2,
  shape: RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(12),
  ),
  child: Padding(
    padding: EdgeInsets.all(16),
    child: /* ... */,
  ),
)
```

---

## 7. 마이그레이션 체크리스트 (기능별)

모든 기능이 Flutter에서 정상 동작하는지 확인합니다.

### 인증

- [ ] 로그인 (이메일 + 비밀번호)
- [ ] 로그아웃
- [ ] 세션 유지 (앱 재시작 시 자동 로그인)
- [ ] 역할별 화면 리다이렉트

### 주문 관리

- [ ] 주문 접수 (floor2 — 신규 주문 등록)
- [ ] 주문 목록 조회 (실시간 업데이트)
- [ ] 주문 상태 변경 (floor1 — 접수확인/제작중/제작완료)
- [ ] 주문 상세 보기
- [ ] 주문 검색/필터

### 배차 & 배송

- [ ] 기사 배정 (floor1 — 배차 모달)
- [ ] 배송 출발 (driver)
- [ ] 배송 완료 (driver)
- [ ] 사진 업로드 — 매장 사진 (floor1)
- [ ] 사진 업로드 — 배송 완료 사진 (driver)

### 채팅

- [ ] 실시간 메시지 송수신
- [ ] 메시지 목록 스크롤
- [ ] 새 메시지 알림 표시
- [ ] 채팅 패널 열기/닫기

### 관리자

- [ ] 상품 관리 (CRUD)
- [ ] 카테고리 관리 (CRUD)
- [ ] 기사 관리 (CRUD + 자격 관리)
- [ ] 통계/정산 화면

### DeliveryPanel

- [ ] 기사 상태 대시보드 (배송대기/배송중/복귀중/휴무)
- [ ] 뱃지별 기사 수 표시
- [ ] 기사 배송 진행률 바

### 네이티브 기능

- [ ] GPS 위치 추적 (driver)
- [ ] 백그라운드 위치 업데이트
- [ ] 카메라 촬영
- [ ] 푸시 알림 (FCM)

### 반응형 레이아웃

- [ ] Desktop (1440px+) — 사이드바 + 메인 + 채팅 패널
- [ ] Tablet (600~1440px) — 축소된 사이드바 + 메인
- [ ] Mobile (600px 미만) — 바텀 네비게이션 또는 Drawer

---

## 8. 위험 요소 & 대응

| 위험 | 가능성 | 영향 | 대응 |
|------|--------|------|------|
| Firebase 스키마 불일치 | 중간 | 높음 | 전환 전 스키마 동결, 변경 시 양쪽 코드 동시 수정 |
| 기사 앱 GPS 배터리 소모 | 높음 | 중간 | 위치 업데이트 간격 조절 (30초~1분) |
| 기존 사용자 교육 부담 | 낮음 | 중간 | UI를 기존과 최대한 동일하게 유지 |
| iOS 빌드 환경 부재 | 높음 | 중간 | macOS 장비 확보 또는 Codemagic 활용 |
| 마이그레이션 기간 버그 | 중간 | 높음 | 즉시 롤백 가능 (Vanilla JS 유지) |

---

## 9. 요약: 전환 흐름 한눈에

```
[현재]                          [10주 후]
Vanilla JS + HTML + CSS         Flutter (Web + Android + iOS)
├── index.html                  ├── lib/
├── app.html                    │   ├── screens/
├── css/                        │   ├── services/
├── js/                         │   ├── providers/
│   ├── store.js                │   ├── models/
│   ├── auth.js                 │   └── core/
│   ├── views/                  ├── android/
│   └── chat.js                 ├── ios/
└── Firebase (유지)             └── Firebase (동일)
         │                               │
         └───────── 같은 DB ─────────────┘
```

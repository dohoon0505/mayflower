# 08. 라우팅 & 네비게이션 (GoRouter)

> **대상 독자:** Flutter 통합 앱을 개발하는 프론트엔드/모바일 개발자
> **목표:** GoRouter 기반의 선언형 라우팅을 구성하고, 역할별 리디렉션 및 ShellRoute 패턴을 확립

---

## 1. 왜 GoRouter인가?

| 비교 항목 | Navigator 2.0 (직접 구현) | GoRouter |
|-----------|--------------------------|----------|
| **선언형 라우팅** | 직접 `RouterDelegate` 구현 필요 | `GoRoute` 선언만으로 완성 |
| **URL 기반 라우팅** | 수동 파싱 | 자동 — 웹 URL 직접 접근 가능 |
| **Redirect** | 직접 로직 작성 | `redirect` 콜백 내장 |
| **Deep Link** | Android/iOS 별도 설정 + 수동 매핑 | 자동 지원 |
| **ShellRoute** | 없음 | 공통 레이아웃(사이드바 등) 감싸기 내장 |
| **코드량** | 매우 많음 | 최소화 |

메이대구는 **Flutter Web + Android + iOS** 통합 코드베이스이지만, 플랫폼별 접근 가능한 역할이 엄격히 분리됩니다:

| 플랫폼 | 접근 허용 역할 | 비고 |
|--------|--------------|------|
| **Flutter Web** | floor2, floor1, admin | 기사(`driver`) 계정으로 Web 로그인 시 차단 |
| **Flutter Android/iOS** | driver (기사) 전용 | 기사 외 역할 로그인 시 즉시 로그아웃 + 오류 표시 |

GoRouter는 URL 기반 라우팅과 `redirect` 콜백을 활용하여 이 분리를 구현합니다.

---

## 2. 라우트 구조

### 2.1 플랫폼별 라우트 분리 원칙

```
플랫폼 분기
 │
 ├── kIsWeb == true  (Flutter Web — 사무직 전용)
 │   │
 │   ├── /login
 │   ├── /floor2/my-orders
 │   ├── /floor2/new-order
 │   ├── /floor1/all-orders
 │   ├── /admin/all-orders
 │   ├── /admin/products
 │   ├── /admin/categories
 │   ├── /admin/drivers
 │   └── /admin/statistics
 │       → driver 계정 로그인 시 차단 (로그아웃 처리)
 │
 └── kIsWeb == false  (Android / iOS — 기사 전용)
     │
     ├── /login
     ├── /driver/my-deliveries      ← 홈 화면
     ├── /driver/order/:orderId     ← 주문 상세
     └── /driver/chat               ← 채팅 (선택)
         → driver 이외 역할 로그인 시 즉시 로그아웃 + 안내 표시
```

### 2.2 전체 라우트 트리

```
/login                          → LoginScreen
/                               → 역할 + 플랫폼 기반 자동 리디렉션
│
├── /floor2/  (Web 전용 — kIsWeb 아닌 경우 차단)
│   ├── my-orders               → MyOrdersScreen
│   └── new-order               → NewOrderScreen
│
├── /floor1/  (Web 전용)
│   └── all-orders              → AllOrdersScreen
│
├── /driver/  (Android/iOS 전용 — kIsWeb인 경우 차단)
│   ├── my-deliveries           → MyDeliveriesScreen
│   ├── order/:orderId          → OrderDetailScreen
│   └── chat                   → DriverChatScreen
│
└── /admin/   (Web 전용)
    ├── all-orders              → AdminAllOrdersScreen
    ├── products                → ManageProductsScreen
    ├── categories              → ManageCategoriesScreen
    ├── drivers                 → ManageDriversScreen
    └── statistics              → StatisticsScreen
```

### 2.2 현재 해시 라우터와의 매핑표

현재 Vanilla JS 라우터(`js/router.js`)는 해시 기반입니다. GoRouter 전환 시 아래 매핑을 따릅니다.

| 역할 | 현재 Vanilla JS (해시) | GoRouter (경로) |
|------|----------------------|-----------------|
| floor2 | `#my-orders` | `/floor2/my-orders` |
| floor2 | `#new-order` | `/floor2/new-order` |
| floor1 | `#all-orders` | `/floor1/all-orders` |
| driver | `#my-deliveries` | `/driver/my-deliveries` |
| admin | `#all-orders` | `/admin/all-orders` |
| admin | `#manage-products` | `/admin/products` |
| admin | `#manage-drivers` | `/admin/drivers` |
| admin | `#statistics` | `/admin/statistics` |
| - | `#manage-categories` (신규) | `/admin/categories` |

변경 포인트:
- 해시(`#`) 제거 → path 기반으로 전환
- 역할 접두어(`/floor2/`, `/admin/` 등)를 추가하여 라우트 충돌 방지
- `admin`과 `floor1`이 공유하던 `#all-orders`를 각자 별도 경로로 분리

---

## 3. GoRouter 설정

### 3.1 라우터 Provider

```dart
// lib/router/app_router.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../screens/screens.dart';
import 'shell_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final session = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: true,

    // ── 글로벌 리디렉션 ──
    redirect: (context, state) {
      final isLoggedIn = session != null;
      final isLoginPage = state.matchedLocation == '/login';

      // 비로그인 → 로그인 페이지로
      if (!isLoggedIn && !isLoginPage) return '/login';

      // 로그인 상태에서 로그인 페이지 접근 → 홈으로
      if (isLoggedIn && isLoginPage) return '/';

      if (isLoggedIn) {
        final role = session.role;

        // ── 플랫폼별 역할 차단 (핵심 보안) ──────────────────────
        // Android / iOS: driver 전용 — 다른 역할 로그인 차단
        if (!kIsWeb && role != 'driver') {
          // driver가 아닌 계정이 모바일 앱으로 로그인 시도 → 로그아웃 후 오류
          ref.read(authProvider.notifier).logout();
          return '/login?error=mobile_driver_only';
        }
        // Flutter Web: driver 계정 Web 접속 차단
        if (kIsWeb && role == 'driver') {
          ref.read(authProvider.notifier).logout();
          return '/login?error=driver_use_app';
        }
        // ────────────────────────────────────────────────────────

        // 루트 경로 → 역할별 기본 화면으로
        if (state.matchedLocation == '/') {
          switch (role) {
            case 'floor2': return '/floor2/my-orders';
            case 'floor1': return '/floor1/all-orders';
            case 'driver': return '/driver/my-deliveries';
            case 'admin':  return '/admin/all-orders';
          }
        }

        // 역할과 맞지 않는 경로 접근 차단
        final loc = state.matchedLocation;
        if (loc.startsWith('/floor2') && role != 'floor2' && role != 'admin') return '/';
        if (loc.startsWith('/floor1') && role != 'floor1' && role != 'admin') return '/';
        if (loc.startsWith('/driver') && role != 'driver') return '/';
        if (loc.startsWith('/admin')  && role != 'admin')  return '/';
      }

      return null; // 리디렉션 없음
    },

    routes: [
      // ── 로그인 (Shell 바깥) ──
      GoRoute(
        path: '/login',
        builder: (context, state) {
          // ?error= 파라미터로 플랫폼 차단 안내 메시지 전달
          final error = state.uri.queryParameters['error'];
          return LoginScreen(errorCode: error);
        },
      ),

      // ── 메인 Shell (Web 사무직: floor2/floor1/admin) ──
      // Android/iOS(kIsWeb=false)에서는 ShellScreen이 로드되지 않음
      // — redirect에서 /driver/* 로 이미 분기됨
      ShellRoute(
        builder: (context, state, child) {
          return ShellScreen(child: child);
        },
        routes: [
          // floor2 라우트 (Web 전용)
          GoRoute(
            path: '/floor2/my-orders',
            builder: (ctx, state) => const MyOrdersScreen(),
          ),
          GoRoute(
            path: '/floor2/new-order',
            builder: (ctx, state) => const NewOrderScreen(),
          ),

          // floor1 라우트 (Web 전용)
          GoRoute(
            path: '/floor1/all-orders',
            builder: (ctx, state) => const AllOrdersScreen(),
          ),

          // driver 라우트
          GoRoute(
            path: '/driver/my-deliveries',
            builder: (ctx, state) => const MyDeliveriesScreen(),
          ),
          GoRoute(
            path: '/driver/order/:orderId',
            builder: (ctx, state) {
              final orderId = state.pathParameters['orderId']!;
              return OrderDetailScreen(orderId: orderId);
            },
          ),
          GoRoute(
            path: '/driver/chat',
            builder: (ctx, state) => const DriverChatScreen(),
          ),

          // admin 라우트 (Web 전용)
          GoRoute(
            path: '/admin/all-orders',
            builder: (ctx, state) => const AdminAllOrdersScreen(),
          ),
          GoRoute(
            path: '/admin/products',
            builder: (ctx, state) => const ManageProductsScreen(),
          ),
          GoRoute(
            path: '/admin/categories',
            builder: (ctx, state) => const ManageCategoriesScreen(),
          ),
          GoRoute(
            path: '/admin/drivers',
            builder: (ctx, state) => const ManageDriversScreen(),
          ),
          GoRoute(
            path: '/admin/statistics',
            builder: (ctx, state) => const StatisticsScreen(),
          ),
        ],
      ),
    ],

    // ── 404 ──
    errorBuilder: (context, state) => NotFoundScreen(
      path: state.matchedLocation,
    ),
  );
});
```

### 3.2 MaterialApp 연결

```dart
// lib/app.dart
class MaydaeguApp extends ConsumerWidget {
  const MaydaeguApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: '메이대구',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
```

### 3.3 LoginScreen — 플랫폼 차단 안내 메시지

redirect에서 `?error=` 파라미터로 차단 이유를 전달하면, 로그인 화면에서 적절한 안내를 보여줍니다.

```dart
// lib/screens/login_screen.dart
class LoginScreen extends StatelessWidget {
  final String? errorCode;
  const LoginScreen({super.key, this.errorCode});

  String? _platformErrorMessage() {
    return switch (errorCode) {
      // 모바일 앱에서 기사 아닌 계정 로그인 시도
      'mobile_driver_only' =>
        '📱 모바일 앱은 배송 기사 전용입니다.\n'
        '사무직 계정은 웹 브라우저로 접속해 주세요.',
      // Web에서 기사 계정 로그인 시도
      'driver_use_app' =>
        '🚚 기사 계정은 모바일 앱을 이용해 주세요.\n'
        'Play Store / App Store에서 "메이대구 기사" 앱을 설치하세요.',
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    final errMsg = _platformErrorMessage();
    return Scaffold(
      body: Column(
        children: [
          if (errMsg != null)
            Container(
              width: double.infinity,
              color: Colors.orange.shade50,
              padding: const EdgeInsets.all(12),
              child: Text(errMsg,
                style: const TextStyle(color: Colors.deepOrange)),
            ),
          // ... 로그인 폼
        ],
      ),
    );
  }
}
```

---

## 4. ShellRoute 패턴

### 4.1 ShellRoute란?

여러 라우트가 **공통 레이아웃(사이드바, 하단 탭 등)**을 공유할 때, `ShellRoute`로 감싸면 라우트 전환 시 공통 UI를 유지할 수 있습니다.

```
ShellRoute
├── builder: ShellScreen(child: 현재 라우트의 위젯)
│   ┌─────────────────────────────────────────────┐
│   │ Sidebar │  child (메인 콘텐츠)  │ 패널들      │
│   │         │                     │             │
│   │ 메뉴     │  ← 여기만 바뀜 →      │ (admin만)   │
│   └─────────────────────────────────────────────┘
└── routes: [floor2/*, floor1/*, driver/*, admin/*]
```

### 4.2 ShellScreen 구현

```dart
// lib/router/shell_screen.dart
class ShellScreen extends ConsumerWidget {
  final Widget child;
  const ShellScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authProvider);
    if (session == null) return const SizedBox.shrink();

    return ResponsiveBuilder(
      // ── Desktop (1200px 이상) ──
      desktop: (ctx) => Scaffold(
        body: Row(
          children: [
            AppSidebar(role: session.role),
            Expanded(child: child),
            if (session.role == 'admin') ...[
              const SizedBox(
                width: 360,
                child: DeliveryPanel(),
              ),
              const SizedBox(
                width: 500,
                child: ChatPanel(),
              ),
            ] else ...[
              const SizedBox(
                width: 500,
                child: ChatPanel(),
              ),
            ],
          ],
        ),
      ),

      // ── Tablet (600~1199px) ──
      tablet: (ctx) => Scaffold(
        appBar: AppBar(title: Text(_pageTitle(context))),
        drawer: AppSidebar(role: session.role),
        body: Row(
          children: [
            Expanded(child: child),
            const SizedBox(
              width: 360,
              child: ChatPanel(),
            ),
          ],
        ),
      ),

      // ── Mobile (600px 미만) ──
      mobile: (ctx) => Scaffold(
        appBar: AppBar(title: Text(_pageTitle(context))),
        drawer: AppSidebar(role: session.role),
        body: child,
        bottomNavigationBar: AppBottomNav(role: session.role),
        floatingActionButton: FloatingActionButton(
          onPressed: () => _openChatOverlay(ctx),
          child: const Icon(Icons.chat),
        ),
      ),
    );
  }
}
```

### 4.3 사이드바 메뉴 구성 (역할별)

```dart
class AppSidebar extends ConsumerWidget {
  final String role;
  const AppSidebar({super.key, required this.role});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return NavigationDrawer(
      selectedIndex: _currentIndex(context),
      onDestinationSelected: (index) {
        context.go(_routes[index]);
        if (Scaffold.of(context).isDrawerOpen) {
          Navigator.pop(context);
        }
      },
      children: [
        const SizedBox(height: 16),
        // 로고 영역
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text('메이대구',
              style: Theme.of(context).textTheme.titleLarge),
        ),
        const SizedBox(height: 16),
        const Divider(),
        // 역할별 메뉴
        ..._buildDestinations(),
        const Spacer(),
        // 로그아웃
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('로그아웃'),
          onTap: () {
            ref.read(authProvider.notifier).logout();
            context.go('/login');
          },
        ),
      ],
    );
  }

  List<NavigationDrawerDestination> _buildDestinations() {
    switch (role) {
      case 'floor2':
        return const [
          NavigationDrawerDestination(
            icon: Icon(Icons.list_alt), label: Text('내 주문')),
          NavigationDrawerDestination(
            icon: Icon(Icons.add_circle_outline), label: Text('신규 접수')),
        ];
      case 'floor1':
        return const [
          NavigationDrawerDestination(
            icon: Icon(Icons.list_alt), label: Text('전체 주문')),
        ];
      case 'driver':
        return const [
          NavigationDrawerDestination(
            icon: Icon(Icons.local_shipping), label: Text('내 배송')),
        ];
      case 'admin':
        return const [
          NavigationDrawerDestination(
            icon: Icon(Icons.list_alt), label: Text('전체 주문')),
          NavigationDrawerDestination(
            icon: Icon(Icons.inventory_2), label: Text('상품 관리')),
          NavigationDrawerDestination(
            icon: Icon(Icons.category), label: Text('카테고리')),
          NavigationDrawerDestination(
            icon: Icon(Icons.people), label: Text('기사 관리')),
          NavigationDrawerDestination(
            icon: Icon(Icons.bar_chart), label: Text('통계')),
        ];
      default:
        return [];
    }
  }
}
```

---

## 5. 역할별 리디렉션 상세

### 5.1 리디렉션 흐름도

```
사용자가 URL 접근
  │
  ├── 로그인 안 됨? ─────────────────► /login
  │
  ├── 로그인 상태 + /login 접근? ─────► / (역할별 홈)
  │
  ├── / (루트) 접근?
  │   ├── role=floor2 ──────────────► /floor2/my-orders
  │   ├── role=floor1 ──────────────► /floor1/all-orders
  │   ├── role=driver ──────────────► /driver/my-deliveries
  │   └── role=admin  ──────────────► /admin/all-orders
  │
  ├── 역할 불일치? (예: floor2가 /admin/* 접근)
  │   └── 본인 역할 홈으로 리디렉션
  │
  └── 정상 접근 ─────────────────────► null (통과)
```

### 5.2 리디렉션이 authProvider 변경에 반응하는 원리

`routerProvider` 내부에서 `ref.watch(authProvider)`를 사용하므로, 로그인/로그아웃 시 **GoRouter 인스턴스가 자동으로 재생성**되고 리디렉션이 재평가됩니다.

```dart
final routerProvider = Provider<GoRouter>((ref) {
  final session = ref.watch(authProvider); // ← 이 watch가 핵심
  // session이 null → non-null 또는 그 반대로 바뀌면
  // GoRouter가 재생성되어 redirect가 다시 실행됨
  // ...
});
```

### 5.3 admin 전용 경로 가드

admin만 접근 가능한 경로에 대해 추가 검증이 필요한 경우:

```dart
GoRoute(
  path: '/admin/drivers',
  redirect: (context, state) {
    final session = ref.read(authProvider);
    if (session?.role != 'admin') return '/';
    return null;
  },
  builder: (ctx, state) => const ManageDriversScreen(),
),
```

---

## 6. 네비게이션 방법

### 6.1 선언형 네비게이션

```dart
// 경로 이동 (히스토리 교체)
context.go('/admin/products');

// 경로 이동 (히스토리 추가 — 뒤로 가기 가능)
context.push('/driver/order/abc123');

// 경로 파라미터
context.go('/driver/order/$orderId');

// 쿼리 파라미터
context.go('/admin/all-orders?status=3&date=2026-04-16');

// 뒤로 가기
context.pop();
```

### 6.2 go vs push 사용 기준

| 메서드 | 히스토리 | 사용 시점 |
|--------|:--------:|----------|
| `context.go(path)` | 교체 | 사이드바 메뉴 클릭, 탭 전환 |
| `context.push(path)` | 추가 | 주문 상세 보기, 모달처럼 돌아와야 할 때 |
| `context.pop()` | 제거 | 뒤로 가기 버튼 |

---

## 7. Deep Link 설정

### 7.1 Flutter Web

Flutter Web은 기본적으로 URL 기반 라우팅을 지원합니다. 별도 설정 없이 `https://maydaegu.web.app/admin/all-orders` 같은 URL로 직접 접근 가능합니다.

**주의:** Firebase Hosting을 사용하는 경우, `firebase.json`에 SPA 리다이렉트를 설정해야 합니다.

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 7.2 Android Deep Link

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity android:name=".MainActivity">
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data
      android:scheme="https"
      android:host="maydaegu.web.app"
      android:pathPrefix="/"/>
  </intent-filter>
  <!-- 커스텀 스킴 (선택) -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data
      android:scheme="maydaegu"
      android:host="open"/>
  </intent-filter>
</activity>
```

### 7.3 iOS Deep Link (Universal Link)

```xml
<!-- ios/Runner/Info.plist -->
<key>FlutterDeepLinkingEnabled</key>
<true/>

<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>maydaegu</string>
    </array>
  </dict>
</array>
```

Associated Domains (Xcode > Runner > Signing & Capabilities):
```
applinks:maydaegu.web.app
```

---

## 8. 404 핸들링

```dart
// lib/screens/not_found_screen.dart
class NotFoundScreen extends StatelessWidget {
  final String path;
  const NotFoundScreen({super.key, required this.path});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.search_off, size: 64, color: Colors.grey),
            const SizedBox(height: 24),
            Text(
              '페이지를 찾을 수 없습니다',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              '경로: $path',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey,
                  ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => context.go('/'),
              icon: const Icon(Icons.home),
              label: const Text('홈으로 돌아가기'),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 9. 네비게이션 전환 애니메이션

### 9.1 기본 전환 효과

GoRouter의 `pageBuilder`를 사용하여 커스텀 전환 효과를 적용할 수 있습니다.

```dart
GoRoute(
  path: '/driver/order/:orderId',
  pageBuilder: (context, state) {
    final orderId = state.pathParameters['orderId']!;
    return CustomTransitionPage(
      key: state.pageKey,
      child: OrderDetailScreen(orderId: orderId),
      transitionsBuilder: (ctx, animation, secondaryAnimation, child) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(1.0, 0.0),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeInOut,
          )),
          child: child,
        );
      },
    );
  },
),
```

### 9.2 전환 효과 권장 사항

| 전환 유형 | 적용 대상 | 효과 |
|-----------|----------|------|
| **없음 (즉시)** | 사이드바 메뉴 전환 | 탭처럼 빠르게 |
| **Slide (오른쪽→왼쪽)** | 주문 목록 → 주문 상세 | push 느낌 |
| **Fade** | 로그인 → 메인 화면 | 부드러운 전환 |
| **Scale + Fade** | 모달 열기 | 강조 효과 |

### 9.3 플랫폼별 기본 전환

```dart
// 플랫폼에 따라 자동으로 적합한 전환 효과 적용
CustomTransitionPage _adaptiveTransition({
  required LocalKey key,
  required Widget child,
}) {
  return CustomTransitionPage(
    key: key,
    child: child,
    transitionsBuilder: (ctx, animation, secondaryAnimation, child) {
      // Web은 fade, 모바일은 slide
      if (kIsWeb) {
        return FadeTransition(opacity: animation, child: child);
      }
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(1.0, 0.0),
          end: Offset.zero,
        ).animate(animation),
        child: child,
      );
    },
  );
}
```

---

## 10. 라우트 관련 폴더 구조

```
lib/
├── router/
│   ├── app_router.dart          ← GoRouter 설정 + 라우트 정의
│   ├── shell_screen.dart        ← ShellRoute builder
│   └── route_constants.dart     ← 경로 문자열 상수
├── screens/
│   ├── login_screen.dart
│   ├── not_found_screen.dart
│   ├── floor2/
│   │   ├── my_orders_screen.dart
│   │   └── new_order_screen.dart
│   ├── floor1/
│   │   └── all_orders_screen.dart
│   ├── driver/
│   │   ├── my_deliveries_screen.dart
│   │   └── order_detail_screen.dart
│   └── admin/
│       ├── admin_all_orders_screen.dart
│       ├── manage_products_screen.dart
│       ├── manage_categories_screen.dart
│       ├── manage_drivers_screen.dart
│       └── statistics_screen.dart
└── widgets/
    ├── app_sidebar.dart
    ├── app_bottom_nav.dart
    ├── delivery_panel.dart
    └── chat_panel.dart
```

### 경로 상수 정의 (하드코딩 방지)

```dart
// lib/router/route_constants.dart
class AppRoutes {
  static const login = '/login';

  // floor2
  static const floor2MyOrders = '/floor2/my-orders';
  static const floor2NewOrder = '/floor2/new-order';

  // floor1
  static const floor1AllOrders = '/floor1/all-orders';

  // driver
  static const driverMyDeliveries = '/driver/my-deliveries';
  static String driverOrderDetail(String orderId) =>
      '/driver/order/$orderId';

  // admin
  static const adminAllOrders = '/admin/all-orders';
  static const adminProducts = '/admin/products';
  static const adminCategories = '/admin/categories';
  static const adminDrivers = '/admin/drivers';
  static const adminStatistics = '/admin/statistics';
}
```

사용 예시:

```dart
// 하드코딩 대신 상수 사용
context.go(AppRoutes.adminProducts);
context.push(AppRoutes.driverOrderDetail('order-abc'));
```

---

## 11. 주의사항

1. **GoRouter 인스턴스를 `ref.watch`로 재생성할 때, 기존 네비게이션 히스토리가 초기화됩니다.** 로그인/로그아웃 시에만 재생성되도록 `authProvider`만 watch하세요.
2. **Web에서 브라우저 뒤로 가기 버튼을 누르면 `context.pop()`과 동일하게 동작합니다.** `go`로 이동한 페이지에서는 뒤로 가기가 작동하지 않으므로 주의하세요.
3. **ShellRoute 안의 라우트끼리 전환할 때 ShellScreen은 리빌드되지 않습니다.** 이것이 ShellRoute의 핵심 장점입니다.
4. **경로에 한글을 사용하지 마세요.** URL 인코딩 문제가 발생합니다. 경로는 항상 영문 소문자 + 하이픈으로 작성합니다.
5. **`:orderId` 같은 path parameter는 `state.pathParameters['orderId']`로 접근합니다.** `state.params`는 deprecated이므로 사용하지 마세요.

---

이전 문서:
- [07-state-management.md](./07-state-management.md) — 상태 관리

다음 문서:
- [09-ui-design-system.md](./09-ui-design-system.md) — UI 디자인 시스템

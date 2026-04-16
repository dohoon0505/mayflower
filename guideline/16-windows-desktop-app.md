# 16. Flutter Web vs Flutter Desktop — 사무직 클라이언트 선택 가이드

> **대상 독자:** 사무직용 클라이언트를 Flutter Web으로 갈지 Flutter Desktop(Windows)으로 갈지 판단해야 하는 의사결정자 및 개발자  
> **목표:** 두 플랫폼의 디자인 자유도·기능·배포·비용을 객관적으로 비교하고, 각각 별도 구현 시 공유 코드와 분리 코드를 명확히 정의

---

## 1. 전제 — 두 가지 모두 Flutter(Dart)

Flutter Web과 Flutter Desktop은 **같은 언어(Dart), 같은 프레임워크(Flutter)**를 사용합니다. 차이는 **빌드 타겟과 렌더링 엔진**뿐입니다.

```
Flutter 코드베이스 (Dart)
 │
 ├── flutter build web       → 브라우저에서 실행 (HTML/JS/WASM)
 ├── flutter build windows   → Windows .exe 설치형 앱
 ├── flutter build apk       → Android 앱
 └── flutter build ios       → iOS 앱
```

> ⚠️ **이 문서의 핵심:** Web과 Desktop은 **각각 별도 UI 구현이 필요**합니다.  
> 모델·서비스·Provider 등 비즈니스 로직은 공유하되, **화면(Screen/Widget) 레이어는 플랫폼별로 따로 작성**합니다.

---

## 2. 종합 비교표

### 2.1 핵심 항목 비교

| 항목 | Flutter Web | Flutter Desktop (Windows) |
|------|:-----------:|:-------------------------:|
| **실행 방식** | 브라우저에서 URL 접속 | .exe 설치 후 바탕화면 아이콘 실행 |
| **렌더링 엔진** | CanvasKit (WebAssembly) 또는 HTML | Skia → Direct3D (네이티브) |
| **설치 필요** | ❌ 없음 | ✅ 설치 프로그램 (.exe / MSIX) |
| **업데이트 배포** | 서버 배포 1번 → 모든 사용자 즉시 반영 | 설치 파일 재배포 (자동 업데이터 별도 구현) |
| **Firebase SDK** | ✅ 완전 지원 (firebase_core 웹 빌드) | ✅ 지원 (firebase_core_desktop, 일부 제한) |
| **오프라인 동작** | ⚠️ 제한적 (Service Worker 캐시) | ✅ 로컬 DB 캐시 후 동기화 가능 |
| **렌더링 성능** | ★★★☆☆ (JS 엔진 / WASM 의존) | ★★★★★ (네이티브 GPU 직접 렌더링) |
| **초기 로딩** | ⚠️ main.dart.js 다운로드 (2~5초) | ✅ 즉시 시작 (로컬 바이너리) |
| **메모리 사용** | 브라우저 탭 기준 (Chrome 기본 ~150MB) | 자체 프로세스 (~80~120MB) |

### 2.2 디자인 자유도 비교

| 세부 항목 | Flutter Web | Flutter Desktop |
|-----------|:-----------:|:---------------:|
| 커스텀 위젯 (버튼, 카드, 차트) | ✅ 완전 자유 | ✅ 완전 자유 |
| 애니메이션 (60fps) | ✅ | ✅ (더 안정적) |
| 그림자 / 그라데이션 / 블러 | ✅ | ✅ |
| 커스텀 윈도우 프레임 (타이틀바 제거) | ❌ 브라우저 프레임 고정 | ✅ `window_manager` 패키지 |
| 투명 / 반투명 윈도우 | ❌ | ✅ |
| 시스템 트레이 아이콘 | ❌ | ✅ `system_tray` 패키지 |
| 네이티브 메뉴바 (파일/편집/...) | ❌ | ✅ `PlatformMenuBar` 위젯 |
| 멀티 윈도우 (주문 상세 팝업 등) | ❌ 탭/모달로 대체 | ✅ `desktop_multi_window` |
| 드래그 & 드롭 (파일 끌어넣기) | ⚠️ HTML5 API 기반 (제한적) | ✅ `desktop_drop` 패키지 |
| 키보드 단축키 (Ctrl+N 등) | ⚠️ 브라우저 기본 단축키와 충돌 가능 | ✅ 완전 자유 (OS 수준 인터셉트) |
| 우클릭 컨텍스트 메뉴 | ⚠️ 브라우저 기본 메뉴 겹침 | ✅ 완전 커스텀 |
| 글꼴 렌더링 | ⚠️ 브라우저/OS별 차이 있음 | ✅ Skia 일관 렌더링 |
| 스크롤바 스타일 | ⚠️ OS/브라우저별 다름 | ✅ 완전 커스텀 |

### 2.3 기능 비교 (메이대구 업무 관련)

| 기능 | Flutter Web | Flutter Desktop |
|------|:-----------:|:---------------:|
| 주문 CRUD | ✅ | ✅ |
| 실시간 채팅 (Firebase) | ✅ | ✅ |
| 배송 패널 실시간 | ✅ | ✅ |
| 로그인 / 세션 | ✅ Firebase Auth | ✅ Firebase Auth |
| 사진 보기 / 확대 | ✅ | ✅ (더 부드러움) |
| 통계 차트 | ✅ fl_chart | ✅ fl_chart |
| 프린터 출력 | ⚠️ `window.print()` 뿐 (제어 불가) | ✅ `printing` 패키지 (레이아웃 자유) |
| 로컬 파일 저장/읽기 | ❌ 샌드박스 제한 | ✅ `dart:io` 직접 파일 접근 |
| 시작 시 자동 실행 | ❌ | ✅ `launch_at_startup` |
| 백그라운드 실행 (트레이 최소화) | ❌ 탭 닫으면 종료 | ✅ |
| 신규 주문 알림 (포커스 없을 때) | ⚠️ 브라우저 Notification API | ✅ 네이티브 토스트 알림 |
| 바코드/QR 스캐너 연동 | ❌ | ✅ 시리얼/USB HID 접근 가능 |
| 엑셀 파일 직접 내보내기 | ⚠️ JS 라이브러리 한계 | ✅ `syncfusion_flutter_xlsio` 등 |

### 2.4 배포 & 운영 비교

| 항목 | Flutter Web | Flutter Desktop |
|------|:-----------:|:---------------:|
| **배포 방법** | Firebase Hosting (`firebase deploy`) | 설치파일 배포 (공유폴더/이메일/내부 서버) |
| **업데이트** | 서버 1회 배포 → 새로고침만 하면 반영 | 수동 재설치 또는 자동 업데이터 구현 필요 |
| **사용자 관리** | 없음 (URL 접속 즉시) | PC마다 설치 + 설정 필요 |
| **OS 호환** | Windows, macOS, Linux, ChromeOS | Windows 전용 (macOS는 별도 빌드) |
| **PC 사양 의존** | 브라우저만 돌아가면 됨 | 최소 Windows 10 64bit |
| **오프라인 대응** | ❌ 인터넷 필수 | ✅ 로컬 캐시 + 재연결 시 동기화 |
| **비용** | Firebase Hosting 무료 티어 충분 | 배포 인프라 자체 관리 |

---

## 3. 코드 구조 — 공유 vs 분리

두 플랫폼을 각각 구현할 때, **공유할 수 있는 코드와 분리해야 하는 코드**를 명확히 나눕니다.

### 3.1 공유 코드 (약 60~70%)

| 레이어 | 내용 | 파일 위치 |
|--------|------|-----------|
| **Models** | Order, User, Driver, Product, ChatMessage | `lib/models/` |
| **Services** | OrderService, ChatService, AuthService, StorageService | `lib/services/` |
| **Providers** | ordersProvider, authProvider, chatProvider 등 (Riverpod) | `lib/providers/` |
| **Constants** | 주문 상태 코드, 색상, 문자열 | `lib/core/constants/` |
| **Utils** | 날짜 포맷, 유효성 검증, 문자열 유틸 | `lib/core/utils/` |
| **Theme** | AppColors, AppTextStyles (색상/폰트 정의) | `lib/core/theme/` |

### 3.2 분리 코드 — 플랫폼별 UI (약 30~40%)

| | Flutter Web | Flutter Desktop |
|---|-------------|-----------------|
| **Shell (메인 레이아웃)** | `web_shell_screen.dart` — 브라우저 탭 내 4열 그리드 | `desktop_shell_screen.dart` — 커스텀 윈도우 프레임 + 4열 그리드 |
| **로그인 화면** | 브라우저 중앙 카드 | 커스텀 윈도우 (작은 창, 드래그 가능) |
| **사이드바** | 웹 드로어 (반응형) | 윈도우 왼쪽 고정 (네이티브 느낌) |
| **채팅 패널** | 우측 패널 (CSS-like) | 우측 패널 또는 분리 윈도우 |
| **알림** | 브라우저 Notification API | 네이티브 토스트 + 시스템 트레이 |
| **단축키** | 제한적 바인딩 | `HardwareKeyboard` 완전 활용 |
| **인쇄** | `window.print()` | `printing` 패키지 (레이아웃 커스텀) |

### 3.3 프로젝트 구조 (단일 프로젝트 — 조건부 분기)

```
maydaegu_app/
├── lib/
│   ├── main.dart                        ← 공통 진입점
│   ├── app.dart                         ← MaterialApp + 라우터 (플랫폼 분기)
│   │
│   ├── core/                            ← 🔄 100% 공유
│   │   ├── constants/
│   │   │   ├── app_colors.dart
│   │   │   ├── order_status.dart
│   │   │   └── breakpoints.dart
│   │   ├── theme/
│   │   │   └── app_theme.dart
│   │   ├── utils/
│   │   │   ├── date_utils.dart
│   │   │   └── validators.dart
│   │   └── widgets/                     ← 🔄 공유 위젯 (플랫폼 무관)
│   │       ├── app_button.dart
│   │       ├── badge_widget.dart
│   │       ├── order_card.dart          ← 카드 UI는 공유 가능
│   │       ├── chat_bubble.dart
│   │       └── status_chip.dart
│   │
│   ├── models/                          ← 🔄 100% 공유
│   │   ├── order.dart
│   │   ├── user.dart
│   │   ├── driver.dart
│   │   ├── product.dart
│   │   └── chat_message.dart
│   │
│   ├── services/                        ← 🔄 100% 공유
│   │   ├── auth_service.dart
│   │   ├── order_service.dart
│   │   ├── chat_service.dart
│   │   ├── driver_service.dart
│   │   ├── product_service.dart
│   │   └── storage_service.dart
│   │
│   ├── providers/                       ← 🔄 100% 공유
│   │   ├── auth_provider.dart
│   │   ├── order_provider.dart
│   │   ├── chat_provider.dart
│   │   ├── driver_provider.dart
│   │   └── product_provider.dart
│   │
│   ├── screens/
│   │   ├── login/
│   │   │   ├── login_screen.dart        ← 🔄 공유 가능 (간단한 폼)
│   │   │   └── login_form.dart
│   │   │
│   │   ├── web/                         ← 🌐 Web 전용 화면
│   │   │   ├── web_shell.dart           ← 브라우저 내 Shell (Row 레이아웃)
│   │   │   ├── web_sidebar.dart
│   │   │   ├── web_chat_panel.dart
│   │   │   ├── web_delivery_panel.dart
│   │   │   ├── floor2/
│   │   │   │   ├── web_my_orders.dart
│   │   │   │   └── web_new_order.dart
│   │   │   ├── floor1/
│   │   │   │   └── web_all_orders.dart
│   │   │   └── admin/
│   │   │       ├── web_admin_orders.dart
│   │   │       ├── web_products.dart
│   │   │       ├── web_categories.dart
│   │   │       ├── web_drivers.dart
│   │   │       └── web_statistics.dart
│   │   │
│   │   ├── desktop/                     ← 🖥️ Desktop 전용 화면
│   │   │   ├── desktop_shell.dart       ← 커스텀 윈도우 Shell
│   │   │   ├── desktop_titlebar.dart    ← 커스텀 타이틀바
│   │   │   ├── desktop_sidebar.dart
│   │   │   ├── desktop_chat_panel.dart
│   │   │   ├── desktop_delivery_panel.dart
│   │   │   ├── desktop_tray.dart        ← 시스템 트레이 로직
│   │   │   ├── floor2/
│   │   │   │   ├── desktop_my_orders.dart
│   │   │   │   └── desktop_new_order.dart
│   │   │   ├── floor1/
│   │   │   │   └── desktop_all_orders.dart
│   │   │   └── admin/
│   │   │       ├── desktop_admin_orders.dart
│   │   │       ├── desktop_products.dart
│   │   │       ├── desktop_categories.dart
│   │   │       ├── desktop_drivers.dart
│   │   │       └── desktop_statistics.dart
│   │   │
│   │   └── driver/                      ← 📱 모바일 기사 전용 (기존)
│   │       ├── my_deliveries_screen.dart
│   │       ├── order_detail_screen.dart
│   │       └── driver_chat_screen.dart
│   │
│   └── router/
│       ├── app_router.dart              ← 플랫폼별 라우트 분기
│       ├── web_routes.dart              ← Web 전용 라우트 정의
│       └── desktop_routes.dart          ← Desktop 전용 라우트 정의
│
├── web/                                 ← Web 빌드 설정
├── windows/                             ← Windows 빌드 설정 (C++ embedder)
├── android/
├── ios/
└── pubspec.yaml
```

### 3.4 플랫폼 분기 패턴

```dart
// lib/app.dart — 진입점에서 플랫폼별 Shell 선택
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:io' show Platform;

class MaydaeguApp extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: '메이대구',
      theme: AppTheme.light,
      routerConfig: router,
    );
  }
}

// lib/router/app_router.dart
final routerProvider = Provider<GoRouter>((ref) {
  final session = ref.watch(authProvider);

  // 플랫폼에 따라 다른 라우트 트리 사용
  if (kIsWeb) {
    return _buildWebRouter(ref, session);
  } else if (Platform.isWindows) {
    return _buildDesktopRouter(ref, session);
  } else {
    return _buildMobileRouter(ref, session);  // Android/iOS 기사 전용
  }
});

GoRouter _buildWebRouter(Ref ref, Session? session) {
  return GoRouter(
    redirect: (ctx, state) => _webRedirect(ref, session, state),
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      ShellRoute(
        builder: (_, __, child) => WebShell(child: child),  // 🌐 Web Shell
        routes: webRoutes,  // floor2, floor1, admin 라우트
      ),
    ],
  );
}

GoRouter _buildDesktopRouter(Ref ref, Session? session) {
  return GoRouter(
    redirect: (ctx, state) => _desktopRedirect(ref, session, state),
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const DesktopLoginWindow()),
      ShellRoute(
        builder: (_, __, child) => DesktopShell(child: child),  // 🖥️ Desktop Shell
        routes: desktopRoutes,  // 동일 기능이지만 Desktop UI
      ),
    ],
  );
}
```

---

## 4. Flutter Desktop 구현 가이드 (Web과 다른 점)

### 4.1 윈도우 관리 (window_manager)

Web에는 없는 Desktop 전용 기능입니다.

```yaml
# pubspec.yaml (Desktop 전용 의존성)
dependencies:
  window_manager: ^0.3.8       # 윈도우 크기/위치/프레임 제어
  system_tray: ^2.0.3          # 시스템 트레이 아이콘
  launch_at_startup: ^0.2.2    # Windows 시작 시 자동 실행
  desktop_drop: ^0.4.4         # 파일 드래그 & 드롭
  local_notifier: ^0.1.6       # 네이티브 알림 토스트
  printing: ^5.12.0            # 프린터 직접 제어
  screen_retriever: ^0.1.9     # 멀티 모니터 정보
```

```dart
// lib/main.dart — Desktop 전용 초기화
import 'package:window_manager/window_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Desktop인 경우에만 윈도우 설정
  if (!kIsWeb && Platform.isWindows) {
    await windowManager.ensureInitialized();
    const windowOptions = WindowOptions(
      size: Size(1600, 900),
      minimumSize: Size(1200, 700),
      center: true,
      title: '메이대구 — 사내 업무 관리',
      titleBarStyle: TitleBarStyle.hidden,  // 커스텀 타이틀바 사용
      backgroundColor: Colors.transparent,
    );
    windowManager.waitUntilReadyToShow(windowOptions, () async {
      await windowManager.show();
      await windowManager.focus();
    });
  }

  runApp(const ProviderScope(child: MaydaeguApp()));
}
```

### 4.2 커스텀 타이틀바

```dart
// lib/screens/desktop/desktop_titlebar.dart
class DesktopTitlebar extends StatelessWidget {
  final String title;
  const DesktopTitlebar({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanStart: (_) => windowManager.startDragging(),  // 드래그로 창 이동
      child: Container(
        height: 40,
        color: AppColors.bgBase,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            // 앱 아이콘
            Image.asset('assets/logo.png', width: 20, height: 20),
            const SizedBox(width: 10),
            Text(title,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const Spacer(),

            // 창 제어 버튼
            _TitleButton(
              icon: Icons.minimize,
              onPressed: () => windowManager.minimize(),
            ),
            _TitleButton(
              icon: Icons.crop_square,
              onPressed: () async {
                if (await windowManager.isMaximized()) {
                  windowManager.unmaximize();
                } else {
                  windowManager.maximize();
                }
              },
            ),
            _TitleButton(
              icon: Icons.close,
              onPressed: () => windowManager.close(),
              hoverColor: AppColors.danger,
            ),
          ],
        ),
      ),
    );
  }
}
```

### 4.3 시스템 트레이 (백그라운드 실행)

```dart
// lib/screens/desktop/desktop_tray.dart
import 'package:system_tray/system_tray.dart';

class TrayManager {
  final SystemTray _tray = SystemTray();

  Future<void> init() async {
    await _tray.initSystemTray(
      title: '메이대구',
      iconPath: 'assets/tray_icon.ico',
      toolTip: '메이대구 — 사내 업무 관리',
    );

    final menu = Menu();
    await menu.buildFrom([
      MenuItemLabel(label: '열기', onClicked: (_) => windowManager.show()),
      MenuSeparator(),
      MenuItemLabel(label: '종료', onClicked: (_) => windowManager.destroy()),
    ]);
    await _tray.setContextMenu(menu);

    // 트레이 아이콘 클릭 시 창 표시
    _tray.registerSystemTrayEventHandler((eventName) {
      if (eventName == kSystemTrayEventClick) {
        windowManager.show();
        windowManager.focus();
      }
    });
  }

  /// 신규 주문 알림 시 트레이 아이콘 깜빡임
  Future<void> flashForNewOrder() async {
    await _tray.setImage('assets/tray_icon_alert.ico');
    // 3초 후 복원
    Future.delayed(const Duration(seconds: 3), () {
      _tray.setImage('assets/tray_icon.ico');
    });
  }
}
```

### 4.4 네이티브 알림 (포커스 없을 때)

```dart
// Desktop 전용 — 주문 접수 시 알림
import 'package:local_notifier/local_notifier.dart';

class DesktopNotificationService {
  static Future<void> showOrderNotification({
    required String title,
    required String body,
  }) async {
    final notification = LocalNotification(
      title: title,
      body: body,
      actions: [
        LocalNotificationAction(text: '확인'),
      ],
    );
    notification.onClick = () {
      windowManager.show();
      windowManager.focus();
      // 해당 주문 화면으로 이동
    };
    await notification.show();
  }
}
```

### 4.5 프린터 직접 제어 (영수증·주문서 출력)

```dart
// Desktop 전용 — Web에서는 window.print()만 가능
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

class PrintService {
  static Future<void> printOrderSheet(Order order) async {
    final doc = pw.Document();
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text('메이대구 주문서',
                style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 20),
              pw.Table.fromTextArray(
                headers: ['항목', '내용'],
                data: [
                  ['체인명', order.chainName],
                  ['상품', order.productName],
                  ['받는분', order.recipientName],
                  ['배송지', order.deliveryAddress],
                  ['리본 문구', order.ribbonText],
                  ['배송 시간', order.deliveryDatetime.toString()],
                ],
              ),
            ],
          );
        },
      ),
    );

    // 프린터 선택 다이얼로그 표시
    await Printing.layoutPdf(
      onLayout: (format) async => doc.save(),
    );
  }
}
```

### 4.6 키보드 단축키 (Web에서 불가능한 것들)

```dart
// lib/screens/desktop/desktop_shell.dart (일부)
class DesktopShell extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return CallbackShortcuts(
      bindings: {
        // Ctrl+N → 신규 주문
        const SingleActivator(LogicalKeyboardKey.keyN, control: true): () {
          context.go('/admin/new-order');
        },
        // Ctrl+F → 검색 포커스
        const SingleActivator(LogicalKeyboardKey.keyF, control: true): () {
          FocusScope.of(context).requestFocus(_searchFocusNode);
        },
        // Ctrl+P → 현재 주문 인쇄
        const SingleActivator(LogicalKeyboardKey.keyP, control: true): () {
          // 선택된 주문 인쇄
          PrintService.printOrderSheet(selectedOrder);
        },
        // F5 → 새로고침 (데이터 리로드)
        const SingleActivator(LogicalKeyboardKey.f5): () {
          ref.invalidate(ordersProvider);
        },
        // Escape → 모달 닫기
        const SingleActivator(LogicalKeyboardKey.escape): () {
          Navigator.of(context).maybePop();
        },
      },
      child: Focus(
        autofocus: true,
        child: _buildLayout(context),
      ),
    );
  }
}
```

### 4.7 Desktop Shell 레이아웃

```dart
// lib/screens/desktop/desktop_shell.dart
class DesktopShell extends ConsumerWidget {
  final Widget child;
  const DesktopShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authProvider);

    return Scaffold(
      body: Column(
        children: [
          // 커스텀 타이틀바 (Web에는 없음)
          const DesktopTitlebar(title: '메이대구'),

          // 메인 영역 — Web Shell과 레이아웃은 유사하지만 별도 구현
          Expanded(
            child: Row(
              children: [
                // 사이드바
                DesktopSidebar(role: session?.role ?? ''),

                // 메인 콘텐츠
                Expanded(child: child),

                // 배송 패널 (admin만)
                if (session?.role == 'admin')
                  const SizedBox(
                    width: 360,
                    child: DesktopDeliveryPanel(),
                  ),

                // 채팅 패널
                const SizedBox(
                  width: 500,
                  child: DesktopChatPanel(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## 5. 빌드 & 배포

### 5.1 Flutter Web 배포

```bash
# 빌드
flutter build web --release --web-renderer canvaskit

# Firebase Hosting 배포
firebase deploy --only hosting

# 결과: https://maydaegu.web.app (즉시 모든 사용자 접근)
```

### 5.2 Flutter Desktop 배포

```bash
# 빌드
flutter build windows --release

# 출력: build/windows/x64/runner/Release/
#   ├── maydaegu_app.exe
#   ├── flutter_windows.dll
#   ├── data/
#   └── *.dll (Visual C++ 런타임 등)
```

#### 설치 프로그램 생성 (Inno Setup)

```
; installer/setup.iss
[Setup]
AppName=메이대구
AppVersion=1.0.0
DefaultDirName={autopf}\Maydaegu
DefaultGroupName=메이대구
OutputBaseFilename=maydaegu_setup
Compression=lzma2

[Files]
Source: "..\build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\메이대구"; Filename: "{app}\maydaegu_app.exe"
Name: "{autodesktop}\메이대구"; Filename: "{app}\maydaegu_app.exe"

[Run]
Filename: "{app}\maydaegu_app.exe"; Description: "메이대구 실행"; Flags: postinstall nowait
```

#### MSIX 패키지 (Microsoft Store / 사내 배포)

```yaml
# pubspec.yaml
dev_dependencies:
  msix: ^3.16.7

msix_config:
  display_name: 메이대구
  publisher_display_name: Maydaegu
  identity_name: com.maydaegu.desktop
  logo_path: assets/logo.png
  capabilities: internetClient
```

```bash
flutter pub run msix:create
# 출력: build/windows/x64/runner/Release/maydaegu_app.msix
```

### 5.3 자동 업데이트 (Desktop 전용 과제)

Web은 서버 배포만 하면 끝이지만, Desktop은 자동 업데이트를 직접 구현해야 합니다:

```dart
// lib/services/auto_updater.dart (Desktop 전용)
class AutoUpdater {
  static const _versionCheckUrl = 'https://maydaegu.web.app/version.json';

  /// 앱 시작 시 버전 체크
  static Future<void> checkForUpdate(String currentVersion) async {
    try {
      final response = await http.get(Uri.parse(_versionCheckUrl));
      final latest = jsonDecode(response.body);

      if (latest['version'] != currentVersion) {
        // 업데이트 안내 다이얼로그 표시
        // 다운로드 URL: latest['downloadUrl']
        _showUpdateDialog(latest['version'], latest['downloadUrl']);
      }
    } catch (_) {
      // 네트워크 오류 시 무시 (다음 실행 시 재시도)
    }
  }
}
```

---

## 6. 의사결정 체크리스트

아래 체크리스트로 어떤 플랫폼이 더 적합한지 판단하세요.

### Flutter Web이 유리한 경우 ✅

- [ ] 직원 PC에 **설치 없이** 바로 접속하고 싶다
- [ ] **업데이트를 한 번 배포하면 모든 PC에 즉시 반영**되어야 한다
- [ ] 직원이 **여러 PC를 옮겨다니며** 사용한다
- [ ] Windows 외에 macOS/ChromeOS/iPad를 쓰는 직원이 있을 수 있다
- [ ] 프린터 출력은 `Ctrl+P` (브라우저 인쇄) 정도면 충분하다
- [ ] 별도 설치 관리(IT 관리자)할 여력이 없다

### Flutter Desktop이 유리한 경우 🖥️

- [ ] 주문서/영수증을 **프린터로 정형화된 양식**으로 직접 출력해야 한다
- [ ] 시스템 트레이에 상주하면서 **신규 주문 시 네이티브 알림**을 받고 싶다
- [ ] 브라우저를 닫아도 **백그라운드에서 계속 실행**되어야 한다
- [ ] `Ctrl+N` (신규 주문), `Ctrl+F` (검색) 등 **키보드 단축키를 자유롭게** 쓰고 싶다
- [ ] **커스텀 윈도우 프레임** (타이틀바 디자인, 투명 창) 이 필요하다
- [ ] **인터넷이 불안정한 환경**에서도 최소한의 동작(캐시된 데이터 조회)이 되어야 한다
- [ ] 설치 파일 배포 & 업데이트 관리를 감수할 수 있다

---

## 7. 개발 일정 비교

두 플랫폼 각각 별도 UI를 구현할 때의 추가 공수 추정:

### 기준: 공유 레이어 개발 완료 후

| 작업 | Web UI 구현 | Desktop UI 구현 |
|------|:-----------:|:---------------:|
| Shell + 사이드바 | 3일 | 5일 (타이틀바, 트레이 추가) |
| 로그인 | 1일 | 2일 (커스텀 윈도우) |
| floor2 화면 (2개) | 3일 | 3일 |
| floor1 화면 (1개) | 2일 | 2일 |
| admin 화면 (5개) | 7일 | 7일 |
| 배송 패널 | 3일 | 3일 |
| 채팅 패널 | 3일 | 3일 |
| 프린터 출력 | 0일 (브라우저 print) | 3일 (PDF 레이아웃) |
| 시스템 트레이 | 0일 | 2일 |
| 키보드 단축키 | 1일 | 2일 |
| 알림 (포커스 없을 때) | 1일 (Notification API) | 2일 (native toast) |
| 자동 업데이트 | 0일 (서버 배포 끝) | 3일 |
| 설치 프로그램 | 0일 | 2일 (Inno Setup / MSIX) |
| **합계** | **~24일** | **~37일** |

> 두 플랫폼 동시 개발 시 총 **~61일** (공유 레이어 제외).  
> 우선순위를 정해 하나를 먼저 완성하고, 이후에 다른 쪽을 추가하는 것이 효율적입니다.

---

## 8. 추천 전략

```
Phase 1 — Flutter Web 먼저 완성 (3~4주)
│  가이드라인 01~15 기반
│  사무직 전원이 즉시 사용 가능 (설치 불필요)
│  동시에 기사 앱(Android/iOS)도 빌드
│
Phase 2 — 실사용 피드백 수집 (2주)
│  "프린터 출력이 불편하다"
│  "백그라운드 알림이 필요하다"
│  "브라우저 단축키가 충돌한다"
│  → 실제 불편함이 확인되면 Phase 3
│
Phase 3 — Flutter Desktop 추가 구현 (2~3주)
│  flutter create --platforms windows .
│  screens/desktop/ 폴더에 Desktop 전용 UI 작성
│  공유 레이어(모델/서비스/Provider) 그대로 재사용
│  Desktop 전용 기능 추가 (트레이, 프린터, 단축키)
│
결과: Web / Desktop 동시 제공
  → 사무직이 선호하는 방식 선택
  → 시간이 지나면 하나로 수렴
```

---

## 9. 요약

| | Flutter Web | Flutter Desktop |
|---|---|---|
| **강점** | 설치 불필요, 즉시 배포, OS 무관 | 네이티브 경험, OS 연동, 오프라인 |
| **약점** | 브라우저 제약 (프린터, 트레이, 단축키) | 설치/업데이트 관리 부담 |
| **공유 코드** | 모델 + 서비스 + Provider (60~70%) | ← 동일 |
| **별도 구현** | `screens/web/` (30~40%) | `screens/desktop/` (30~40%) |
| **개발 기간** | ~24일 (UI만) | ~37일 (UI + OS 기능) |
| **먼저 할 것** | ⭐ **먼저 구현 권장** | 피드백 후 추가 |

> 두 플랫폼 모두 **같은 Dart 코드베이스**에서 나오므로, 하나를 완성한 뒤 다른 쪽을 추가하는 데 전체 재작성이 필요하지 않습니다.

---

이전 문서:
- [01-project-overview.md](./01-project-overview.md) — 프로젝트 전체 개요
- [02-system-architecture.md](./02-system-architecture.md) — 시스템 아키텍처
- [13-build-deploy.md](./13-build-deploy.md) — 빌드 & 배포 가이드

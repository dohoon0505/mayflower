# 06. 인증 및 권한 관리

> **대상 독자:** 인증(로그인) 기능을 구현하는 Flutter 개발자, Firebase 보안을 담당하는 백엔드 개발자
> **목표:** 현재 평문 비밀번호(`passwordHash: '1234'`) 체계를 Firebase Authentication으로 전환하고, 역할 기반 접근 제어(RBAC)를 앱 전체에 적용

---

## 1. 현재 문제점 분석

### 보안 취약점

현재 `js/store.js`에 저장된 사용자 데이터:

```javascript
// 현재 — 절대 이대로 운영하면 안 됩니다
{ id: 1, username: 'floor2', passwordHash: '1234', role: 'floor2', ... }
{ id: 3, username: 'admin',  passwordHash: '1234', role: 'admin',  ... }
```

| 문제 | 위험도 | 설명 |
|------|--------|------|
| **평문 비밀번호** | 치명적 | `'1234'`가 그대로 저장됨. 해싱도 없음 |
| **localStorage 저장** | 높음 | 브라우저 개발자 도구에서 누구나 열람 가능 |
| **세션 위조** | 높음 | `sessionStorage`에 role을 직접 넣으므로 변조 가능 |
| **서버 검증 없음** | 높음 | 클라이언트에서만 비밀번호를 비교, 서버(Firebase) 검증 없음 |
| **모든 사용자 같은 비밀번호** | 중간 | 전원 `'1234'` 사용 |

### 현재 인증 흐름 (`js/auth.js`)

```
1. username + password 입력
2. localStorage에서 users 배열 조회
3. passwordHash === password 비교 (평문!)
4. 일치하면 sessionStorage에 세션 저장
5. role에 따라 화면 분기
```

---

## 2. Firebase Authentication 전환

### 옵션 A: 이메일 + 비밀번호 (권장)

각 직원에게 내부 이메일 주소를 부여합니다. 실제 메일 수신이 필요 없으므로 가상 도메인을 사용합니다.

| username | Firebase Auth 이메일 | 역할 |
|----------|---------------------|------|
| `floor2` | `floor2@maydaegu.internal` | 2층 수주 |
| `floor1` | `floor1@maydaegu.internal` | 1층 제작 |
| `admin` | `admin@maydaegu.internal` | 관리자 |
| `driver1` | `driver1@maydaegu.internal` | 배송 기사 |
| `driver2` | `driver2@maydaegu.internal` | 배송 기사 |
| ... | ... | ... |

**장점:**
- Firebase가 비밀번호 해싱, 세션 토큰 관리를 자동 처리
- SDK 함수 하나로 로그인 (`signInWithEmailAndPassword`)
- 세션 자동 유지 (앱 재시작 시에도 로그인 상태 유지)
- 보안 규칙에서 `auth.uid`로 접근 제어

**단점:**
- username을 이메일로 변환하는 한 단계가 추가됨

### 옵션 B: Custom Token (자체 username 유지)

기존 username/password 체계를 유지하면서 서버에서 Custom Token을 발급합니다.

```
1. 앱 → Cloud Function에 username + password 전송
2. Function에서 검증 후 admin.auth().createCustomToken(uid) 발급
3. 앱에서 signInWithCustomToken(token) 호출
```

**장점:**
- 기존 username 로그인 UX 유지

**단점:**
- Cloud Functions 필수 (서버 코드 작성/관리)
- 비밀번호 검증 로직을 직접 구현해야 함
- 복잡도 증가

**결론: 옵션 A를 권장합니다.** 이메일 변환은 단순한 문자열 연결이고, 보안과 유지보수에서 월등히 유리합니다.

---

## 3. 로그인 플로우 상세

### 전체 흐름도

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ 로그인 화면 │ ──► │ username →   │ ──► │ Firebase Auth │ ──► │ /users/{uid}  │
│           │     │ 이메일 변환    │     │ 로그인 요청    │     │ role 조회     │
│ username  │     │              │     │              │     │              │
│ password  │     │ floor2 →     │     │ signIn()     │     │ role: floor2  │
│           │     │ floor2@...   │     │ ✓ uid 반환    │     │ name: 2층    │
└──────────┘     └─────────────┘     └──────────────┘     └──────────────┘
                                                                  │
                                                                  ▼
                                                           ┌──────────────┐
                                                           │ 세션 저장      │
                                                           │ (Riverpod     │
                                                           │  authProvider) │
                                                           │              │
                                                           │ → 역할별 화면  │
                                                           │   리다이렉트   │
                                                           └──────────────┘
```

### 단계별 상세

1. **사용자가 username + password 입력**
   - 예: `floor2`, `myPassword123`

2. **username을 이메일로 변환**
   ```dart
   String usernameToEmail(String username) {
     return '${username.trim().toLowerCase()}@maydaegu.internal';
   }
   // floor2 → floor2@maydaegu.internal
   ```

3. **Firebase Auth 로그인**
   ```dart
   final credential = await FirebaseAuth.instance
       .signInWithEmailAndPassword(
         email: usernameToEmail(username),
         password: password,
       );
   final uid = credential.user!.uid;
   ```

4. **`/users/{uid}`에서 역할 정보 조회**
   ```dart
   final snapshot = await FirebaseDatabase.instance
       .ref('users/$uid')
       .get();
   final userData = snapshot.value as Map;
   final role = userData['role'] as String;
   final displayName = userData['displayName'] as String;
   ```

5. **세션 저장 (Riverpod authProvider)**
   ```dart
   ref.read(authProvider.notifier).setSession(
     Session(
       uid: uid,
       username: username,
       displayName: displayName,
       role: role,
     ),
   );
   ```

6. **역할에 따라 기본 화면으로 이동**
   - `floor2` → `/floor2/my-orders`
   - `floor1` → `/floor1/all-orders`
   - `driver` → `/driver/my-deliveries`
   - `admin` → `/floor1/all-orders`

---

## 4. Dart 구현 코드

### 4-1. Session 모델

```dart
// lib/models/user.dart

/// 사용자 역할
enum UserRole {
  floor2('floor2'),
  floor1('floor1'),
  driver('driver'),
  admin('admin');

  const UserRole(this.value);
  final String value;

  static UserRole fromString(String s) =>
      UserRole.values.firstWhere(
        (e) => e.value == s,
        orElse: () => UserRole.floor2,
      );
}

/// 로그인 후 세션 정보
class Session {
  final String uid;
  final String username;
  final String displayName;
  final UserRole role;
  final String? driverId; // driver 역할일 때 /drivers/{id} 매핑

  const Session({
    required this.uid,
    required this.username,
    required this.displayName,
    required this.role,
    this.driverId,
  });

  /// driver 역할인지 확인
  bool get isDriver => role == UserRole.driver;

  /// admin 역할인지 확인
  bool get isAdmin => role == UserRole.admin;

  /// 특정 기능 접근 가능 여부
  bool canAccess(String feature) {
    const rules = <String, List<UserRole>>{
      'createOrder':      [UserRole.floor2, UserRole.admin],
      'myOrders':         [UserRole.floor2],
      'allOrders':        [UserRole.floor1, UserRole.admin],
      'updateStatus':     [UserRole.floor1, UserRole.admin],
      'assignDriver':     [UserRole.floor1, UserRole.admin],
      'myDeliveries':     [UserRole.driver],
      'completeDelivery': [UserRole.driver, UserRole.admin],
      'manageProducts':   [UserRole.admin],
      'manageDrivers':    [UserRole.admin],
      'statistics':       [UserRole.admin],
    };
    return (rules[feature] ?? []).contains(role);
  }
}
```

### 4-2. AuthService 클래스

```dart
// lib/services/auth_service.dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:maydaegu_app/models/user.dart';

class AuthService {
  final _auth = FirebaseAuth.instance;
  final _db = FirebaseDatabase.instance;

  /// 이메일 도메인
  static const _domain = 'maydaegu.internal';

  /// username → 이메일 변환
  String _toEmail(String username) =>
      '${username.trim().toLowerCase()}@$_domain';

  /// 로그인
  Future<Session> login({
    required String username,
    required String password,
  }) async {
    try {
      // 1. Firebase Auth 로그인
      final credential = await _auth.signInWithEmailAndPassword(
        email: _toEmail(username),
        password: password,
      );
      final uid = credential.user!.uid;

      // 2. /users/{uid}에서 역할 정보 조회
      final snapshot = await _db.ref('users/$uid').get();
      if (!snapshot.exists) {
        throw AuthException('사용자 정보가 데이터베이스에 없습니다.');
      }

      final data = snapshot.value as Map<dynamic, dynamic>;
      final role = UserRole.fromString(data['role'] as String);

      // 3. driver 역할이면 driverId 매핑
      String? driverId;
      if (role == UserRole.driver) {
        driverId = await _findDriverId(uid);
      }

      return Session(
        uid: uid,
        username: username,
        displayName: data['displayName'] as String? ?? username,
        role: role,
        driverId: driverId,
      );
    } on FirebaseAuthException catch (e) {
      throw AuthException(_translateAuthError(e.code));
    }
  }

  /// 로그아웃
  Future<void> logout() async {
    await _auth.signOut();
  }

  /// 현재 로그인된 사용자 가져오기
  User? get currentUser => _auth.currentUser;

  /// Auth 상태 변경 스트림
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// 비밀번호 변경
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final user = _auth.currentUser;
    if (user == null || user.email == null) {
      throw AuthException('로그인 상태가 아닙니다.');
    }

    // 현재 비밀번호로 재인증
    final credential = EmailAuthProvider.credential(
      email: user.email!,
      password: currentPassword,
    );
    await user.reauthenticateWithCredential(credential);

    // 새 비밀번호 설정
    await user.updatePassword(newPassword);
  }

  /// driver의 Auth UID로 /drivers/{id} 매핑
  Future<String?> _findDriverId(String authUid) async {
    final snapshot = await _db
        .ref('drivers')
        .orderByChild('linkedUserId')
        .equalTo(authUid)
        .get();

    if (!snapshot.exists) return null;

    final data = snapshot.value as Map<dynamic, dynamic>;
    return data.keys.first as String;
  }

  /// Firebase Auth 에러 코드 → 한글 메시지
  String _translateAuthError(String code) => switch (code) {
    'user-not-found'        => '등록되지 않은 아이디입니다.',
    'wrong-password'        => '비밀번호가 올바르지 않습니다.',
    'invalid-credential'    => '아이디 또는 비밀번호가 올바르지 않습니다.',
    'user-disabled'         => '비활성화된 계정입니다. 관리자에게 문의하세요.',
    'too-many-requests'     => '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.',
    'invalid-email'         => '잘못된 아이디 형식입니다.',
    'network-request-failed' => '네트워크 연결을 확인하세요.',
    _                       => '로그인에 실패했습니다. ($code)',
  };
}

/// 인증 관련 예외
class AuthException implements Exception {
  final String message;
  const AuthException(this.message);

  @override
  String toString() => message;
}
```

### 4-3. AuthProvider (Riverpod -- 세션 상태 전역 관리)

```dart
// lib/providers/auth_provider.dart
import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maydaegu_app/models/user.dart';
import 'package:maydaegu_app/services/auth_service.dart';

/// AuthService 싱글톤 provider
final authServiceProvider = Provider((ref) => AuthService());

/// 인증 상태
class AuthState {
  final Session? session;
  final bool isLoading;
  final String? errorMessage;

  const AuthState({
    this.session,
    this.isLoading = false,
    this.errorMessage,
  });

  bool get isLoggedIn => session != null;

  AuthState copyWith({
    Session? session,
    bool? isLoading,
    String? errorMessage,
    bool clearSession = false,
    bool clearError = false,
  }) {
    return AuthState(
      session: clearSession ? null : (session ?? this.session),
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

/// 인증 상태 관리 Notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;
  StreamSubscription<User?>? _authSub;

  AuthNotifier(this._authService) : super(const AuthState()) {
    _listenAuthState();
  }

  /// Firebase Auth 상태 변경 자동 감지
  void _listenAuthState() {
    _authSub = _authService.authStateChanges.listen((user) async {
      if (user == null) {
        state = const AuthState(); // 로그아웃 상태
      }
      // 로그인 상태 복원은 login() 메서드에서 처리
    });
  }

  /// 로그인
  Future<void> login(String username, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final session = await _authService.login(
        username: username,
        password: password,
      );
      state = AuthState(session: session);
    } on AuthException catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.message,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: '알 수 없는 오류가 발생했습니다.',
      );
    }
  }

  /// 로그아웃
  Future<void> logout() async {
    await _authService.logout();
    state = const AuthState();
  }

  /// 세션 직접 설정 (앱 재시작 시 복원용)
  void setSession(Session session) {
    state = AuthState(session: session);
  }

  /// 에러 메시지 초기화
  void clearError() {
    state = state.copyWith(clearError: true);
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }
}

/// 전역 인증 상태 provider
final authProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  return AuthNotifier(authService);
});

/// 현재 세션 (편의 provider)
final currentSessionProvider = Provider<Session?>((ref) {
  return ref.watch(authProvider).session;
});

/// 현재 역할 (편의 provider)
final currentRoleProvider = Provider<UserRole?>((ref) {
  return ref.watch(authProvider).session?.role;
});
```

---

## 5. 역할 기반 접근 제어 (RBAC)

접근 제어는 **3단계 방어**로 구현합니다.

```
[1단계] GoRouter redirect     → 잘못된 URL 접근 차단
[2단계] 위젯 수준 조건부 렌더링  → UI에서 권한 없는 버튼/메뉴 숨김
[3단계] Firebase Security Rules → DB 수준에서 최종 방어 (서버 측)
```

### 5-1. 라우팅 Guard (GoRouter redirect)

```dart
// lib/app.dart
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final loggedIn = authState.isLoggedIn;
      final session = authState.session;
      final location = state.matchedLocation;

      // 미로그인 → 로그인 페이지로
      if (!loggedIn) {
        return location == '/login' ? null : '/login';
      }

      // 로그인 상태에서 /login 접근 → 기본 화면으로
      if (location == '/login') {
        return _defaultRoute(session!.role);
      }

      // 역할별 접근 제어
      if (!_canAccessRoute(session!.role, location)) {
        return _defaultRoute(session.role);
      }

      return null; // 통과
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (_, __, child) => ShellScreen(child: child),
        routes: [
          // floor2 전용
          GoRoute(path: '/floor2/my-orders', ...),
          GoRoute(path: '/floor2/new-order', ...),
          // floor1 전용
          GoRoute(path: '/floor1/all-orders', ...),
          // driver 전용
          GoRoute(path: '/driver/my-deliveries', ...),
          GoRoute(path: '/driver/order/:id', ...),
          // admin 전용
          GoRoute(path: '/admin/products', ...),
          GoRoute(path: '/admin/drivers', ...),
          GoRoute(path: '/admin/statistics', ...),
        ],
      ),
    ],
  );
});

String _defaultRoute(UserRole role) => switch (role) {
  UserRole.floor2 => '/floor2/my-orders',
  UserRole.floor1 => '/floor1/all-orders',
  UserRole.driver => '/driver/my-deliveries',
  UserRole.admin  => '/floor1/all-orders',
};

bool _canAccessRoute(UserRole role, String path) {
  // admin은 모든 경로 접근 가능
  if (role == UserRole.admin) return true;

  // 역할별 허용 경로 패턴
  final allowed = <UserRole, List<String>>{
    UserRole.floor2: ['/floor2/'],
    UserRole.floor1: ['/floor1/'],
    UserRole.driver: ['/driver/'],
  };

  final prefixes = allowed[role] ?? [];
  return prefixes.any(path.startsWith);
}
```

### 5-2. 위젯 수준 조건부 렌더링

```dart
// 예: 사이드바에서 역할에 따라 메뉴 항목을 다르게 표시
class Sidebar extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(currentSessionProvider);
    if (session == null) return const SizedBox.shrink();

    return Column(
      children: [
        // 모든 역할 공통
        const NavItem(label: '홈', icon: Icons.home),

        // floor2 전용
        if (session.role == UserRole.floor2) ...[
          const NavItem(label: '내 주문', route: '/floor2/my-orders'),
          const NavItem(label: '신규 접수', route: '/floor2/new-order'),
        ],

        // floor1 전용
        if (session.role == UserRole.floor1 ||
            session.role == UserRole.admin) ...[
          const NavItem(label: '전체 주문', route: '/floor1/all-orders'),
        ],

        // driver 전용
        if (session.role == UserRole.driver)
          const NavItem(label: '내 배송', route: '/driver/my-deliveries'),

        // admin 전용
        if (session.role == UserRole.admin) ...[
          const NavItem(label: '상품 관리', route: '/admin/products'),
          const NavItem(label: '기사 관리', route: '/admin/drivers'),
          const NavItem(label: '통계', route: '/admin/statistics'),
        ],
      ],
    );
  }
}
```

### 5-3. Firebase Security Rules (DB 수준 방어)

위젯이나 라우터에서 차단하더라도, 악의적 사용자가 직접 Firebase API를 호출할 수 있습니다.
따라서 **DB 수준에서도 역할을 검증**해야 합니다.

```json
// 예: driver는 자기에게 배정된 주문만 수정 가능
"orders": {
  "$orderId": {
    ".write": "auth != null && (
      root.child('users').child(auth.uid).child('role').val() === 'floor1' ||
      root.child('users').child(auth.uid).child('role').val() === 'admin' ||
      (root.child('users').child(auth.uid).child('role').val() === 'driver' &&
       data.child('assignedDriverId').val() === auth.uid)
    )"
  }
}
```

---

## 6. 세션 유지

### Firebase Auth 자동 세션

Firebase Auth는 로그인 토큰을 로컬에 자동 저장합니다. 앱을 종료했다가 다시 열어도 로그인 상태가 유지됩니다.

```dart
// 앱 시작 시 세션 복원
class MaydaeguApp extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      routerConfig: ref.watch(routerProvider),
    );
  }
}
```

### `authStateChanges()` 스트림 활용

```dart
/// 앱 시작 시 기존 세션 복원
Future<void> restoreSession(WidgetRef ref) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return;

  // /users/{uid}에서 정보 조회
  final snapshot = await FirebaseDatabase.instance
      .ref('users/${user.uid}')
      .get();

  if (!snapshot.exists) return;

  final data = snapshot.value as Map<dynamic, dynamic>;
  final role = UserRole.fromString(data['role'] as String);

  String? driverId;
  if (role == UserRole.driver) {
    final driverSnap = await FirebaseDatabase.instance
        .ref('drivers')
        .orderByChild('linkedUserId')
        .equalTo(user.uid)
        .get();
    if (driverSnap.exists) {
      driverId = (driverSnap.value as Map).keys.first as String;
    }
  }

  ref.read(authProvider.notifier).setSession(
    Session(
      uid: user.uid,
      username: data['username'] as String? ?? '',
      displayName: data['displayName'] as String? ?? '',
      role: role,
      driverId: driverId,
    ),
  );
}
```

---

## 7. 로그인 화면 구현

```dart
// lib/screens/login_screen.dart
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    await ref.read(authProvider.notifier).login(
      _usernameController.text.trim(),
      _passwordController.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 로고
                    const Text(
                      '메이대구',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '꽃집 주문-배송 관리 시스템',
                      style: TextStyle(color: Colors.grey),
                    ),
                    const SizedBox(height: 32),

                    // 아이디
                    TextFormField(
                      controller: _usernameController,
                      decoration: const InputDecoration(
                        labelText: '아이디',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (v) =>
                          (v == null || v.trim().isEmpty)
                              ? '아이디를 입력하세요'
                              : null,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 16),

                    // 비밀번호
                    TextFormField(
                      controller: _passwordController,
                      decoration: InputDecoration(
                        labelText: '비밀번호',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off
                                : Icons.visibility,
                          ),
                          onPressed: () => setState(
                            () => _obscurePassword = !_obscurePassword,
                          ),
                        ),
                      ),
                      obscureText: _obscurePassword,
                      validator: (v) =>
                          (v == null || v.isEmpty)
                              ? '비밀번호를 입력하세요'
                              : null,
                      onFieldSubmitted: (_) => _handleLogin(),
                    ),
                    const SizedBox(height: 24),

                    // 에러 메시지
                    if (authState.errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.error_outline,
                              color: Colors.red,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                authState.errorMessage!,
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // 로그인 버튼
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed:
                            authState.isLoading ? null : _handleLogin,
                        child: authState.isLoading
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text('로그인'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
```

---

## 8. 비밀번호 변경/초기화

### 사용자 본인의 비밀번호 변경

```dart
// 비밀번호 변경 다이얼로그에서 호출
Future<void> changePassword(WidgetRef ref) async {
  final authService = ref.read(authServiceProvider);

  try {
    await authService.changePassword(
      currentPassword: currentPasswordController.text,
      newPassword: newPasswordController.text,
    );
    // 성공 알림
  } on AuthException catch (e) {
    // 에러 표시
  }
}
```

### 관리자의 비밀번호 초기화 (Cloud Functions)

관리자가 직원의 비밀번호를 초기화하려면 Firebase Admin SDK가 필요하므로 Cloud Functions를 사용합니다.

```javascript
// functions/index.js
exports.resetUserPassword = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    // 호출자가 admin인지 확인
    const callerUid = context.auth?.uid;
    if (!callerUid) throw new functions.https.HttpsError('unauthenticated', '');

    const callerSnap = await admin.database()
      .ref(`users/${callerUid}/role`).once('value');
    if (callerSnap.val() !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', '관리자만 가능합니다.');
    }

    const { targetUid, newPassword } = data;

    await admin.auth().updateUser(targetUid, {
      password: newPassword,
    });

    return { success: true };
  });
```

Flutter에서 호출:

```dart
import 'package:cloud_functions/cloud_functions.dart';

Future<void> resetPassword(String targetUid, String newPassword) async {
  final callable = FirebaseFunctions.instanceFor(region: 'asia-southeast1')
      .httpsCallable('resetUserPassword');

  await callable.call({
    'targetUid': targetUid,
    'newPassword': newPassword,
  });
}
```

---

## 9. 관리자의 사용자 관리

### 새 사용자 생성 (Cloud Functions)

```javascript
// functions/index.js
exports.createUser = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    // admin 권한 확인 (위와 동일)
    const { username, password, displayName, role } = data;

    // 1. Auth 계정 생성
    const userRecord = await admin.auth().createUser({
      email: `${username}@maydaegu.internal`,
      password: password,
      displayName: displayName,
    });

    // 2. /users/{uid} 데이터 작성
    await admin.database().ref(`users/${userRecord.uid}`).set({
      username,
      displayName,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    return { uid: userRecord.uid };
  });
```

### 사용자 비활성화

```javascript
exports.disableUser = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    // admin 권한 확인
    const { targetUid } = data;

    await admin.auth().updateUser(targetUid, { disabled: true });
    await admin.database().ref(`users/${targetUid}/isActive`).set(false);

    return { success: true };
  });
```

---

## 10. 보안 체크리스트

### 최초 설정 (Firebase Console)

- [ ] **Authentication** > Sign-in method > **이메일/비밀번호** 활성화
- [ ] **Authentication** > Settings > **비밀번호 정책** 설정
  - 최소 8자
  - 대소문자 + 숫자 포함 권장
- [ ] **Authentication** > Users > 초기 계정 생성
  - `floor2@maydaegu.internal`
  - `floor1@maydaegu.internal`
  - `admin@maydaegu.internal`
  - `driver1@maydaegu.internal` ~ `driver12@maydaegu.internal`

### `/users/{uid}` 데이터 작성

- [ ] 각 Auth 계정의 UID 확인
- [ ] `/users/{uid}`에 username, displayName, role, isActive, createdAt 기록
- [ ] driver 계정의 경우 `/drivers/{id}/linkedUserId`에 Auth UID 매핑

### 보안 규칙

- [ ] Realtime Database 보안 규칙 배포 (테스트 모드 해제)
- [ ] Cloud Storage 보안 규칙 배포
- [ ] `.indexOn` 설정 확인

### 앱 코드

- [ ] `AuthService` 구현 완료
- [ ] `AuthProvider` (Riverpod) 구현 완료
- [ ] GoRouter redirect에 역할 체크 적용
- [ ] 위젯에서 role 기반 조건부 렌더링 적용
- [ ] 에러 메시지 한글화 완료
- [ ] 비밀번호 변경 기능 구현

### Cloud Functions

- [ ] `onUserCreate` -- Auth 계정 생성 시 `/users/{uid}` 자동 생성
- [ ] `resetUserPassword` -- 관리자 비밀번호 초기화
- [ ] `createUser` -- 관리자 신규 사용자 생성
- [ ] `disableUser` -- 사용자 비활성화
- [ ] Functions 배포: `firebase deploy --only functions`

### 운영

- [ ] 모든 직원 초기 비밀번호 변경 안내 (첫 로그인 시)
- [ ] `passwordHash: '1234'` 관련 코드 완전 제거
- [ ] sessionStorage/localStorage에 민감 정보 저장하지 않음 확인
- [ ] Firebase Console > Authentication > 로그인 시도 모니터링

---

## 11. 자주 묻는 질문 (FAQ)

### Q: 기존 username 로그인은 유지되나요?

**A:** 네. 사용자는 기존처럼 `floor2`, `admin` 등의 username으로 로그인합니다. 내부적으로만 `@maydaegu.internal`을 붙여 이메일로 변환합니다. 사용자는 이메일 주소를 알 필요가 없습니다.

### Q: driver 로그인 시 driverId는 어떻게 매핑하나요?

**A:** `/drivers/{pushKey}/linkedUserId` 필드에 해당 기사의 Auth UID를 저장합니다. 로그인 시 이 필드로 조회하여 driverId를 가져옵니다.

### Q: 오프라인에서 로그인이 가능한가요?

**A:** Firebase Auth는 마지막 로그인 토큰을 로컬에 캐시합니다. 이미 로그인한 상태에서 앱을 재시작하면 오프라인에서도 인증 상태가 유지됩니다. 단, 최초 로그인은 반드시 네트워크가 필요합니다.

### Q: 세션 만료는 언제 되나요?

**A:** Firebase Auth 토큰은 1시간마다 자동 갱신됩니다. SDK가 자동으로 처리하므로 별도 관리가 필요 없습니다. 단, 관리자가 계정을 비활성화하면 다음 토큰 갱신 시점(최대 1시간 내)에 로그아웃됩니다.

---

이전 문서: [05-firebase-backend.md](./05-firebase-backend.md) -- Firebase 백엔드 가이드

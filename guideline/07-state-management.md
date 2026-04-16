# 07. 상태 관리 (Riverpod)

> **대상 독자:** Flutter 통합 앱을 개발하는 프론트엔드/모바일 개발자
> **목표:** Riverpod 기반 상태 관리 아키텍처를 설계하고, Firebase Realtime DB 실시간 구독 패턴을 확립

---

## 1. 왜 Riverpod인가?

기존 Flutter 생태계에서 가장 많이 쓰이는 `Provider`와 비교했을 때, Riverpod은 다음과 같은 구조적 장점이 있습니다.

| 비교 항목 | Provider | Riverpod |
|-----------|----------|----------|
| **컴파일 타임 안전성** | `ProviderNotFoundException` 런타임 에러 가능 | 컴파일 시점에 모든 Provider 참조를 검증 |
| **코드 생성** | 불가 | `riverpod_generator`로 보일러플레이트 자동 생성 |
| **BuildContext 의존** | 필수 (위젯 트리에 종속) | 불필요 (어디서든 접근 가능) |
| **Provider override** | 제한적 | 테스트 시 자유롭게 override 가능 |
| **Family 지원** | 직접 구현 필요 | `.family` 수식어로 파라미터별 인스턴스 자동 생성 |
| **AutoDispose** | 수동 관리 | `.autoDispose`로 사용하지 않는 상태 자동 해제 |

메이대구 프로젝트는 **4개 역할(floor2, floor1, driver, admin)이 각기 다른 데이터를 구독**하고, **Firebase 실시간 스트림**이 핵심이므로 Riverpod의 `StreamProvider`와 `family` 수식어가 필수적입니다.

---

## 2. Riverpod 기본 개념

### 2.1 Provider — 읽기 전용 값

외부에서 변경할 수 없는 고정값 또는 계산된 값을 제공합니다.

```dart
final firebaseDatabaseProvider = Provider<FirebaseDatabase>((ref) {
  return FirebaseDatabase.instance;
});
```

### 2.2 StateNotifier + StateNotifierProvider — 변경 가능한 상태

UI 필터, 토글, 폼 입력 등 **사용자 조작으로 바뀌는 상태**를 관리합니다.

```dart
class OrderFilterNotifier extends StateNotifier<OrderFilter> {
  OrderFilterNotifier() : super(const OrderFilter());

  void setStatusFilter(Set<int> statuses) {
    state = state.copyWith(statuses: statuses);
  }

  void setDateRange(DateTime? start, DateTime? end) {
    state = state.copyWith(startDate: start, endDate: end);
  }

  void reset() {
    state = const OrderFilter();
  }
}

final orderFilterProvider =
    StateNotifierProvider<OrderFilterNotifier, OrderFilter>((ref) {
  return OrderFilterNotifier();
});
```

### 2.3 AsyncValue — 비동기 상태의 3가지 분기

Firebase에서 데이터를 가져오면 **로딩/성공/에러** 3가지 상태가 존재합니다. `AsyncValue`는 이를 타입 안전하게 처리합니다.

```dart
asyncOrders.when(
  data:    (orders)  => OrderListView(orders: orders),
  loading: ()        => const LoadingOverlay(),
  error:   (err, st) => ErrorDisplay(message: err.toString()),
);
```

---

## 3. 프로젝트 Provider 설계

### 3.1 전체 Provider 맵

```
authProvider ─────────────────── 로그인 세션 (UserSession?)
  │
  ├── ordersProvider ─────────── 전체 주문 (floor1, admin용)
  │     └── filteredOrdersProvider ── 필터 적용된 주문 목록
  │
  ├── myOrdersProvider(userId) ── 내 주문만 (floor2, driver용)
  │
  ├── driversProvider ────────── 기사 목록 (admin, floor1용)
  │
  ├── driverStatusProvider ───── 기사 실시간 위치/뱃지
  │
  ├── productsProvider ───────── 상품 목록
  │
  ├── categoriesProvider ─────── 카테고리 목록
  │
  └── chatProvider(roomId) ───── 채팅 메시지
```

### 3.2 authProvider — 로그인 세션

```dart
// lib/providers/auth_provider.dart

class UserSession {
  final String uid;
  final String name;
  final String role;       // 'floor2' | 'floor1' | 'driver' | 'admin'
  final String? driverId;  // driver 역할인 경우에만
  
  const UserSession({
    required this.uid,
    required this.name,
    required this.role,
    this.driverId,
  });
}

class AuthNotifier extends StateNotifier<UserSession?> {
  final Ref ref;
  
  AuthNotifier(this.ref) : super(null);

  Future<void> login(String username, String password) async {
    final credential = await FirebaseAuth.instance
        .signInWithEmailAndPassword(email: username, password: password);
    
    final userSnap = await FirebaseDatabase.instance
        .ref('users/${credential.user!.uid}')
        .get();
    
    final data = userSnap.value as Map;
    state = UserSession(
      uid: credential.user!.uid,
      name: data['name'] ?? '',
      role: data['role'] ?? '',
      driverId: data['linkedDriverId']?.toString(),
    );
  }

  Future<void> logout() async {
    await FirebaseAuth.instance.signOut();
    state = null;
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, UserSession?>((ref) {
  return AuthNotifier(ref);
});
```

### 3.3 ordersProvider — 전체 주문 실시간 구독

```dart
// lib/providers/orders_provider.dart

final ordersProvider = StreamProvider<List<Order>>((ref) {
  final dbRef = FirebaseDatabase.instance
      .ref('orders')
      .orderByChild('createdAt');

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map?;
    if (data == null) return <Order>[];
    return data.entries
        .map((e) => Order.fromMap(e.key, e.value as Map))
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  });
});
```

### 3.4 myOrdersProvider — 내 주문만 필터 (family)

`floor2`는 `createdByUserId` 기준, `driver`는 `assignedDriverId` 기준으로 필터합니다.

```dart
// floor2 — 내가 등록한 주문
final myCreatedOrdersProvider =
    StreamProvider.family<List<Order>, String>((ref, userId) {
  final dbRef = FirebaseDatabase.instance
      .ref('orders')
      .orderByChild('createdByUserId')
      .equalTo(userId);

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map?;
    if (data == null) return <Order>[];
    return data.entries
        .map((e) => Order.fromMap(e.key, e.value as Map))
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  });
});

// driver — 내가 배정받은 주문
final myDeliveriesProvider =
    StreamProvider.family<List<Order>, String>((ref, driverId) {
  final dbRef = FirebaseDatabase.instance
      .ref('orders')
      .orderByChild('assignedDriverId')
      .equalTo(driverId);

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map?;
    if (data == null) return <Order>[];
    return data.entries
        .map((e) => Order.fromMap(e.key, e.value as Map))
        .toList()
      ..sort((a, b) => a.deliveryDatetime.compareTo(b.deliveryDatetime));
  });
});
```

### 3.5 driversProvider — 기사 목록

```dart
final driversProvider = StreamProvider<List<Driver>>((ref) {
  final dbRef = FirebaseDatabase.instance.ref('drivers');

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map?;
    if (data == null) return <Driver>[];
    return data.entries
        .map((e) => Driver.fromMap(e.key, e.value as Map))
        .toList()
      ..sort((a, b) => a.name.compareTo(b.name));
  });
});
```

### 3.6 driverStatusProvider — 기사 실시간 위치/뱃지

```dart
final driverStatusProvider =
    StreamProvider.family<DriverStatus, String>((ref, driverId) {
  final dbRef = FirebaseDatabase.instance.ref('driverStatus/$driverId');

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map?;
    if (data == null) return DriverStatus.empty(driverId);
    return DriverStatus.fromMap(driverId, data);
  });
});
```

### 3.7 productsProvider — 상품 목록

```dart
final productsProvider = StreamProvider<List<Product>>((ref) {
  final dbRef = FirebaseDatabase.instance.ref('products');

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map?;
    if (data == null) return <Product>[];
    return data.entries
        .map((e) => Product.fromMap(e.key, e.value as Map))
        .toList()
      ..sort((a, b) => a.name.compareTo(b.name));
  });
});
```

### 3.8 categoriesProvider — 카테고리 목록

```dart
final categoriesProvider = StreamProvider<List<Category>>((ref) {
  final dbRef = FirebaseDatabase.instance.ref('categories');

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map?;
    if (data == null) return <Category>[];
    return data.entries
        .map((e) => Category.fromMap(e.key, e.value as Map))
        .toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  });
});
```

### 3.9 chatProvider — 채팅 메시지

```dart
final chatProvider =
    StreamProvider.family<List<ChatMessage>, String>((ref, roomId) {
  final dbRef = FirebaseDatabase.instance
      .ref('chats/$roomId/messages')
      .orderByChild('timestamp')
      .limitToLast(100);

  return dbRef.onValue.map((event) {
    final data = event.snapshot.value as Map?;
    if (data == null) return <ChatMessage>[];
    return data.entries
        .map((e) => ChatMessage.fromMap(e.key, e.value as Map))
        .toList()
      ..sort((a, b) => a.timestamp.compareTo(b.timestamp));
  });
});
```

---

## 4. Firebase 실시간 구독 패턴 상세

### 4.1 StreamProvider 라이프사이클

```
위젯이 Provider를 watch
  → StreamProvider가 Firebase onValue 리스너 등록
  → 데이터 변경 시 자동으로 AsyncValue<T> 방출
  → 위젯이 자동 리빌드
  → 위젯이 dispose되면 autoDispose가 리스너 해제
```

### 4.2 autoDispose 사용 판단 기준

| Provider | autoDispose? | 이유 |
|----------|:------------:|------|
| `authProvider` | X | 앱 전체 수명동안 유지 |
| `ordersProvider` | X | 메인 화면에서 항상 필요 |
| `myDeliveriesProvider` | O | 기사 화면 벗어나면 해제 |
| `chatProvider` | O | 채팅 패널 닫으면 해제 |
| `driverStatusProvider` | O | 관리자 패널에서만 필요 |

autoDispose 적용 예시:

```dart
final chatProvider =
    StreamProvider.autoDispose.family<List<ChatMessage>, String>((ref, roomId) {
  // 리스너가 자동 해제됨
  ref.onDispose(() {
    debugPrint('chatProvider($roomId) disposed');
  });
  // ...
});
```

### 4.3 데이터 변환 레이어

Firebase에서 받은 raw `Map`을 Dart 모델로 변환하는 과정은 반드시 Provider 내부에서 처리합니다.

```dart
// 좋은 예 — Provider 내부에서 변환
return dbRef.onValue.map((event) {
  final data = event.snapshot.value as Map?;
  if (data == null) return <Order>[];
  return data.entries
      .map((e) => Order.fromMap(e.key, e.value as Map))
      .toList();
});

// 나쁜 예 — 위젯에서 raw Map을 직접 다루는 것
// 절대 위젯 안에서 snapshot.value를 파싱하지 마세요.
```

---

## 5. StateNotifier 활용 — UI 상태 관리

Firebase 실시간 데이터는 `StreamProvider`로 처리하고, **사용자 인터랙션에 의한 UI 상태**는 `StateNotifier`로 분리합니다.

### 5.1 주문 필터 상태

```dart
@immutable
class OrderFilter {
  final Set<int> statuses;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? searchQuery;
  final String? assignedDriverId;

  const OrderFilter({
    this.statuses = const {0, 1, 2, 3, 4},
    this.startDate,
    this.endDate,
    this.searchQuery,
    this.assignedDriverId,
  });

  OrderFilter copyWith({
    Set<int>? statuses,
    DateTime? startDate,
    DateTime? endDate,
    String? searchQuery,
    String? assignedDriverId,
  }) {
    return OrderFilter(
      statuses: statuses ?? this.statuses,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      searchQuery: searchQuery ?? this.searchQuery,
      assignedDriverId: assignedDriverId ?? this.assignedDriverId,
    );
  }
}
```

### 5.2 필터 적용된 주문 목록 (파생 Provider)

```dart
final filteredOrdersProvider = Provider<AsyncValue<List<Order>>>((ref) {
  final asyncOrders = ref.watch(ordersProvider);
  final filter = ref.watch(orderFilterProvider);

  return asyncOrders.whenData((orders) {
    return orders.where((order) {
      if (!filter.statuses.contains(order.status)) return false;
      if (filter.startDate != null &&
          order.createdAt.isBefore(filter.startDate!)) return false;
      if (filter.endDate != null &&
          order.createdAt.isAfter(filter.endDate!)) return false;
      if (filter.searchQuery != null && filter.searchQuery!.isNotEmpty) {
        final q = filter.searchQuery!.toLowerCase();
        return order.chainName.toLowerCase().contains(q) ||
            order.recipientName.toLowerCase().contains(q) ||
            order.deliveryAddress.toLowerCase().contains(q);
      }
      if (filter.assignedDriverId != null &&
          order.assignedDriverId != filter.assignedDriverId) return false;
      return true;
    }).toList();
  });
});
```

---

## 6. Provider 간 의존성

### 6.1 ref.watch vs ref.read

| 메서드 | 용도 | 리빌드 발생? |
|--------|------|:------------:|
| `ref.watch(provider)` | 값이 바뀔 때마다 자동 리빌드 | O |
| `ref.read(provider)` | 현재 값을 1회 읽기 | X |

```dart
// 위젯 build 안에서 — 항상 watch
Widget build(BuildContext context, WidgetRef ref) {
  final session = ref.watch(authProvider);        // 세션 바뀌면 리빌드
  final orders = ref.watch(ordersProvider);       // 주문 바뀌면 리빌드
  // ...
}

// 이벤트 핸들러 안에서 — read
onPressed: () {
  final session = ref.read(authProvider);         // 1회 읽기
  ref.read(authProvider.notifier).logout();       // StateNotifier 메서드 호출
}
```

### 6.2 Provider에서 다른 Provider 의존

```dart
// 현재 로그인한 사용자의 역할에 따라 적절한 주문 목록을 반환
final roleBasedOrdersProvider = Provider<AsyncValue<List<Order>>>((ref) {
  final session = ref.watch(authProvider);
  if (session == null) return const AsyncValue.data([]);

  switch (session.role) {
    case 'floor2':
      return ref.watch(myCreatedOrdersProvider(session.uid));
    case 'driver':
      return ref.watch(myDeliveriesProvider(session.driverId!));
    case 'floor1':
    case 'admin':
      return ref.watch(ordersProvider);
    default:
      return const AsyncValue.data([]);
  }
});
```

---

## 7. 에러 핸들링

### 7.1 AsyncValue.when 패턴

모든 Firebase 스트림 데이터는 3가지 분기를 처리해야 합니다.

```dart
class OrderListScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncOrders = ref.watch(ordersProvider);

    return asyncOrders.when(
      data: (orders) {
        if (orders.isEmpty) {
          return const Center(child: Text('주문이 없습니다'));
        }
        return ListView.builder(
          itemCount: orders.length,
          itemBuilder: (ctx, i) => OrderCard(order: orders[i]),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stackTrace) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text('데이터를 불러올 수 없습니다\n$error',
                textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => ref.invalidate(ordersProvider),
              child: const Text('다시 시도'),
            ),
          ],
        ),
      ),
    );
  }
}
```

### 7.2 쓰기 작업 에러 핸들링

```dart
Future<void> updateOrderStatus(String orderId, int newStatus) async {
  try {
    await FirebaseDatabase.instance.ref('orders/$orderId').update({
      'status': newStatus,
      'updatedAt': DateTime.now().toIso8601String(),
    });
    AppToast.success('주문 상태가 변경되었습니다');
  } on FirebaseException catch (e) {
    AppToast.error('저장 실패: ${e.message}');
  } catch (e) {
    AppToast.error('알 수 없는 오류: $e');
  }
}
```

---

## 8. ProviderScope 설정

### 8.1 main.dart

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Realtime DB 오프라인 캐시 활성화
  FirebaseDatabase.instance.setPersistenceEnabled(true);

  runApp(
    const ProviderScope(
      child: MaydaeguApp(),
    ),
  );
}
```

### 8.2 ProviderScope 역할

`ProviderScope`는 Riverpod의 **DI 컨테이너** 역할을 합니다. 모든 Provider의 상태는 이 스코프 안에서 관리됩니다.

- 앱 최상단에 단 하나만 배치
- 하위 위젯은 어디서든 `ref.watch`/`ref.read`로 Provider에 접근 가능
- 테스트 시 `ProviderScope(overrides: [...])` 으로 Provider를 교체할 수 있음

---

## 9. 테스트를 위한 Provider Override

### 9.1 단위 테스트

```dart
// test/providers/orders_provider_test.dart

void main() {
  test('filteredOrdersProvider는 상태 필터를 올바르게 적용한다', () {
    final container = ProviderContainer(
      overrides: [
        // 실제 Firebase 대신 가짜 데이터 주입
        ordersProvider.overrideWith((ref) => Stream.value([
          Order.mock(id: '1', status: 0),
          Order.mock(id: '2', status: 3),
          Order.mock(id: '3', status: 4),
        ])),
      ],
    );

    // 필터: 배송중(3)만
    container.read(orderFilterProvider.notifier)
        .setStatusFilter({3});

    final result = container.read(filteredOrdersProvider);
    result.whenData((orders) {
      expect(orders.length, 1);
      expect(orders.first.status, 3);
    });

    container.dispose();
  });
}
```

### 9.2 위젯 테스트

```dart
testWidgets('OrderListScreen은 주문 목록을 렌더링한다', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ordersProvider.overrideWith((ref) => Stream.value([
          Order.mock(id: '1', chainName: '행복꽃집'),
          Order.mock(id: '2', chainName: '사랑꽃방'),
        ])),
      ],
      child: const MaterialApp(home: OrderListScreen()),
    ),
  );

  await tester.pump();

  expect(find.text('행복꽃집'), findsOneWidget);
  expect(find.text('사랑꽃방'), findsOneWidget);
});
```

### 9.3 Mock 서비스 패턴

```dart
// 실제 서비스
final photoServiceProvider = Provider<PhotoService>((ref) {
  return PhotoService();
});

// 테스트 시 Mock으로 교체
final container = ProviderContainer(
  overrides: [
    photoServiceProvider.overrideWithValue(MockPhotoService()),
  ],
);
```

---

## 10. 폴더 구조 — Provider 파일 배치

```
lib/
├── providers/
│   ├── auth_provider.dart
│   ├── orders_provider.dart
│   ├── drivers_provider.dart
│   ├── driver_status_provider.dart
│   ├── products_provider.dart
│   ├── categories_provider.dart
│   ├── chat_provider.dart
│   └── filter_provider.dart        ← UI 필터 상태
├── models/
│   ├── order.dart
│   ├── driver.dart
│   ├── driver_status.dart
│   ├── product.dart
│   ├── category.dart
│   ├── chat_message.dart
│   └── user_session.dart
└── services/
    ├── firebase_service.dart       ← 쓰기 작업 모음
    ├── photo_service.dart
    └── location_service.dart
```

---

## 11. 주의사항

1. **build 메서드 안에서는 반드시 `ref.watch`를 사용하세요.** `ref.read`를 build 안에서 사용하면 상태 변경 시 UI가 갱신되지 않습니다.
2. **StateNotifier의 state는 불변(immutable) 객체여야 합니다.** `copyWith`를 활용하세요.
3. **Firebase `onValue`는 해당 경로의 전체 스냅샷을 반환합니다.** 주문 수가 수천 건 이상이면 `onChildAdded`/`onChildChanged` 조합으로 최적화를 검토하세요.
4. **`ref.invalidate(provider)`로 강제 새로고침이 가능합니다.** 에러 발생 시 재시도 버튼에 활용하세요.
5. **Provider 안에서 다른 Provider를 `ref.watch`할 때 순환 의존을 만들지 마세요.** A → B → A 구조가 되면 무한 루프가 발생합니다.

---

이전 문서:
- [04-flutter-driver-app.md](./04-flutter-driver-app.md) — Flutter 기사 앱 가이드

다음 문서:
- [08-routing-navigation.md](./08-routing-navigation.md) — 라우팅 & 네비게이션
- [09-ui-design-system.md](./09-ui-design-system.md) — UI 디자인 시스템

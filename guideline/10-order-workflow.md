# 10. 주문 워크플로 구현 (Flutter 통합)

> **대상 독자:** Flutter 전환을 담당하는 풀스택 개발자
> **목표:** 기존 Vanilla JS + React 웹의 주문 관리 로직을 Flutter 단일 코드베이스(Web + Android + iOS)로 통합 구현

---

## 1. 전환 방향 요약

기존 시스템은 웹(Vanilla JS/React)과 기사 전용 Flutter 앱으로 분리되어 있었습니다. 이번 통합에서는 **Flutter Web + Android + iOS를 하나의 코드베이스**로 합칩니다.

| 기존 | 통합 후 |
|------|---------|
| 웹: React (floor2, floor1, admin) | Flutter Web (동일 역할) |
| 앱: Flutter (driver만) | Flutter Mobile (driver + 비상시 다른 역할도 접근 가능) |
| 2개 코드베이스 유지 | **1개 코드베이스** |

### 핵심 원칙

- 4가지 역할(floor2, floor1, driver, admin)의 모든 화면을 Flutter로 구현
- Firebase Realtime DB + Storage + Auth 그대로 유지 (프로젝트: `mayflower-5c9dd`)
- 주문 상태 코드(0~6)는 웹과 100% 동일 — 변경 금지

---

## 2. 주문 데이터 모델

### Order 클래스 (전체 코드)

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
  final int status;
  final String? assignedDriverId;
  final String? assignedDriverName;
  final DateTime? assignedAt;
  final String? storePhotoUrl;
  final String? deliveryPhotoUrl;
  final String createdByUserId;
  final String createdByName;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Order({
    required this.id,
    required this.chainName,
    required this.productId,
    required this.productName,
    required this.deliveryDatetime,
    required this.isImmediate,
    required this.deliveryAddress,
    required this.recipientName,
    required this.recipientPhone,
    required this.ribbonText,
    required this.occasionText,
    required this.status,
    this.assignedDriverId,
    this.assignedDriverName,
    this.assignedAt,
    this.storePhotoUrl,
    this.deliveryPhotoUrl,
    required this.createdByUserId,
    required this.createdByName,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Firebase Realtime DB의 snapshot → Order 객체
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
    assignedAt: m['assignedAt'] != null
        ? DateTime.parse(m['assignedAt'])
        : null,
    storePhotoUrl: m['storePhotoUrl'],
    deliveryPhotoUrl: m['deliveryPhotoUrl'],
    createdByUserId: m['createdByUserId']?.toString() ?? '',
    createdByName: m['createdByName'] ?? '',
    createdAt: DateTime.parse(m['createdAt']),
    updatedAt: DateTime.parse(m['updatedAt']),
  );

  /// Order 객체 → Firebase에 저장할 Map
  Map<String, dynamic> toMap() => {
    'chainName': chainName,
    'productId': productId,
    'productName': productName,
    'deliveryDatetime': deliveryDatetime.toIso8601String(),
    'isImmediate': isImmediate,
    'deliveryAddress': deliveryAddress,
    'recipientName': recipientName,
    'recipientPhone': recipientPhone,
    'ribbonText': ribbonText,
    'occasionText': occasionText,
    'status': status,
    'assignedDriverId': assignedDriverId,
    'assignedDriverName': assignedDriverName,
    'assignedAt': assignedAt?.toIso8601String(),
    'storePhotoUrl': storePhotoUrl,
    'deliveryPhotoUrl': deliveryPhotoUrl,
    'createdByUserId': createdByUserId,
    'createdByName': createdByName,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  /// 불변 객체이므로 copyWith 패턴 사용
  Order copyWith({
    int? status,
    String? assignedDriverId,
    String? assignedDriverName,
    DateTime? assignedAt,
    String? storePhotoUrl,
    String? deliveryPhotoUrl,
    DateTime? updatedAt,
  }) =>
      Order(
        id: id,
        chainName: chainName,
        productId: productId,
        productName: productName,
        deliveryDatetime: deliveryDatetime,
        isImmediate: isImmediate,
        deliveryAddress: deliveryAddress,
        recipientName: recipientName,
        recipientPhone: recipientPhone,
        ribbonText: ribbonText,
        occasionText: occasionText,
        status: status ?? this.status,
        assignedDriverId: assignedDriverId ?? this.assignedDriverId,
        assignedDriverName: assignedDriverName ?? this.assignedDriverName,
        assignedAt: assignedAt ?? this.assignedAt,
        storePhotoUrl: storePhotoUrl ?? this.storePhotoUrl,
        deliveryPhotoUrl: deliveryPhotoUrl ?? this.deliveryPhotoUrl,
        createdByUserId: createdByUserId,
        createdByName: createdByName,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
}
```

---

## 3. 상태 코드 상수

주문 상태 코드는 웹/앱 전체에서 공유하는 **절대 규약**입니다. 숫자를 직접 쓰지 말고 반드시 이 클래스를 통해 참조하세요.

```dart
// lib/models/order_status.dart

import 'package:flutter/material.dart';

class OrderStatus {
  OrderStatus._(); // 인스턴스화 방지

  static const received   = 0;  // 주문접수
  static const confirmed  = 1;  // 확인됨
  static const producing  = 2;  // 제작중
  static const delivering = 3;  // 배송중
  static const completed  = 4;  // 배송완료
  static const cancelledA = 5;  // 주문취소 A
  static const cancelledB = 6;  // 주문취소 B

  /// 상태 코드 → 한글 라벨
  static String label(int s) => switch (s) {
    0 => '주문접수',
    1 => '확인됨',
    2 => '제작중',
    3 => '배송중',
    4 => '배송완료',
    5 => '주문취소',
    6 => '주문취소',
    _ => '알 수 없음',
  };

  /// 상태 코드 → 색상
  static Color color(int s) => switch (s) {
    0 || 1 || 2 => const Color(0xFF3B82F6), // 파란색 (접수/제작)
    3           => const Color(0xFFF59E0B), // 주황색 (배송중)
    4           => const Color(0xFF10B981), // 초록색 (완료)
    5 || 6      => const Color(0xFFEF4444), // 빨간색 (취소)
    _           => const Color(0xFF6B7280), // 회색
  };

  /// 상태 그룹 판별
  static bool isReceived(int s) => s >= 0 && s <= 2;
  static bool isDelivering(int s) => s == 3;
  static bool isCompleted(int s) => s == 4;
  static bool isCancelled(int s) => s == 5 || s == 6;
}
```

---

## 4. 역할별 화면 및 동작

### 4.1 floor2 (2층 수주)

2층 수주 담당자는 전화/방문 주문을 시스템에 등록하고, 본인이 접수한 주문만 조회합니다.

#### 신규 주문 접수 폼

```dart
// lib/screens/floor2/new_order_screen.dart

class NewOrderScreen extends ConsumerStatefulWidget {
  const NewOrderScreen({super.key});

  @override
  ConsumerState<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends ConsumerState<NewOrderScreen> {
  final _formKey = GlobalKey<FormState>();
  final _chainNameCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _recipientNameCtrl = TextEditingController();
  final _recipientPhoneCtrl = TextEditingController();
  final _ribbonTextCtrl = TextEditingController();
  final _occasionTextCtrl = TextEditingController();

  String? _selectedProductId;
  DateTime _deliveryDatetime = DateTime.now().add(const Duration(hours: 2));
  bool _isImmediate = false;

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(productsProvider);

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 체인명
          TextFormField(
            controller: _chainNameCtrl,
            decoration: const InputDecoration(labelText: '체인명'),
            validator: (v) => (v == null || v.trim().isEmpty) ? '체인명을 입력하세요' : null,
          ),
          const SizedBox(height: 12),

          // 상품 선택 (드롭다운)
          products.when(
            data: (list) => DropdownButtonFormField<String>(
              value: _selectedProductId,
              decoration: const InputDecoration(labelText: '상품'),
              items: list.map((p) => DropdownMenuItem(
                value: p.id,
                child: Text(p.name),
              )).toList(),
              onChanged: (v) => setState(() => _selectedProductId = v),
              validator: (v) => v == null ? '상품을 선택하세요' : null,
            ),
            loading: () => const CircularProgressIndicator(),
            error: (e, _) => Text('상품 로드 실패: $e'),
          ),
          const SizedBox(height: 12),

          // 즉시배송 체크
          CheckboxListTile(
            title: const Text('즉시배송'),
            value: _isImmediate,
            onChanged: (v) => setState(() => _isImmediate = v ?? false),
          ),

          // 배송 일시 (즉시배송이 아닐 때만)
          if (!_isImmediate)
            ListTile(
              title: Text('배송 일시: ${_formatDateTime(_deliveryDatetime)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: _pickDatetime,
            ),

          // 배송지, 받는분, 전화번호
          TextFormField(
            controller: _addressCtrl,
            decoration: const InputDecoration(labelText: '배송지 주소'),
            validator: (v) => (v == null || v.trim().isEmpty) ? '배송지를 입력하세요' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _recipientNameCtrl,
            decoration: const InputDecoration(labelText: '받는분'),
            validator: (v) => (v == null || v.trim().isEmpty) ? '받는분을 입력하세요' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _recipientPhoneCtrl,
            decoration: const InputDecoration(labelText: '받는분 전화번호'),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),

          // 리본 문구, 조사/경사 문구
          TextFormField(
            controller: _ribbonTextCtrl,
            decoration: const InputDecoration(labelText: '리본 문구'),
            maxLines: 2,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _occasionTextCtrl,
            decoration: const InputDecoration(labelText: '조사/경사 문구'),
          ),
          const SizedBox(height: 24),

          // 등록 버튼
          ElevatedButton(
            onPressed: _submit,
            child: const Text('주문 등록'),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final session = ref.read(authProvider).session!;
    await ref.read(orderServiceProvider).createOrder(
      chainName: _chainNameCtrl.text.trim(),
      productId: _selectedProductId!,
      deliveryDatetime: _isImmediate ? DateTime.now() : _deliveryDatetime,
      isImmediate: _isImmediate,
      deliveryAddress: _addressCtrl.text.trim(),
      recipientName: _recipientNameCtrl.text.trim(),
      recipientPhone: _recipientPhoneCtrl.text.trim(),
      ribbonText: _ribbonTextCtrl.text.trim(),
      occasionText: _occasionTextCtrl.text.trim(),
      createdByUserId: session.userId,
      createdByName: session.displayName,
    );
    if (mounted) Navigator.pop(context);
  }

  // ... _pickDatetime, _formatDateTime 유틸 생략
}
```

#### 내 주문 조회

`createdByUserId` 필터로 본인이 등록한 주문만 표시합니다.

```dart
// lib/providers/my_orders_provider.dart

final myCreatedOrdersProvider = StreamProvider.family<List<Order>, String>(
  (ref, userId) {
    final dbRef = FirebaseDatabase.instance
        .ref('orders')
        .orderByChild('createdByUserId')
        .equalTo(userId);

    return dbRef.onValue.map((event) {
      final data = event.snapshot.value as Map<dynamic, dynamic>?;
      if (data == null) return <Order>[];
      return data.entries
          .map((e) => Order.fromMap(e.key as String, e.value as Map))
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    });
  },
);
```

---

### 4.2 floor1 (1층 제작)

1층 제작 담당자는 전체 주문을 조회하고, 상태를 변경하며, 기사를 배정합니다.

#### 전체 주문 조회 (필터: 상태별, 날짜별, 검색어)

```dart
// lib/screens/floor1/all_orders_screen.dart

class AllOrdersScreen extends ConsumerStatefulWidget {
  const AllOrdersScreen({super.key});
  @override
  ConsumerState<AllOrdersScreen> createState() => _AllOrdersScreenState();
}

class _AllOrdersScreenState extends ConsumerState<AllOrdersScreen> {
  String _statusFilter = '';        // '' = 전체, '0,1,2' = 주문접수, '3' = 배송중, ...
  String _searchAddress = '';
  String _searchRecipient = '';
  String _searchRibbon = '';
  DateTimeRange? _dateRange;

  @override
  Widget build(BuildContext context) {
    final asyncOrders = ref.watch(allOrdersProvider);

    return Column(
      children: [
        // 상태 탭 필터
        _buildStatusTabs(),
        // 날짜 범위 / 검색 필터
        _buildSearchFilters(),
        // 주문 리스트
        Expanded(
          child: asyncOrders.when(
            data: (orders) {
              final filtered = _applyFilters(orders);
              return ListView.builder(
                itemCount: filtered.length,
                itemBuilder: (_, i) => OrderCard(
                  order: filtered[i],
                  onStatusChange: _changeStatus,
                  onAssignDriver: _openAssignModal,
                ),
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('오류: $e')),
          ),
        ),
      ],
    );
  }

  List<Order> _applyFilters(List<Order> orders) {
    var result = orders;

    // 상태 필터
    if (_statusFilter.isNotEmpty) {
      final codes = _statusFilter.split(',').map(int.parse).toSet();
      result = result.where((o) => codes.contains(o.status)).toList();
    }

    // 날짜 범위 필터
    if (_dateRange != null) {
      result = result.where((o) =>
        o.deliveryDatetime.isAfter(_dateRange!.start) &&
        o.deliveryDatetime.isBefore(_dateRange!.end.add(const Duration(days: 1)))
      ).toList();
    }

    // 검색어 필터 (주소, 받는분, 리본 문구)
    if (_searchAddress.isNotEmpty) {
      result = result.where((o) =>
        o.deliveryAddress.contains(_searchAddress)).toList();
    }
    if (_searchRecipient.isNotEmpty) {
      result = result.where((o) =>
        o.recipientName.contains(_searchRecipient)).toList();
    }
    if (_searchRibbon.isNotEmpty) {
      result = result.where((o) =>
        o.ribbonText.contains(_searchRibbon)).toList();
    }

    return result;
  }

  // ... _buildStatusTabs, _buildSearchFilters, _changeStatus, _openAssignModal 구현
}
```

#### 주문 상태 변경 (0 -> 1 -> 2 단계)

```dart
Future<void> _changeStatus(Order order, int newStatus) async {
  // 유효한 전환인지 검증
  final validTransitions = {
    OrderStatus.received: [OrderStatus.confirmed, OrderStatus.cancelledA],
    OrderStatus.confirmed: [OrderStatus.producing, OrderStatus.cancelledA],
    OrderStatus.producing: [OrderStatus.delivering, OrderStatus.cancelledA],
  };

  final allowed = validTransitions[order.status] ?? [];
  if (!allowed.contains(newStatus)) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('이 상태로는 변경할 수 없습니다.')),
    );
    return;
  }

  await ref.read(orderServiceProvider).updateOrder(order.id, {
    'status': newStatus,
    'updatedAt': DateTime.now().toIso8601String(),
  });
}
```

#### 기사 배정 모달 (트랜잭션으로 중복배차 방지)

```dart
// lib/widgets/assign_driver_modal.dart

class AssignDriverModal extends ConsumerWidget {
  final Order order;
  const AssignDriverModal({super.key, required this.order});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncDrivers = ref.watch(activeDriversProvider);

    return Dialog(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('기사 배정', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text('주문: ${order.chainName} - ${order.productName}'),
            const SizedBox(height: 16),
            asyncDrivers.when(
              data: (drivers) => Column(
                children: drivers.map((d) => ListTile(
                  leading: const Icon(Icons.local_shipping),
                  title: Text(d.name),
                  subtitle: Text(d.phone),
                  onTap: () => _assignDriver(context, ref, d),
                )).toList(),
              ),
              loading: () => const CircularProgressIndicator(),
              error: (e, _) => Text('기사 목록 로드 실패: $e'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _assignDriver(
    BuildContext context, WidgetRef ref, Driver driver,
  ) async {
    final success = await ref.read(orderServiceProvider).assignDriver(
      orderId: order.id,
      driverId: driver.id,
      driverName: driver.name,
    );

    if (context.mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(
          success ? '${driver.name} 기사에게 배정 완료' : '배정 실패 (이미 배정됨)',
        )),
      );
    }
  }
}
```

---

### 4.3 driver (배송 기사)

기사는 본인에게 배정된 주문만 보고, 배송 출발/완료를 처리합니다.

#### 내 배달 목록 (assignedDriverId 필터)

```dart
// lib/providers/driver_orders_provider.dart

final myDeliveriesProvider = StreamProvider.family<List<Order>, String>(
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
        ..sort((a, b) => a.deliveryDatetime.compareTo(b.deliveryDatetime));
    });
  },
);
```

#### 배송 출발 (status=3)

```dart
Future<void> onDepart(String orderId) async {
  await FirebaseDatabase.instance.ref('orders/$orderId').update({
    'status': OrderStatus.delivering,
    'updatedAt': DateTime.now().toIso8601String(),
  });
}
```

#### 배송 완료 사진 촬영 + 업로드 (status=4)

```dart
Future<void> onCompleteDelivery(String orderId) async {
  // 1. 카메라 촬영
  final picker = ImagePicker();
  final photo = await picker.pickImage(
    source: ImageSource.camera,
    imageQuality: 70,
    maxWidth: 1600,
  );
  if (photo == null) return;

  // 2. Firebase Storage 업로드
  final storageRef = FirebaseStorage.instance
      .ref('orders/$orderId/delivery-photo.jpg');
  await storageRef.putFile(File(photo.path));
  final url = await storageRef.getDownloadURL();

  // 3. DB 업데이트: status=4 + URL
  await FirebaseDatabase.instance.ref('orders/$orderId').update({
    'status': OrderStatus.completed,
    'deliveryPhotoUrl': url,
    'updatedAt': DateTime.now().toIso8601String(),
  });
}
```

---

### 4.4 admin (관리자)

관리자는 floor1의 전체 기능에 더해 상품 관리, 기사 관리, 통계, 배송 패널을 사용합니다.

```dart
// lib/screens/admin/admin_shell.dart

class AdminShell extends ConsumerWidget {
  const AdminShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        // 사이드바 (메뉴)
        const Sidebar(menuItems: [
          MenuItem(icon: Icons.list, label: '전체 주문', route: '/admin/orders'),
          MenuItem(icon: Icons.inventory, label: '상품 관리', route: '/admin/products'),
          MenuItem(icon: Icons.local_shipping, label: '기사 관리', route: '/admin/drivers'),
          MenuItem(icon: Icons.bar_chart, label: '통계', route: '/admin/statistics'),
        ]),
        // 메인 컨텐츠
        const Expanded(child: RouterOutlet()),
        // 배송기사 현황 패널 (데스크톱만)
        if (MediaQuery.of(context).size.width > 1200)
          const SizedBox(width: 360, child: DeliveryPanel()),
        // 채팅 패널
        if (MediaQuery.of(context).size.width > 1200)
          const SizedBox(width: 500, child: ChatPanel()),
      ],
    );
  }
}
```

---

## 5. OrderService 클래스 (Firebase CRUD)

```dart
// lib/services/order_service.dart

import 'dart:io';
import 'package:firebase_database/firebase_database.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/order.dart';
import '../models/order_status.dart';

final orderServiceProvider = Provider((ref) => OrderService());

class OrderService {
  final _db = FirebaseDatabase.instance;

  // ── 신규 주문 생성 ──────────────────────────────────────────
  Future<String> createOrder({
    required String chainName,
    required String productId,
    required DateTime deliveryDatetime,
    required bool isImmediate,
    required String deliveryAddress,
    required String recipientName,
    required String recipientPhone,
    required String ribbonText,
    required String occasionText,
    required String createdByUserId,
    required String createdByName,
  }) async {
    final newRef = _db.ref('orders').push();
    final now = DateTime.now().toIso8601String();

    // 상품 이름 조회
    final productSnap = await _db.ref('products/$productId').get();
    final productName = productSnap.exists
        ? (productSnap.value as Map)['name'] ?? ''
        : '';

    await newRef.set({
      'chainName': chainName,
      'productId': productId,
      'productName': productName,
      'deliveryDatetime': deliveryDatetime.toIso8601String(),
      'isImmediate': isImmediate,
      'deliveryAddress': deliveryAddress,
      'recipientName': recipientName,
      'recipientPhone': recipientPhone,
      'ribbonText': ribbonText,
      'occasionText': occasionText,
      'status': OrderStatus.received,
      'assignedDriverId': null,
      'assignedDriverName': null,
      'assignedAt': null,
      'storePhotoUrl': null,
      'deliveryPhotoUrl': null,
      'createdByUserId': createdByUserId,
      'createdByName': createdByName,
      'createdAt': now,
      'updatedAt': now,
    });

    return newRef.key!;
  }

  // ── 주문 실시간 스트림 (전체) ────────────────────────────────
  Stream<List<Order>> getOrders() {
    return _db.ref('orders').orderByChild('createdAt').onValue.map((event) {
      final data = event.snapshot.value as Map<dynamic, dynamic>?;
      if (data == null) return <Order>[];
      return data.entries
          .map((e) => Order.fromMap(e.key as String, e.value as Map))
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    });
  }

  // ── 주문 부분 업데이트 ──────────────────────────────────────
  Future<void> updateOrder(String orderId, Map<String, dynamic> updates) async {
    updates['updatedAt'] = DateTime.now().toIso8601String();
    await _db.ref('orders/$orderId').update(updates);
  }

  // ── 기사 배정 (트랜잭션 — 중복배차 방지) ─────────────────────
  Future<bool> assignDriver({
    required String orderId,
    required String driverId,
    required String driverName,
  }) async {
    final ref = _db.ref('orders/$orderId');
    final result = await ref.runTransaction((mutableData) {
      if (mutableData == null) return Transaction.abort();

      final current = Map<String, dynamic>.from(mutableData as Map);

      // 이미 다른 기사가 배정된 경우 abort
      if (current['assignedDriverId'] != null &&
          current['assignedDriverId'].toString().isNotEmpty) {
        return Transaction.abort();
      }

      current['assignedDriverId'] = driverId;
      current['assignedDriverName'] = driverName;
      current['assignedAt'] = DateTime.now().toIso8601String();
      current['updatedAt'] = DateTime.now().toIso8601String();

      return Transaction.success(current);
    });

    return result.committed;
  }

  // ── 배송 완료 (사진 업로드 + 상태 변경) ──────────────────────
  Future<void> completeDelivery({
    required String orderId,
    required File photoFile,
  }) async {
    // 1) Storage 업로드
    final storageRef = FirebaseStorage.instance
        .ref('orders/$orderId/delivery-photo.jpg');
    final uploadTask = storageRef.putFile(photoFile);

    // 업로드 진행률 (UI에서 활용 가능)
    uploadTask.snapshotEvents.listen((snap) {
      final progress = snap.bytesTransferred / snap.totalBytes;
      // ref.read(uploadProgressProvider.notifier).state = progress;
    });

    await uploadTask;
    final url = await storageRef.getDownloadURL();

    // 2) DB 업데이트
    await _db.ref('orders/$orderId').update({
      'status': OrderStatus.completed,
      'deliveryPhotoUrl': url,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }
}
```

---

## 6. DeliveryPanel (관리자 전용)

관리자 화면 우측에 표시되는 배송기사 현황 패널입니다. 기사의 실시간 뱃지, 진행률, 타임라인을 보여줍니다.

### 6.1 기사 뱃지 자동 알고리즘

```dart
// lib/models/driver_badge.dart

enum DriverBadge {
  waiting,     // 배송대기 (회사에 있고 배차 없음)
  assigned,    // 배차완료 (배차 받았으나 아직 출발 안 함)
  delivering,  // 배송중 (status=3인 주문이 있음)
  returning,   // 복귀중 (모든 주문 완료, 회사로 이동 중)
  offduty,     // 휴무
}

/// 기사의 현재 뱃지를 자동 계산
///
/// [orders] — 해당 기사에게 배정된 주문 목록
/// [resetTs] — 타임라인 초기화 기준 시각 (회사 100m 진입 시 갱신)
/// [isOffduty] — 휴무 여부
DriverBadge computeBadge(
  List<Order> orders,
  DateTime? resetTs, {
  bool isOffduty = false,
}) {
  if (isOffduty) return DriverBadge.offduty;

  // resetTs 이후의 주문만 대상
  final active = orders.where((o) =>
    resetTs == null || o.updatedAt.isAfter(resetTs),
  ).toList();

  final hasDelivering = active.any((o) => o.status == OrderStatus.delivering);
  final hasAssigned = active.any((o) => OrderStatus.isReceived(o.status));
  final hasCompleted = active.any((o) => o.status == OrderStatus.completed);

  if (hasDelivering) return DriverBadge.delivering;
  if (hasAssigned) return DriverBadge.assigned;
  if (hasCompleted) return DriverBadge.returning;
  return DriverBadge.waiting;
}
```

### 6.2 뱃지별 시각 표현

```dart
// lib/widgets/driver_badge_chip.dart

extension DriverBadgeUI on DriverBadge {
  String get label => switch (this) {
    DriverBadge.waiting => '배송대기',
    DriverBadge.assigned => '배차완료',
    DriverBadge.delivering => '배송중',
    DriverBadge.returning => '복귀중',
    DriverBadge.offduty => '휴무',
  };

  Color get color => switch (this) {
    DriverBadge.waiting => const Color(0xFF6B7280),    // 회색
    DriverBadge.assigned => const Color(0xFF3B82F6),   // 파란색
    DriverBadge.delivering => const Color(0xFFF59E0B), // 주황색
    DriverBadge.returning => const Color(0xFF8B5CF6),  // 보라색
    DriverBadge.offduty => const Color(0xFFD1D5DB),    // 연한 회색
  };

  IconData get icon => switch (this) {
    DriverBadge.waiting => Icons.hourglass_empty,
    DriverBadge.assigned => Icons.assignment,
    DriverBadge.delivering => Icons.local_shipping,
    DriverBadge.returning => Icons.home,
    DriverBadge.offduty => Icons.bed,
  };
}
```

### 6.3 기사 카드 위젯

```dart
// lib/widgets/driver_card.dart

class DriverCard extends StatelessWidget {
  final Driver driver;
  final DriverBadge badge;
  final int completedCount;
  final int totalCount;
  final List<Order> timeline;

  const DriverCard({
    super.key,
    required this.driver,
    required this.badge,
    required this.completedCount,
    required this.totalCount,
    required this.timeline,
  });

  @override
  Widget build(BuildContext context) {
    final progress = totalCount > 0 ? completedCount / totalCount : 0.0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 이름 + 뱃지
            Row(
              children: [
                Text(driver.name,
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(width: 8),
                Chip(
                  avatar: Icon(badge.icon, size: 16, color: Colors.white),
                  label: Text(badge.label,
                      style: const TextStyle(color: Colors.white, fontSize: 12)),
                  backgroundColor: badge.color,
                ),
              ],
            ),
            const SizedBox(height: 8),

            // 진행률 바
            if (totalCount > 0) ...[
              Row(
                children: [
                  Expanded(
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: Colors.grey[200],
                      color: badge.color,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('$completedCount/$totalCount',
                      style: const TextStyle(fontSize: 12)),
                ],
              ),
              const SizedBox(height: 8),
            ],

            // 타임라인 (최근 주문 상태)
            ...timeline.take(5).map((o) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Container(
                    width: 8, height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: OrderStatus.color(o.status),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: Text(
                    '${o.recipientName} - ${OrderStatus.label(o.status)}',
                    style: const TextStyle(fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  )),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }
}
```

### 6.4 배송대기 상태에서 휴무/출근 토글

```dart
// lib/services/driver_status_service.dart

Future<void> toggleOffduty(String driverId, bool isOffduty) async {
  await FirebaseDatabase.instance.ref('driverStatus/$driverId').update({
    'offduty': isOffduty,
    'lastUpdate': DateTime.now().toIso8601String(),
  });
}
```

배송대기(waiting) 상태인 기사 카드에만 "휴무/출근" 토글 버튼이 표시됩니다. 배송중이거나 배차완료인 기사는 토글할 수 없습니다.

---

## 7. 매장 촬영 사진 (storePhotoUrl) 업로드 플로우

매장에서 제작 완료된 꽃 사진을 촬영하여 주문에 첨부하는 기능입니다. floor1 또는 admin이 사용합니다.

```dart
// lib/services/photo_service.dart

import 'dart:io';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

class PhotoService {
  final _picker = ImagePicker();

  /// 매장 촬영 사진 업로드 (floor1/admin 사용)
  Future<String?> uploadStorePhoto(String orderId) async {
    final photo = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70,
      maxWidth: 1600,
    );
    if (photo == null) return null;

    // Storage 업로드
    final storageRef = FirebaseStorage.instance
        .ref('orders/$orderId/store-photo.jpg');

    if (kIsWeb) {
      // Web: bytes로 업로드
      final bytes = await photo.readAsBytes();
      await storageRef.putData(bytes);
    } else {
      // Mobile: File로 업로드
      await storageRef.putFile(File(photo.path));
    }

    final url = await storageRef.getDownloadURL();

    // DB에 URL 저장
    await FirebaseDatabase.instance.ref('orders/$orderId').update({
      'storePhotoUrl': url,
      'updatedAt': DateTime.now().toIso8601String(),
    });

    return url;
  }

  /// 배송 완료 사진 업로드 (driver 사용)
  Future<String?> uploadDeliveryPhoto(String orderId) async {
    final photo = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70,
      maxWidth: 1600,
    );
    if (photo == null) return null;

    final storageRef = FirebaseStorage.instance
        .ref('orders/$orderId/delivery-photo.jpg');

    if (kIsWeb) {
      final bytes = await photo.readAsBytes();
      await storageRef.putData(bytes);
    } else {
      await storageRef.putFile(File(photo.path));
    }

    final url = await storageRef.getDownloadURL();

    await FirebaseDatabase.instance.ref('orders/$orderId').update({
      'status': 4,
      'deliveryPhotoUrl': url,
      'updatedAt': DateTime.now().toIso8601String(),
    });

    return url;
  }
}
```

### 업로드 플로우 다이어그램

```
[1층 제작 담당자]
  │
  ├── 주문 상세 화면 → "매장 사진 촬영" 버튼 클릭
  │
  ├── ImagePicker → 카메라 실행
  │
  ├── 촬영 완료 → Firebase Storage 업로드
  │   경로: orders/{orderId}/store-photo.jpg
  │
  ├── 업로드 완료 → Download URL 획득
  │
  └── DB 업데이트: orders/{orderId}/storePhotoUrl = URL
      → 모든 사용자 화면에 사진 즉시 표시 (실시간 동기화)
```

---

## 8. 전체 Provider 구성 요약

```dart
// lib/providers/providers.dart

// 인증 상태
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(...);

// 주문 목록 (전체)
final allOrdersProvider = StreamProvider<List<Order>>((ref) {
  return ref.read(orderServiceProvider).getOrders();
});

// 내가 등록한 주문 (floor2)
final myCreatedOrdersProvider = StreamProvider.family<List<Order>, String>(...);

// 내 배달 목록 (driver)
final myDeliveriesProvider = StreamProvider.family<List<Order>, String>(...);

// 상품 목록
final productsProvider = StreamProvider<List<Product>>(...);

// 기사 목록
final activeDriversProvider = StreamProvider<List<Driver>>(...);

// 기사 상태 (DeliveryPanel용)
final driverStatusProvider = StreamProvider<Map<String, DriverStatus>>(...);

// 서비스
final orderServiceProvider = Provider((ref) => OrderService());
final photoServiceProvider = Provider((ref) => PhotoService());
```

---

## 9. Firebase Realtime DB 경로 참조

| 경로 | 용도 | 읽기 | 쓰기 |
|------|------|------|------|
| `/orders/{pushKey}` | 주문 데이터 | 전체 | floor2(생성), floor1/admin(수정), driver(상태변경) |
| `/products/{pushKey}` | 상품 마스터 | 전체 | admin |
| `/drivers/{pushKey}` | 기사 정보 | 전체 | admin |
| `/driverStatus/{driverId}` | 기사 실시간 상태 | 전체 | 해당 기사, admin |
| `/users/{uid}` | 사용자 프로필 | 전체 | 본인, admin |

---

## 10. 주의사항

1. **주문 상태 코드(0~6)는 절대 변경하지 마세요.** 웹/앱 모든 화면이 이 코드에 의존합니다.
2. **`updatedAt`은 모든 쓰기에서 반드시 갱신하세요.** DeliveryPanel의 `resetTs` 필터가 이 값에 의존합니다.
3. **기사 배정은 반드시 트랜잭션을 사용하세요.** 관리자 여러 명이 동시에 같은 주문에 배차하면 중복이 발생합니다.
4. **사진 업로드 시 `kIsWeb` 분기 처리가 필수입니다.** Web에서는 `File` 객체를 사용할 수 없으므로 `putData(bytes)`를 사용합니다.
5. **`toMap()`에서 null 값도 명시적으로 저장하세요.** Firebase Realtime DB는 null 필드를 삭제하지만, 초기 생성 시에는 모든 필드가 존재해야 다른 클라이언트에서 정상 파싱됩니다.

---

다음 문서: [11-realtime-chat.md](./11-realtime-chat.md)

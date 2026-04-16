# 12. 기사 전용 기능 — GPS, 카메라, 푸시 알림 (Flutter 통합)

> **대상 독자:** Flutter 전환을 담당하는 풀스택 개발자, 특히 모바일 네이티브 기능 담당자
> **목표:** 배송 기사에게 필요한 GPS 위치 추적, 카메라 촬영, 푸시 알림을 Flutter 단일 코드베이스에서 구현

---

## 1. 기사 앱이 필요한 이유

배송 기사는 다른 역할(floor2, floor1, admin)과 근본적으로 다른 환경에서 일합니다.

| 요구사항 | 웹만으로 가능? | 네이티브 앱 필요? |
|----------|:----------:|:-------------:|
| 이동 중 주문 확인 | 가능 (모바일 웹) | - |
| 배송 완료 **사진 촬영** | 제한적 | 필수 |
| **GPS 위치** 실시간 추적 | foreground만 | 백그라운드 필수 |
| 회사 100m 진입 **자동 감지** | 불가 | 필수 |
| 신규 배차 **푸시 알림** | 제한적 (Service Worker) | 필수 |
| 오프라인 대응 | 제한적 | 우수 |

기사가 배송 현장에서 앱을 최소한으로 조작하면서 업무를 처리할 수 있도록, 네이티브 기능을 적극 활용해야 합니다.

---

## 2. Flutter가 해결하는 것

Flutter 통합 코드베이스에서 기사 전용 기능을 구현하면:

- **동일한 Order 모델, OrderService, ChatService**를 그대로 사용
- Web/Android/iOS 조건부 코드(`kIsWeb`)로 플랫폼 분기
- floor1/admin이 Web에서 배차하면 기사의 Mobile 앱에 즉시 반영
- 코드 중복 없이 한 곳에서 유지보수

```dart
import 'package:flutter/foundation.dart' show kIsWeb;

if (kIsWeb) {
  // Web: 백그라운드 GPS 불가, Service Worker 기반 FCM
} else {
  // Mobile: 네이티브 GPS, 카메라, FCM
}
```

---

## 3. GPS 위치 추적

### 3.1 geolocator 패키지 설정

```yaml
# pubspec.yaml
dependencies:
  geolocator: ^11.0.0
  permission_handler: ^11.3.0
```

### 3.2 위치 권한 요청

```dart
// lib/services/permission_service.dart

import 'package:geolocator/geolocator.dart';

class PermissionService {
  /// 위치 권한 요청 (Android/iOS 공통)
  static Future<bool> requestLocationPermission() async {
    // 1. 위치 서비스 활성화 확인
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      // 사용자에게 위치 서비스 활성화 안내
      return false;
    }

    // 2. 권한 확인
    var permission = await Geolocator.checkPermission();

    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      // 설정 화면으로 안내
      await Geolocator.openAppSettings();
      return false;
    }

    return true;
  }

  /// 백그라운드 위치 권한 (Android 전용, 별도 요청 필요)
  static Future<bool> requestBackgroundPermission() async {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.whileInUse) {
      // Android: "항상 허용"으로 업그레이드 요청
      final upgraded = await Geolocator.requestPermission();
      return upgraded == LocationPermission.always;
    }
    return permission == LocationPermission.always;
  }
}
```

### 3.3 LocationService 클래스

```dart
// lib/services/location_service.dart

import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:firebase_database/firebase_database.dart';

/// 회사 좌표 (대구 달서구 장기동 666-1)
const double companyLat = 35.8293;
const double companyLng = 128.5453;

/// 복귀 판정 반경 (미터)
const double returnRadius = 100.0;

class LocationService {
  final _db = FirebaseDatabase.instance;
  Timer? _timer;
  StreamSubscription<Position>? _positionSubscription;

  /// 현재 위치를 한 번 가져와서 Firebase에 업데이트
  Future<void> updateLocation(String driverId) async {
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 50, // 50m 이동 시에만 갱신 (배터리 절약)
      ),
    );

    final distance = Geolocator.distanceBetween(
      pos.latitude, pos.longitude,
      companyLat, companyLng,
    );

    final update = <String, dynamic>{
      'lat': pos.latitude,
      'lng': pos.longitude,
      'lastUpdate': DateTime.now().toIso8601String(),
    };

    // 100m 이내 진입 시 배송대기로 자동 전환 + 타임라인 리셋
    if (distance <= returnRadius) {
      update['badge'] = 'waiting';
      update['resetTs'] = DateTime.now().toIso8601String();
    }

    await _db.ref('driverStatus/$driverId').update(update);
  }

  /// 주기적 위치 업데이트 시작
  ///
  /// [isDelivering] — true: 30초 간격, false: 5분 간격
  void startPeriodicUpdate(String driverId, {bool isDelivering = false}) {
    stopPeriodicUpdate();

    final interval = isDelivering
        ? const Duration(seconds: 30)
        : const Duration(minutes: 5);

    // 즉시 한 번 실행
    updateLocation(driverId);

    // 이후 주기적 실행
    _timer = Timer.periodic(interval, (_) {
      updateLocation(driverId);
    });
  }

  /// 주기적 업데이트 중지
  void stopPeriodicUpdate() {
    _timer?.cancel();
    _timer = null;
  }

  /// 위치 변경 스트림 기반 업데이트 (배송중일 때 권장)
  void startStreamUpdate(String driverId) {
    _positionSubscription?.cancel();

    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 50, // 50m 이동마다 콜백
      ),
    ).listen((pos) async {
      final distance = Geolocator.distanceBetween(
        pos.latitude, pos.longitude,
        companyLat, companyLng,
      );

      final update = <String, dynamic>{
        'lat': pos.latitude,
        'lng': pos.longitude,
        'lastUpdate': DateTime.now().toIso8601String(),
      };

      if (distance <= returnRadius) {
        update['badge'] = 'waiting';
        update['resetTs'] = DateTime.now().toIso8601String();
      }

      await _db.ref('driverStatus/$driverId').update(update);
    });
  }

  void stopStreamUpdate() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
  }

  /// 모든 위치 업데이트 중지
  void dispose() {
    stopPeriodicUpdate();
    stopStreamUpdate();
  }
}
```

### 3.4 주기적 업데이트 전략

| 기사 상태 | 업데이트 간격 | 방식 | 이유 |
|-----------|:----------:|------|------|
| 배송중 (delivering) | 30초 | `getPositionStream` + `distanceFilter: 50m` | 실시간 위치 필요, 이동 중이라 배터리 부담 적음 |
| 대기중 (waiting/assigned) | 5분 | `Timer.periodic` | 위치 변화 적음, 배터리 절약 |
| 휴무 (offduty) | 중지 | 업데이트 안 함 | 불필요 |

### 3.5 백그라운드 위치 (flutter_background_geolocation)

앱이 백그라운드에 있을 때도 위치를 추적해야 합니다. 특히 "배송 후 회사 100m 진입 감지"에 필수적입니다.

```yaml
# pubspec.yaml
dependencies:
  flutter_background_geolocation: ^4.14.0
```

```dart
// lib/services/background_location_service.dart

import 'package:flutter_background_geolocation/flutter_background_geolocation.dart'
    as bg;
import 'package:firebase_database/firebase_database.dart';

class BackgroundLocationService {
  static Future<void> configure(String driverId) async {
    // 설정
    await bg.BackgroundGeolocation.ready(bg.Config(
      desiredAccuracy: bg.Config.DESIRED_ACCURACY_HIGH,
      distanceFilter: 50.0,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      debug: false, // 프로덕션에서는 false

      // Android 전용
      notification: bg.Notification(
        title: '메이대구 배송',
        text: '위치를 추적하고 있습니다',
        channelName: '배송 위치 추적',
      ),
    ));

    // 위치 변경 리스너
    bg.BackgroundGeolocation.onLocation((bg.Location location) {
      _onLocationUpdate(driverId, location);
    });

    // Geofence: 회사 100m 반경
    bg.BackgroundGeolocation.addGeofence(bg.Geofence(
      identifier: 'company',
      radius: returnRadius,
      latitude: companyLat,
      longitude: companyLng,
      notifyOnEntry: true,
    ));

    // Geofence 진입 시
    bg.BackgroundGeolocation.onGeofence((bg.GeofenceEvent event) {
      if (event.identifier == 'company' && event.action == 'ENTER') {
        FirebaseDatabase.instance.ref('driverStatus/$driverId').update({
          'badge': 'waiting',
          'resetTs': DateTime.now().toIso8601String(),
          'lastUpdate': DateTime.now().toIso8601String(),
        });
      }
    });
  }

  static Future<void> _onLocationUpdate(
    String driverId, bg.Location location,
  ) async {
    await FirebaseDatabase.instance.ref('driverStatus/$driverId').update({
      'lat': location.coords.latitude,
      'lng': location.coords.longitude,
      'lastUpdate': DateTime.now().toIso8601String(),
    });
  }

  static Future<void> start() async {
    await bg.BackgroundGeolocation.start();
  }

  static Future<void> stop() async {
    await bg.BackgroundGeolocation.stop();
  }
}
```

### 3.6 배터리 절약 팁

1. **`distanceFilter: 50`** — 50m 미만 이동은 무시
2. **상태별 간격 조절** — 배송중=30초, 대기중=5분, 휴무=중지
3. **`LocationAccuracy.medium`** — 배송 대기 중에는 정확도를 낮춰도 충분
4. **Android 배터리 최적화 예외** 요청 — 그렇지 않으면 OS가 백그라운드 GPS를 차단할 수 있음

```dart
// 배터리 최적화 예외 요청 (Android)
import 'package:permission_handler/permission_handler.dart';

Future<void> requestBatteryOptimizationExemption() async {
  if (await Permission.ignoreBatteryOptimizations.isDenied) {
    await Permission.ignoreBatteryOptimizations.request();
  }
}
```

---

## 4. 카메라 & 사진 업로드

### 4.1 image_picker 패키지

```yaml
# pubspec.yaml
dependencies:
  image_picker: ^1.0.7
```

### 4.2 촬영 -> 업로드 -> DB 업데이트 -> status=4

```dart
// lib/services/delivery_photo_service.dart

import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_database/firebase_database.dart';
import '../models/order_status.dart';

class DeliveryPhotoService {
  final _picker = ImagePicker();

  /// 배송 완료 사진 촬영 + 업로드 + 상태 변경
  ///
  /// 반환값: 업로드된 사진 URL (실패 시 null)
  Future<String?> captureAndUpload({
    required String orderId,
    void Function(double progress)? onProgress,
  }) async {
    // ── 1단계: 카메라 촬영 ──────────────────────────────────
    final photo = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70,    // 70% 품질 (파일 크기 절감)
      maxWidth: 1600,      // 최대 가로 1600px
    );

    if (photo == null) return null; // 사용자가 취소

    // ── 2단계: Firebase Storage 업로드 ──────────────────────
    final storageRef = FirebaseStorage.instance
        .ref('orders/$orderId/delivery-photo.jpg');

    final UploadTask uploadTask;

    if (kIsWeb) {
      // Web: bytes로 업로드
      final bytes = await photo.readAsBytes();
      uploadTask = storageRef.putData(
        bytes,
        SettableMetadata(contentType: 'image/jpeg'),
      );
    } else {
      // Mobile: File로 업로드
      uploadTask = storageRef.putFile(
        File(photo.path),
        SettableMetadata(contentType: 'image/jpeg'),
      );
    }

    // 업로드 진행률 콜백
    uploadTask.snapshotEvents.listen((snap) {
      if (snap.totalBytes > 0) {
        final progress = snap.bytesTransferred / snap.totalBytes;
        onProgress?.call(progress);
      }
    });

    // 업로드 완료 대기
    await uploadTask;

    // ── 3단계: Download URL 획득 ──────────────────────────
    final url = await storageRef.getDownloadURL();

    // ── 4단계: DB 업데이트 (status=4 + URL) ────────────────
    await FirebaseDatabase.instance.ref('orders/$orderId').update({
      'status': OrderStatus.completed,
      'deliveryPhotoUrl': url,
      'updatedAt': DateTime.now().toIso8601String(),
    });

    return url;
  }
}
```

### 4.3 이미지 품질/크기 제한 가이드

| 설정 | 값 | 이유 |
|------|-----|------|
| `imageQuality` | 70 | 육안상 차이 미미, 파일 크기 약 50% 절감 |
| `maxWidth` | 1600 | 대부분의 화면에서 충분한 해상도 |
| `maxHeight` | 미지정 | 비율 유지를 위해 가로만 제한 |
| Storage 제한 | 10MB | Firebase Storage 보안 규칙에서 제한 |

### 4.4 업로드 진행률 UI

```dart
// lib/widgets/upload_progress_dialog.dart

class UploadProgressDialog extends StatelessWidget {
  final ValueNotifier<double> progress;

  const UploadProgressDialog({super.key, required this.progress});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('사진 업로드 중...'),
      content: ValueListenableBuilder<double>(
        valueListenable: progress,
        builder: (_, value, __) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LinearProgressIndicator(value: value),
            const SizedBox(height: 8),
            Text('${(value * 100).toStringAsFixed(0)}%'),
          ],
        ),
      ),
    );
  }
}

// 사용 예시
Future<void> _handleComplete(BuildContext context, String orderId) async {
  final progress = ValueNotifier<double>(0);

  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (_) => UploadProgressDialog(progress: progress),
  );

  final url = await DeliveryPhotoService().captureAndUpload(
    orderId: orderId,
    onProgress: (p) => progress.value = p,
  );

  if (context.mounted) Navigator.pop(context); // 다이얼로그 닫기

  if (url != null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('배송 완료 처리되었습니다')),
    );
  }
}
```

---

## 5. 푸시 알림 (FCM)

### 5.1 firebase_messaging 설정

```yaml
# pubspec.yaml
dependencies:
  firebase_messaging: ^14.7.0
  flutter_local_notifications: ^17.0.0
```

### 5.2 Android 설정

`android/app/build.gradle`에 Firebase 플러그인이 적용되어 있으면 별도 설정 불필요.

### 5.3 iOS 설정

1. Xcode에서 **Push Notifications** capability 추가
2. **Background Modes** → Remote notifications 체크
3. Apple Developer Console에서 APNs Key 생성 → Firebase Console에 등록

### 5.4 FCM 토큰 저장

```dart
// lib/services/notification_service.dart

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  final _messaging = FirebaseMessaging.instance;
  final _localNotifications = FlutterLocalNotificationsPlugin();

  /// FCM 초기화 및 토큰 저장
  Future<void> initialize(String driverId) async {
    // 1. 알림 권한 요청
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus != AuthorizationStatus.authorized) {
      return;
    }

    // 2. FCM 토큰 획득 및 저장
    final token = await _messaging.getToken();
    if (token != null) {
      await _saveToken(driverId, token);
    }

    // 3. 토큰 갱신 리스너
    _messaging.onTokenRefresh.listen((newToken) {
      _saveToken(driverId, newToken);
    });

    // 4. 로컬 알림 초기화 (foreground 용)
    await _initLocalNotifications();

    // 5. foreground 메시지 핸들러
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // 6. 백그라운드/종료 상태 메시지 → 화면 이동
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);

    // 7. 앱 종료 상태에서 알림 탭으로 시작된 경우
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessageTap(initialMessage);
    }
  }

  /// FCM 토큰을 Firebase DB에 저장
  /// 경로: /drivers/{id}/fcmToken
  Future<void> _saveToken(String driverId, String token) async {
    await FirebaseDatabase.instance
        .ref('drivers/$driverId/fcmToken')
        .set(token);
  }

  /// 로컬 알림 플러그인 초기화
  Future<void> _initLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false, // FCM에서 이미 요청
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: (response) {
        // 로컬 알림 탭 → 주문 상세 화면으로 이동
        final orderId = response.payload;
        if (orderId != null) {
          _navigateToOrder(orderId);
        }
      },
    );
  }

  /// Foreground에서 받은 FCM 메시지 → 로컬 알림으로 표시
  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    await _localNotifications.show(
      message.hashCode,
      notification.title ?? '메이대구',
      notification.body ?? '',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'delivery_channel',
          '배송 알림',
          channelDescription: '신규 배차 및 배송 관련 알림',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: message.data['orderId'],
    );
  }

  /// 알림 탭 → 주문 상세 화면 딥링크
  void _handleMessageTap(RemoteMessage message) {
    final orderId = message.data['orderId'];
    if (orderId != null) {
      _navigateToOrder(orderId);
    }
  }

  /// 주문 상세 화면으로 이동 (go_router 사용)
  void _navigateToOrder(String orderId) {
    // 전역 라우터 또는 NavigatorKey를 통해 이동
    // GoRouter.of(context).push('/order/$orderId');
    // 실제 구현 시 GlobalKey<NavigatorState> 또는 rootNavigatorKey 사용
  }
}
```

### 5.5 Cloud Functions 트리거: 배차 시 기사에게 푸시

```js
// functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onOrderAssigned = functions.database
  .ref('/orders/{orderId}/assignedDriverId')
  .onWrite(async (change, context) => {
    const newDriverId = change.after.val();

    // 새로운 배정이 아니면 무시
    if (!newDriverId || newDriverId === change.before.val()) return;

    // 기사 정보 조회
    const driverSnap = await admin.database()
      .ref(`drivers/${newDriverId}`).once('value');
    const driver = driverSnap.val();
    if (!driver || !driver.fcmToken) return;

    // 주문 정보 조회
    const orderSnap = await admin.database()
      .ref(`orders/${context.params.orderId}`).once('value');
    const order = orderSnap.val();

    // 푸시 알림 전송
    await admin.messaging().send({
      token: driver.fcmToken,
      notification: {
        title: '신규 배차',
        body: `${order.recipientName}님 (${order.deliveryAddress})`,
      },
      data: {
        orderId: context.params.orderId,
        type: 'new_assignment',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'delivery_channel',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
  });
```

### 5.6 로컬 알림 fallback

FCM이 도달하지 않는 경우(네트워크 불안정 등)에 대비하여, 앱 내 Firebase Realtime DB 리스너로 신규 배차를 감지하고 로컬 알림을 표시합니다.

```dart
// lib/services/local_assignment_watcher.dart

class LocalAssignmentWatcher {
  StreamSubscription? _subscription;

  void start(String driverId) {
    final ref = FirebaseDatabase.instance
        .ref('orders')
        .orderByChild('assignedDriverId')
        .equalTo(driverId);

    _subscription = ref.onChildAdded.listen((event) {
      final order = event.snapshot.value as Map?;
      if (order == null) return;

      // 최근 30초 이내 배정된 주문만 알림
      final assignedAt = DateTime.tryParse(order['assignedAt'] ?? '');
      if (assignedAt != null &&
          DateTime.now().difference(assignedAt).inSeconds < 30) {
        _showLocalNotification(
          title: '신규 배차',
          body: '${order['recipientName']}님 (${order['deliveryAddress']})',
          orderId: event.snapshot.key!,
        );
      }
    });
  }

  void stop() {
    _subscription?.cancel();
    _subscription = null;
  }

  Future<void> _showLocalNotification({
    required String title,
    required String body,
    required String orderId,
  }) async {
    final plugin = FlutterLocalNotificationsPlugin();
    await plugin.show(
      orderId.hashCode,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'delivery_channel', '배송 알림',
          importance: Importance.high,
        ),
      ),
      payload: orderId,
    );
  }
}
```

---

## 6. 플랫폼별 권한 설정

### 6.1 Android (AndroidManifest.xml)

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- 카메라 -->
    <uses-permission android:name="android.permission.CAMERA"/>

    <!-- GPS 위치 -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>

    <!-- 백그라운드 위치 (Android 10+) -->
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>

    <!-- 네트워크 -->
    <uses-permission android:name="android.permission.INTERNET"/>

    <!-- 푸시 알림 (Android 13+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

    <!-- Foreground Service (백그라운드 위치 추적용) -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION"/>

    <application
        android:label="메이대구"
        ...>

        <!-- FCM 기본 알림 채널 -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="delivery_channel"/>

        ...
    </application>
</manifest>
```

### 6.2 iOS (Info.plist)

```xml
<!-- ios/Runner/Info.plist -->
<dict>
    <!-- 카메라 사용 설명 -->
    <key>NSCameraUsageDescription</key>
    <string>배송 완료 사진 촬영을 위해 카메라에 접근합니다.</string>

    <!-- 사진 라이브러리 (선택적, 갤러리에서 선택 시) -->
    <key>NSPhotoLibraryUsageDescription</key>
    <string>배송 완료 사진을 선택하기 위해 사진 라이브러리에 접근합니다.</string>

    <!-- 위치 - 사용 중 -->
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>배송 상태 자동 업데이트를 위해 위치를 사용합니다.</string>

    <!-- 위치 - 항상 (백그라운드) -->
    <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
    <string>배송 완료 후 회사 복귀를 자동 감지하기 위해 백그라운드에서도 위치를 사용합니다.</string>

    <!-- 백그라운드 모드 -->
    <key>UIBackgroundModes</key>
    <array>
        <string>location</string>
        <string>remote-notification</string>
        <string>fetch</string>
    </array>
</dict>
```

**iOS 심사 참고:** `NSLocationAlwaysAndWhenInUseUsageDescription`은 App Store 심사에서 까다롭게 검토됩니다. "배송 기사가 회사 반경 100m 진입 시 업무 상태를 자동 전환하기 위한 용도"임을 구체적으로 명시하세요.

---

## 7. Web에서의 제약

Flutter Web에서도 기사 역할로 로그인할 수 있지만, 네이티브 기능에 제한이 있습니다.

### 7.1 기능별 Web 지원 현황

| 기능 | Web 지원 | 제약 |
|------|:--------:|------|
| GPS (foreground) | 지원 | 브라우저 위치 API 사용, 정확도 다소 낮음 |
| GPS (background) | **불가** | 탭이 비활성화되면 위치 추적 중단 |
| 카메라 촬영 | 부분 지원 | `image_picker_for_web` 사용, UX가 네이티브보다 열약 |
| FCM | 부분 지원 | Service Worker 기반, 브라우저 알림 허용 필요 |
| 파일 업로드 | 지원 | `putData(bytes)` 사용 (`File` 객체 불가) |

### 7.2 kIsWeb 분기 처리

```dart
import 'package:flutter/foundation.dart' show kIsWeb;

class PlatformAwareLocationService {
  Future<void> startTracking(String driverId) async {
    if (kIsWeb) {
      // Web: foreground에서만 위치 추적
      // navigator.geolocation.watchPosition() 기반
      _startWebTracking(driverId);
    } else {
      // Mobile: 네이티브 GPS + 백그라운드
      await BackgroundLocationService.configure(driverId);
      await BackgroundLocationService.start();
    }
  }

  void _startWebTracking(String driverId) {
    // Web에서는 Geolocator가 내부적으로 navigator.geolocation 사용
    // 하지만 백그라운드 추적은 불가하므로 경고 표시
    Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 100, // Web에서는 더 큰 필터
      ),
    ).listen((pos) async {
      await FirebaseDatabase.instance.ref('driverStatus/$driverId').update({
        'lat': pos.latitude,
        'lng': pos.longitude,
        'lastUpdate': DateTime.now().toIso8601String(),
      });
    });
  }
}
```

### 7.3 Web 카메라 (image_picker_for_web)

```yaml
# pubspec.yaml
dependencies:
  image_picker: ^1.0.7
  image_picker_for_web: ^3.0.0  # Web 지원용 (자동 연동)
```

Web에서 `ImagePicker.pickImage(source: ImageSource.camera)`를 호출하면 브라우저의 `<input type="file" capture="camera">`로 동작합니다. 모바일 브라우저에서는 카메라가 열리지만, 데스크톱 브라우저에서는 파일 선택 다이얼로그만 표시됩니다.

### 7.4 Web FCM (Service Worker)

```dart
// Web FCM은 Service Worker가 필요
// web/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '...',
  projectId: 'mayflower-5c9dd',
  messagingSenderId: '...',
  appId: '...',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((message) => {
  const notification = message.notification;
  if (!notification) return;
  return self.registration.showNotification(notification.title, {
    body: notification.body,
    data: message.data,
  });
});
```

---

## 8. 오프라인 대응

배송 기사는 지하 주차장, 엘리베이터, 음영 지역 등에서 인터넷 연결이 끊길 수 있습니다.

### 8.1 Firebase 오프라인 캐시

```dart
// lib/main.dart (앱 시작 시 한 번)

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // 오프라인 캐시 활성화
  FirebaseDatabase.instance.setPersistenceEnabled(true);

  // 캐시 크기 설정 (기본 10MB, 기사 앱은 충분)
  FirebaseDatabase.instance.setPersistenceCacheSizeBytes(10 * 1024 * 1024);

  runApp(const ProviderScope(child: MyApp()));
}
```

### 8.2 오프라인 동작 시나리오

| 상황 | 동작 |
|------|------|
| 주문 목록 조회 | 캐시된 데이터 표시 |
| "배송 출발" 터치 | 로컬에 대기열 저장, 온라인 복귀 시 자동 동기화 |
| 사진 업로드 | **실패** — 온라인 필요. 사용자에게 재시도 안내 |
| 위치 업데이트 | 로컬 저장, 온라인 복귀 시 마지막 위치만 전송 |

### 8.3 네트워크 상태 감지

```dart
import 'package:connectivity_plus/connectivity_plus.dart';

class NetworkService {
  Stream<bool> get isOnline =>
      Connectivity().onConnectivityChanged.map(
        (results) => results.any((r) => r != ConnectivityResult.none),
      );
}

// UI에서 사용
StreamBuilder<bool>(
  stream: NetworkService().isOnline,
  builder: (context, snapshot) {
    final online = snapshot.data ?? true;
    if (!online) {
      return const MaterialBanner(
        content: Text('인터넷 연결이 끊겼습니다. 일부 기능이 제한됩니다.'),
        actions: [SizedBox.shrink()],
        backgroundColor: Color(0xFFFEF3C7),
      );
    }
    return const SizedBox.shrink();
  },
)
```

---

## 9. 전체 아키텍처 요약

```
┌─────────────────────────────────────────────────────────────┐
│                    Flutter App (단일 코드베이스)                │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │ Web (Desktop)  │  │ Android App   │  │    iOS App       │ │
│  │ floor2/floor1  │  │   driver      │  │    driver        │ │
│  │ admin          │  │ (GPS/Camera/  │  │ (GPS/Camera/     │ │
│  │ (driver 제한적) │  │  Push)        │  │  Push)           │ │
│  └───────┬───────┘  └───────┬───────┘  └───────┬─────────┘ │
│          │                  │                   │           │
│          └──────────────────┼───────────────────┘           │
│                             │                               │
│  ┌──────────────────────────┴────────────────────────────┐  │
│  │              공유 레이어 (Dart)                          │  │
│  │  models/ | services/ | providers/ | widgets/           │  │
│  │  Order, ChatMessage, OrderService, ChatService, etc.  │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │                                  │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │           플랫폼 분기 (kIsWeb)                          │  │
│  │  LocationService | PhotoService | NotificationService │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │     Firebase (mayflower-5c9dd) │
              │  Realtime DB | Storage | Auth  │
              │  Cloud Functions (FCM 트리거)   │
              └───────────────────────────────┘
```

---

## 10. 개발 체크리스트

### Phase 1 — 기본 권한 & GPS (1~2주)
- [ ] `geolocator`, `permission_handler` 패키지 추가
- [ ] Android/iOS 권한 설정 (Manifest, Info.plist)
- [ ] `PermissionService` — 위치 권한 요청 플로우
- [ ] `LocationService` — foreground 위치 업데이트
- [ ] 회사 100m 진입 감지 로직

### Phase 2 — 카메라 & 사진 (1주)
- [ ] `image_picker` 패키지 추가
- [ ] `DeliveryPhotoService` — 촬영 + 업로드 + 상태 변경
- [ ] 업로드 진행률 UI
- [ ] `kIsWeb` 분기 (Web: `putData`, Mobile: `putFile`)

### Phase 3 — 푸시 알림 (1~2주)
- [ ] `firebase_messaging` 패키지 추가
- [ ] Android 알림 채널 설정
- [ ] iOS APNs 키 등록
- [ ] `NotificationService` — FCM 초기화, 토큰 저장
- [ ] Cloud Functions — 배차 시 푸시 트리거
- [ ] `flutter_local_notifications` — foreground 알림
- [ ] 알림 탭 → 주문 상세 딥링크

### Phase 4 — 백그라운드 위치 (2주, 난이도 높음)
- [ ] `flutter_background_geolocation` 패키지 추가
- [ ] Geofence 설정 (회사 100m)
- [ ] Android Foreground Service 설정
- [ ] iOS Background Location 설정
- [ ] 배터리 최적화 예외 요청
- [ ] 실기기 테스트 (Android + iOS 각각)

### Phase 5 — Web 대응 & 오프라인 (1주)
- [ ] `kIsWeb` 분기 전체 점검
- [ ] Web Service Worker (FCM)
- [ ] `setPersistenceEnabled(true)` 설정
- [ ] `connectivity_plus` — 네트워크 상태 배너
- [ ] 오프라인 시 사용자 안내 UI

---

## 11. 주의사항

1. **배터리 소모**: GPS를 과도하게 사용하면 기사 휴대폰이 하루를 버티지 못합니다. `distanceFilter: 50`은 필수이고, 대기 상태에서는 5분 간격으로 줄이세요.

2. **iOS 백그라운드 위치 심사**: Apple은 백그라운드 위치 사용에 매우 엄격합니다. 심사 제출 시 "배송 업무 완료 후 회사 반경 100m 진입 시 자동 상태 전환"이라는 구체적 사유를 명시해야 합니다.

3. **Android 12+ 정확한 알림 권한**: Android 13부터 `POST_NOTIFICATIONS` 권한을 런타임에 요청해야 합니다. 앱 최초 실행 시 요청하되, 강제하지 마세요.

4. **FCM 토큰 갱신**: 토큰은 앱 재설치, 데이터 삭제, 장기 미사용 시 변경됩니다. `onTokenRefresh` 리스너를 반드시 등록하세요.

5. **사진 업로드 실패 대응**: 네트워크 불안정 시 업로드가 실패할 수 있습니다. 재시도 버튼을 제공하고, 촬영한 사진을 임시 저장하여 재시도 시 다시 촬영하지 않아도 되게 하세요.

6. **오프라인 쓰기 충돌**: Firebase Realtime DB의 오프라인 쓰기는 "마지막 쓰기 우선(last-write-wins)" 정책입니다. 여러 기기에서 동시에 같은 주문을 수정하면 충돌이 발생할 수 있으므로, 기사는 자기 주문만 수정할 수 있도록 보안 규칙으로 제한하세요.

---

이전 문서:
- [10-order-workflow.md](./10-order-workflow.md) — 주문 워크플로 구현
- [11-realtime-chat.md](./11-realtime-chat.md) — 실시간 채팅 구현

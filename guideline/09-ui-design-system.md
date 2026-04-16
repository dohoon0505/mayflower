# 09. UI 디자인 시스템 및 반응형 레이아웃

> **대상 독자:** Flutter 통합 앱을 개발하는 프론트엔드/모바일 개발자
> **목표:** 현재 CSS 디자인 시스템을 Flutter ThemeData로 완전히 이식하고, Desktop/Tablet/Mobile 반응형 레이아웃을 구현

---

## 1. 현재 CSS 변수 → Flutter 색상 매핑

현재 Vanilla JS 프로젝트의 `css/base.css`에 정의된 CSS 변수를 Flutter `Color` 상수로 1:1 매핑합니다.

```dart
// lib/theme/app_colors.dart

import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ── Brand ──
  static const primary      = Color(0xFF6366F1);   // indigo — Flutter 통합 테마
  static const primaryHover  = Color(0xFF4F46E5);
  static const primaryLight  = Color(0xFF818CF8);
  static const primaryDim    = Color(0x146366F1);   // 8% opacity

  // ── Background ──
  static const bgBase        = Color(0xFFF1F5F9);
  static const bgSurface     = Color(0xFFFFFFFF);
  static const bgElevated    = Color(0xFFF8FAFC);
  static const bgCard        = Color(0xFFFFFFFF);
  static const bgInput       = Color(0xFFFFFFFF);

  // ── Text ──
  static const textPrimary   = Color(0xFF1E293B);
  static const textSecondary = Color(0xFF475569);
  static const textMuted     = Color(0xFF94A3B8);

  // ── Border ──
  static const border        = Color(0xFFE2E8F0);
  static const borderStrong  = Color(0xFFCBD5E1);

  // ── Semantic ──
  static const success       = Color(0xFF22C55E);
  static const warning       = Color(0xFFF59E0B);
  static const danger        = Color(0xFFEF4444);
  static const info          = Color(0xFF3B82F6);

  // ── Status Badge 배경/전경 ──
  static const s0Bg = Color(0xFFF1F5F9); static const s0Fg = Color(0xFF475569);
  static const s1Bg = Color(0xFFEFF6FF); static const s1Fg = Color(0xFF2563EB);
  static const s2Bg = Color(0xFFF5F3FF); static const s2Fg = Color(0xFF7C3AED);
  static const s3Bg = Color(0xFFFFFBEB); static const s3Fg = Color(0xFFD97706);
  static const s4Bg = Color(0xFFF0FDF4); static const s4Fg = Color(0xFF16A34A);
  static const s5Bg = Color(0xFFFEF2F2); static const s5Fg = Color(0xFFDC2626);
  static const s6Bg = Color(0xFFFFF7ED); static const s6Fg = Color(0xFFEA580C);
}
```

---

## 2. ThemeData 정의

### 2.1 Light Theme

```dart
// lib/theme/app_theme.dart

import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_typography.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,

    // ── Color Scheme ──
    colorScheme: const ColorScheme.light(
      primary:      AppColors.primary,
      onPrimary:    Colors.white,
      secondary:    AppColors.primaryLight,
      surface:      AppColors.bgSurface,
      onSurface:    AppColors.textPrimary,
      error:        AppColors.danger,
      onError:      Colors.white,
      outline:      AppColors.border,
    ),

    // ── Scaffold ──
    scaffoldBackgroundColor: AppColors.bgBase,

    // ── AppBar ──
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bgSurface,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 1,
      surfaceTintColor: Colors.transparent,
    ),

    // ── Card ──
    cardTheme: CardThemeData(
      color: AppColors.bgCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
    ),

    // ── Input ──
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bgInput,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.danger),
      ),
      hintStyle: const TextStyle(color: AppColors.textMuted),
    ),

    // ── Elevated Button ──
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        elevation: 0,
        textStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    // ── Outlined Button ──
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        side: const BorderSide(color: AppColors.border),
        textStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    // ── Text Button ──
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primary,
        textStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    // ── Divider ──
    dividerTheme: const DividerThemeData(
      color: AppColors.border,
      thickness: 1,
      space: 1,
    ),

    // ── Chip ──
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.bgElevated,
      selectedColor: AppColors.primaryDim,
      labelStyle: const TextStyle(fontSize: 13),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: AppColors.border),
      ),
    ),

    // ── Dialog ──
    dialogTheme: DialogThemeData(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      backgroundColor: AppColors.bgSurface,
      surfaceTintColor: Colors.transparent,
    ),

    // ── SnackBar ──
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  );

  // ── Dark Theme (선택적) ──
  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.dark(
      primary:      AppColors.primaryLight,
      onPrimary:    Colors.white,
      secondary:    AppColors.primary,
      surface:      const Color(0xFF1E293B),
      onSurface:    const Color(0xFFE2E8F0),
      error:        AppColors.danger,
      onError:      Colors.white,
      outline:      const Color(0xFF334155),
    ),
    scaffoldBackgroundColor: const Color(0xFF0F172A),
    // 나머지 dark theme 속성은 light와 동일 구조로 어두운 색상 적용
  );
}
```

---

## 3. 폰트 설정

### 3.1 Google Fonts 사용 (권장)

현재 웹은 **Pretendard** 폰트를 사용합니다. Flutter에서는 `google_fonts` 패키지 또는 로컬 폰트 파일로 적용합니다.

```yaml
# pubspec.yaml
dependencies:
  google_fonts: ^6.1.0
```

```dart
// lib/theme/app_typography.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTypography {
  AppTypography._();

  static TextTheme get textTheme => GoogleFonts.notoSansKrTextTheme(
    const TextTheme(
      headlineLarge:  TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
      headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
      headlineSmall:  TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
      titleLarge:     TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
      titleMedium:    TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      titleSmall:     TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      bodyLarge:      TextStyle(fontSize: 16, fontWeight: FontWeight.w400),
      bodyMedium:     TextStyle(fontSize: 14, fontWeight: FontWeight.w400),
      bodySmall:      TextStyle(fontSize: 12, fontWeight: FontWeight.w400),
      labelLarge:     TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
      labelMedium:    TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
      labelSmall:     TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
    ),
  );
}
```

### 3.2 시스템 폰트 사용 (대안)

Google Fonts 대신 시스템 폰트를 쓰려면 ThemeData에서 `fontFamily`를 지정하지 않으면 됩니다. 한글은 기기에 내장된 기본 폰트가 렌더링합니다.

---

## 4. 간격 & 패딩 규칙 (8px Grid)

모든 간격은 **8의 배수**를 기본으로 합니다.

```dart
// lib/theme/app_spacing.dart

class AppSpacing {
  AppSpacing._();

  static const double xs  = 4;    // 8 / 2
  static const double sm  = 8;    // 8 * 1
  static const double md  = 16;   // 8 * 2
  static const double lg  = 24;   // 8 * 3
  static const double xl  = 32;   // 8 * 4
  static const double xxl = 48;   // 8 * 6

  // 페이지 패딩
  static const pagePadding = EdgeInsets.all(24);
  static const cardPadding = EdgeInsets.all(16);
  static const inputPadding = EdgeInsets.symmetric(horizontal: 16, vertical: 12);
}
```

### Border Radius 규칙

```dart
class AppRadius {
  AppRadius._();

  static const double sm = 8;
  static const double md = 12;   // 기본 (카드, 버튼, 인풋)
  static const double lg = 16;   // 모달, 다이얼로그
  static const double xl = 24;   // 바텀시트
  static const double full = 9999; // 원형 (뱃지, 아바타)
}
```

---

## 5. 공통 위젯 카탈로그

### 5.1 AppButton

```dart
// lib/widgets/app_button.dart

enum AppButtonVariant { primary, outline, danger, success, ghost }
enum AppButtonSize { sm, md, lg }

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final IconData? icon;
  final bool isLoading;

  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.md,
    this.icon,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final padding = switch (size) {
      AppButtonSize.sm => const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      AppButtonSize.md => const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      AppButtonSize.lg => const EdgeInsets.symmetric(horizontal: 32, vertical: 18),
    };

    final fontSize = switch (size) {
      AppButtonSize.sm => 12.0,
      AppButtonSize.md => 14.0,
      AppButtonSize.lg => 16.0,
    };

    final (bgColor, fgColor, borderColor) = switch (variant) {
      AppButtonVariant.primary => (AppColors.primary, Colors.white, AppColors.primary),
      AppButtonVariant.outline => (Colors.transparent, AppColors.primary, AppColors.border),
      AppButtonVariant.danger  => (AppColors.danger, Colors.white, AppColors.danger),
      AppButtonVariant.success => (AppColors.success, Colors.white, AppColors.success),
      AppButtonVariant.ghost   => (Colors.transparent, AppColors.textSecondary, Colors.transparent),
    };

    final child = isLoading
        ? SizedBox(
            width: fontSize + 2,
            height: fontSize + 2,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: fgColor,
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: fontSize + 4),
                const SizedBox(width: 8),
              ],
              Text(label, style: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w600,
              )),
            ],
          );

    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: bgColor,
        foregroundColor: fgColor,
        padding: padding,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: borderColor),
        ),
      ),
      child: child,
    );
  }
}
```

사용 예시:

```dart
AppButton(
  label: '배송 출발',
  variant: AppButtonVariant.primary,
  icon: Icons.local_shipping,
  onPressed: () => onDepart(orderId),
)

AppButton(
  label: '주문 취소',
  variant: AppButtonVariant.danger,
  size: AppButtonSize.sm,
  onPressed: () => onCancel(orderId),
)
```

### 5.2 AppModal

```dart
// lib/widgets/app_modal.dart

class AppModal {
  /// 확인/취소 다이얼로그
  static Future<bool?> confirm(
    BuildContext context, {
    required String title,
    required String message,
    String confirmText = '확인',
    String cancelText = '취소',
    bool isDanger = false,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(cancelText),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: isDanger ? AppColors.danger : AppColors.primary,
            ),
            child: Text(confirmText),
          ),
        ],
      ),
    );
  }

  /// 텍스트 입력 다이얼로그
  static Future<String?> input(
    BuildContext context, {
    required String title,
    String? hint,
    String? initialValue,
    String confirmText = '확인',
  }) {
    final controller = TextEditingController(text: initialValue);
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(hintText: hint),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: Text(confirmText),
          ),
        ],
      ),
    );
  }

  /// 알림 다이얼로그
  static Future<void> alert(
    BuildContext context, {
    required String title,
    required String message,
  }) {
    return showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('확인'),
          ),
        ],
      ),
    );
  }
}
```

사용 예시:

```dart
final confirmed = await AppModal.confirm(
  context,
  title: '주문 취소',
  message: '정말 이 주문을 취소하시겠습니까?',
  isDanger: true,
);
if (confirmed == true) {
  await cancelOrder(orderId);
}
```

### 5.3 AppToast

SnackBar 기반의 토스트 메시지 유틸리티입니다.

```dart
// lib/widgets/app_toast.dart

enum ToastType { success, error, warning, info }

class AppToast {
  static void show(
    BuildContext context, {
    required String message,
    ToastType type = ToastType.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    final (bgColor, icon) = switch (type) {
      ToastType.success => (AppColors.success, Icons.check_circle),
      ToastType.error   => (AppColors.danger,  Icons.error),
      ToastType.warning => (AppColors.warning, Icons.warning_amber),
      ToastType.info    => (AppColors.info,    Icons.info),
    };

    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(message,
                    style: const TextStyle(color: Colors.white)),
              ),
            ],
          ),
          backgroundColor: bgColor,
          duration: duration,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
  }

  // 편의 메서드
  static void success(BuildContext context, String message) =>
      show(context, message: message, type: ToastType.success);

  static void error(BuildContext context, String message) =>
      show(context, message: message, type: ToastType.error);

  static void warning(BuildContext context, String message) =>
      show(context, message: message, type: ToastType.warning);

  static void info(BuildContext context, String message) =>
      show(context, message: message, type: ToastType.info);
}
```

사용 예시:

```dart
AppToast.success(context, '주문이 등록되었습니다');
AppToast.error(context, '저장에 실패했습니다');
```

### 5.4 BadgeWidget — 배송 기사 뱃지

현재 웹의 DeliveryPanel에서 사용하는 기사 상태 뱃지를 Flutter로 이식합니다.

```dart
// lib/widgets/badge_widget.dart

enum DriverBadgeType { waiting, assigned, delivering, returning, dayoff }

class BadgeWidget extends StatelessWidget {
  final DriverBadgeType type;

  const BadgeWidget({super.key, required this.type});

  @override
  Widget build(BuildContext context) {
    final (label, bgColor, fgColor, iconData) = switch (type) {
      DriverBadgeType.waiting    => ('배송대기', const Color(0xFFDCFCE7), AppColors.success,  Icons.hourglass_empty),
      DriverBadgeType.assigned   => ('배차완료', const Color(0xFFDBEAFE), AppColors.info,     Icons.assignment_turned_in),
      DriverBadgeType.delivering => ('배송중',   const Color(0xFFFEF3C7), AppColors.warning,  Icons.local_shipping),
      DriverBadgeType.returning  => ('복귀중',   const Color(0xFFF3E8FF), const Color(0xFF7C3AED), Icons.home),
      DriverBadgeType.dayoff     => ('휴무',     const Color(0xFFF1F5F9), AppColors.textMuted, Icons.event_busy),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(iconData, size: 14, color: fgColor),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: fgColor,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
```

### 5.5 OrderCard

```dart
// lib/widgets/order_card.dart

class OrderCard extends StatelessWidget {
  final Order order;
  final VoidCallback? onTap;

  const OrderCard({super.key, required this.order, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Padding(
          padding: AppSpacing.cardPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 상단: 체인명 + 상태 뱃지
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    order.chainName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  _StatusChip(status: order.status),
                ],
              ),
              const SizedBox(height: 8),

              // 상품명
              Text(
                order.productName,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 4),

              // 배송지 + 받는분
              Row(
                children: [
                  const Icon(Icons.place, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      '${order.deliveryAddress} · ${order.recipientName}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textMuted,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // 하단: 배송 일시 + 기사
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _formatDate(order.deliveryDatetime),
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                    ),
                  ),
                  if (order.assignedDriverName != null)
                    Text(
                      order.assignedDriverName!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.info,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final int status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (status) {
      0 => ('주문접수', AppColors.s0Bg, AppColors.s0Fg),
      1 => ('확인',     AppColors.s1Bg, AppColors.s1Fg),
      2 => ('제작중',   AppColors.s2Bg, AppColors.s2Fg),
      3 => ('배송중',   AppColors.s3Bg, AppColors.s3Fg),
      4 => ('배송완료', AppColors.s4Bg, AppColors.s4Fg),
      5 => ('취소',     AppColors.s5Bg, AppColors.s5Fg),
      6 => ('취소',     AppColors.s6Bg, AppColors.s6Fg),
      _ => ('알수없음', AppColors.s0Bg, AppColors.s0Fg),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.full),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
```

### 5.6 ChatBubble

```dart
// lib/widgets/chat_bubble.dart

class ChatBubble extends StatelessWidget {
  final ChatMessage message;
  final bool isMe;

  const ChatBubble({super.key, required this.message, required this.isMe});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 280),
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
        decoration: BoxDecoration(
          color: isMe ? AppColors.primary : AppColors.bgElevated,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMe ? 16 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 16),
          ),
          border: isMe ? null : Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isMe)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  message.senderName,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isMe ? Colors.white70 : AppColors.primary,
                  ),
                ),
              ),
            Text(
              message.text,
              style: TextStyle(
                fontSize: 14,
                color: isMe ? Colors.white : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _formatTime(message.timestamp),
              style: TextStyle(
                fontSize: 11,
                color: isMe ? Colors.white54 : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

### 5.7 LoadingOverlay / Shimmer

```dart
// lib/widgets/loading_overlay.dart

class LoadingOverlay extends StatelessWidget {
  final bool isLoading;
  final Widget child;
  final String? message;

  const LoadingOverlay({
    super.key,
    required this.isLoading,
    required this.child,
    this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        if (isLoading)
          Container(
            color: Colors.black26,
            child: Center(
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(),
                      if (message != null) ...[
                        const SizedBox(height: 16),
                        Text(message!),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// Shimmer 효과 (목록 로딩 시)
class ShimmerCard extends StatelessWidget {
  const ShimmerCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: AppSpacing.cardPadding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _shimmerBox(width: 120, height: 16),
            const SizedBox(height: 12),
            _shimmerBox(width: double.infinity, height: 14),
            const SizedBox(height: 8),
            _shimmerBox(width: 200, height: 13),
          ],
        ),
      ),
    );
  }

  Widget _shimmerBox({required double width, required double height}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.bgBase,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
```

> **참고:** 실제 shimmer 애니메이션이 필요하면 `shimmer` 패키지를 사용하세요.

---

## 6. 반응형 레이아웃 전략

### 6.1 ResponsiveBuilder 위젯

```dart
// lib/widgets/responsive_builder.dart

class ResponsiveBuilder extends StatelessWidget {
  final Widget Function(BuildContext context) desktop;
  final Widget Function(BuildContext context)? tablet;
  final Widget Function(BuildContext context) mobile;

  const ResponsiveBuilder({
    super.key,
    required this.desktop,
    this.tablet,
    required this.mobile,
  });

  /// 브레이크포인트
  static const double desktopBreakpoint = 1200;
  static const double tabletBreakpoint = 600;

  /// 현재 디바이스 유형 판별
  static bool isDesktop(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= desktopBreakpoint;
  static bool isTablet(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= tabletBreakpoint &&
      MediaQuery.sizeOf(context).width < desktopBreakpoint;
  static bool isMobile(BuildContext context) =>
      MediaQuery.sizeOf(context).width < tabletBreakpoint;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (ctx, constraints) {
        if (constraints.maxWidth >= desktopBreakpoint) {
          return desktop(ctx);
        }
        if (constraints.maxWidth >= tabletBreakpoint) {
          return (tablet ?? mobile)(ctx);
        }
        return mobile(ctx);
      },
    );
  }
}
```

### 6.2 브레이크포인트별 레이아웃

#### Desktop (1200px 이상) — 4열 그리드

현재 웹의 `grid-template-columns: var(--sidebar-w) 1fr 360px 500px`와 동일한 구조입니다.

```
┌────────┬──────────────────┬──────────┬────────────┐
│        │                  │          │            │
│ Sidebar│   Main Content   │ Delivery │   Chat     │
│ (~200) │     (1fr)        │  Panel   │  Panel     │
│        │                  │  (360)   │  (500)     │
│        │                  │          │            │
└────────┴──────────────────┴──────────┴────────────┘
```

```dart
// Desktop ShellScreen body
Row(
  children: [
    const SizedBox(width: 200, child: AppSidebar()),
    Expanded(child: mainContent),
    if (showDeliveryPanel)
      const SizedBox(width: 360, child: DeliveryPanel()),
    const SizedBox(width: 500, child: ChatPanel()),
  ],
)
```

#### Tablet (600~1199px) — 2열 + Drawer

```
┌──────────────────┬────────────┐
│                  │            │
│   Main Content   │   Chat     │
│     (1fr)        │  Panel     │
│                  │  (360)     │
│                  │            │
├──────────────────┴────────────┤
│          Bottom Tab           │
└───────────────────────────────┘
  + Drawer (사이드바)
  + DeliveryPanel은 Bottom Sheet로
```

#### Mobile (600px 미만) — 1열 + Drawer + BottomNav

```
┌──────────────────────────┐
│  AppBar (햄버거 메뉴)       │
├──────────────────────────┤
│                          │
│     Main Content         │
│      (전체 폭)             │
│                          │
├──────────────────────────┤
│    BottomNavigationBar   │
└──────────────────────────┘
  + NavigationDrawer (사이드바)
  + Chat → FloatingActionButton 탭 시 오버레이
  + DeliveryPanel → 별도 탭 또는 Bottom Sheet
```

### 6.3 BottomNavigationBar (모바일용)

```dart
// lib/widgets/app_bottom_nav.dart

class AppBottomNav extends ConsumerWidget {
  final String role;
  const AppBottomNav({super.key, required this.role});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final destinations = switch (role) {
      'floor2' => const [
        NavigationDestination(icon: Icon(Icons.list_alt), label: '내 주문'),
        NavigationDestination(icon: Icon(Icons.add_circle_outline), label: '신규 접수'),
        NavigationDestination(icon: Icon(Icons.chat), label: '채팅'),
      ],
      'floor1' => const [
        NavigationDestination(icon: Icon(Icons.list_alt), label: '전체 주문'),
        NavigationDestination(icon: Icon(Icons.chat), label: '채팅'),
      ],
      'driver' => const [
        NavigationDestination(icon: Icon(Icons.local_shipping), label: '내 배송'),
        NavigationDestination(icon: Icon(Icons.chat), label: '채팅'),
      ],
      'admin' => const [
        NavigationDestination(icon: Icon(Icons.list_alt), label: '주문'),
        NavigationDestination(icon: Icon(Icons.people), label: '기사'),
        NavigationDestination(icon: Icon(Icons.inventory_2), label: '상품'),
        NavigationDestination(icon: Icon(Icons.bar_chart), label: '통계'),
      ],
      _ => const <NavigationDestination>[],
    };

    return NavigationBar(
      selectedIndex: _currentIndex(context, role),
      onDestinationSelected: (i) => _onTap(context, role, i),
      destinations: destinations,
    );
  }
}
```

---

## 7. ShellScreen 구현 가이드 종합

```dart
// lib/router/shell_screen.dart

class ShellScreen extends ConsumerWidget {
  final Widget child;
  const ShellScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authProvider);
    if (session == null) return const SizedBox.shrink();

    final isAdmin = session.role == 'admin';

    return ResponsiveBuilder(
      desktop: (ctx) => _desktopLayout(ctx, session, isAdmin),
      tablet: (ctx) => _tabletLayout(ctx, session, isAdmin),
      mobile: (ctx) => _mobileLayout(ctx, session, isAdmin),
    );
  }

  Widget _desktopLayout(
      BuildContext context, UserSession session, bool isAdmin) {
    return Scaffold(
      body: Row(
        children: [
          SizedBox(
            width: 200,
            child: AppSidebar(role: session.role),
          ),
          Expanded(child: child),
          if (isAdmin)
            const SizedBox(width: 360, child: DeliveryPanel()),
          const SizedBox(width: 500, child: ChatPanel()),
        ],
      ),
    );
  }

  Widget _tabletLayout(
      BuildContext context, UserSession session, bool isAdmin) {
    return Scaffold(
      appBar: AppBar(title: Text(_pageTitle(context))),
      drawer: AppSidebar(role: session.role),
      body: Row(
        children: [
          Expanded(child: child),
          const SizedBox(width: 360, child: ChatPanel()),
        ],
      ),
    );
  }

  Widget _mobileLayout(
      BuildContext context, UserSession session, bool isAdmin) {
    return Scaffold(
      appBar: AppBar(title: Text(_pageTitle(context))),
      drawer: AppSidebar(role: session.role),
      body: child,
      bottomNavigationBar: AppBottomNav(role: session.role),
    );
  }

  String _pageTitle(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    return switch (location) {
      '/floor2/my-orders'     => '내 주문',
      '/floor2/new-order'     => '신규 접수',
      '/floor1/all-orders'    => '전체 주문',
      '/driver/my-deliveries' => '내 배송',
      '/admin/all-orders'     => '전체 주문',
      '/admin/products'       => '상품 관리',
      '/admin/categories'     => '카테고리 관리',
      '/admin/drivers'        => '기사 관리',
      '/admin/statistics'     => '통계',
      _                       => '메이대구',
    };
  }
}
```

---

## 8. 아이콘 전략

### 8.1 기본: Material Icons

Flutter에 내장된 `Icons` 클래스를 기본으로 사용합니다.

```dart
Icons.list_alt           // 주문 목록
Icons.add_circle_outline // 신규 등록
Icons.local_shipping     // 배송
Icons.people             // 기사 관리
Icons.inventory_2        // 상품
Icons.category           // 카테고리
Icons.bar_chart          // 통계
Icons.chat               // 채팅
Icons.camera_alt         // 사진 촬영
Icons.place              // 배송지
Icons.phone              // 전화
Icons.logout             // 로그아웃
```

### 8.2 선택: lucide_icons (웹과 일관성)

현재 웹에서 Lucide 아이콘을 사용한다면, Flutter에서도 동일한 아이콘을 사용할 수 있습니다.

```yaml
# pubspec.yaml
dependencies:
  lucide_icons: ^0.257.0
```

```dart
import 'package:lucide_icons/lucide_icons.dart';

LucideIcons.truck       // 배송
LucideIcons.package     // 상품
LucideIcons.barChart2   // 통계
```

### 8.3 iOS 스타일 (선택)

CupertinoIcons는 iOS 기본 앱과 일관된 느낌을 줍니다. iOS 전용 화면에서만 사용을 고려하세요.

---

## 9. 애니메이션 가이드

### 9.1 AnimatedContainer — 상태 변화 표시

```dart
AnimatedContainer(
  duration: const Duration(milliseconds: 300),
  curve: Curves.easeInOut,
  padding: isExpanded
      ? const EdgeInsets.all(24)
      : const EdgeInsets.all(16),
  decoration: BoxDecoration(
    color: isSelected ? AppColors.primaryDim : AppColors.bgCard,
    borderRadius: BorderRadius.circular(AppRadius.md),
    border: Border.all(
      color: isSelected ? AppColors.primary : AppColors.border,
    ),
  ),
  child: content,
)
```

### 9.2 Hero — 주문 목록 → 상세 전환

```dart
// 목록에서
Hero(
  tag: 'order-${order.id}',
  child: OrderCard(order: order),
)

// 상세 화면에서
Hero(
  tag: 'order-${order.id}',
  child: OrderDetailHeader(order: order),
)
```

### 9.3 권장 애니메이션 시간

| 용도 | Duration | Curve |
|------|----------|-------|
| 색상/크기 변화 | 200~300ms | `easeInOut` |
| 화면 전환 | 300~400ms | `easeInOut` |
| 리스트 항목 추가 | 200ms | `easeOut` |
| 모달 열기 | 250ms | `easeOutCubic` |
| 알림 토스트 | 150ms | `easeIn` |

### 9.4 불필요한 애니메이션 금지

- **실시간 데이터 업데이트 시 전체 목록 애니메이션은 피하세요.** Firebase에서 주문이 실시간으로 들어올 때마다 화면 전체가 흔들리면 사용자 경험이 나빠집니다.
- 개별 항목의 상태 변화(뱃지 색상 등)만 `AnimatedContainer`로 처리하세요.

---

## 10. 폴더 구조 — UI 관련 파일 배치

```
lib/
├── theme/
│   ├── app_colors.dart          ← 색상 상수
│   ├── app_theme.dart           ← ThemeData (light/dark)
│   ├── app_typography.dart      ← 텍스트 스타일
│   ├── app_spacing.dart         ← 간격/패딩/radius 상수
│   └── app_shadows.dart         ← 그림자 스타일
├── widgets/
│   ├── app_button.dart
│   ├── app_modal.dart
│   ├── app_toast.dart
│   ├── badge_widget.dart
│   ├── order_card.dart
│   ├── chat_bubble.dart
│   ├── loading_overlay.dart
│   ├── responsive_builder.dart
│   ├── app_sidebar.dart
│   └── app_bottom_nav.dart
└── screens/
    ├── floor2/
    ├── floor1/
    ├── driver/
    └── admin/
```

---

## 11. 주의사항

1. **색상 하드코딩 금지.** 모든 색상은 `AppColors` 상수를 통해 참조하세요. 나중에 테마 변경 시 한 곳만 수정하면 됩니다.
2. **MediaQuery 남용 금지.** `ResponsiveBuilder`를 사용하세요. 개별 위젯에서 `MediaQuery.of(context).size`를 직접 호출하면 불필요한 리빌드가 발생합니다.
3. **`const` 키워드를 적극 활용하세요.** 변하지 않는 위젯에 `const`를 붙이면 리빌드 시 재생성되지 않아 성능이 좋아집니다.
4. **현재 CSS의 `--primary: #2563eb`(blue)에서 Flutter 통합 버전은 `#6366F1`(indigo)로 전환합니다.** 이는 의도적인 브랜드 업데이트입니다. 웹도 추후 동일 색상으로 맞출 예정입니다.
5. **Dark theme은 v1에서 구현하지 않아도 됩니다.** 단, ThemeData 구조를 처음부터 잡아두면 나중에 추가가 쉽습니다.

---

이전 문서:
- [07-state-management.md](./07-state-management.md) — 상태 관리
- [08-routing-navigation.md](./08-routing-navigation.md) — 라우팅 & 네비게이션

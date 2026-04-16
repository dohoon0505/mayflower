# 11. 실시간 채팅 구현 (Flutter 통합)

> **대상 독자:** Flutter 전환을 담당하는 풀스택 개발자
> **목표:** 기존 Vanilla JS 기반 Firebase 실시간 채팅을 Flutter 단일 코드베이스(Web + Android + iOS)로 재구현

---

## 1. 채팅 시스템 개요

메이대구의 채팅은 모든 역할(floor2, floor1, driver, admin)이 공유하는 **단일 채널** 실시간 메시지 시스템입니다. 주문 관련 소통, 업무 공유, 긴급 공지 등에 사용됩니다.

### 핵심 특징

- Firebase Realtime DB 기반 실시간 동기화
- 역할별 색상 뱃지로 발신자 구분
- "확인" 버튼으로 메시지 읽음 표시 (checkedBy 배열)
- 데스크톱: 우측 패널(500px), 모바일: 별도 화면 또는 BottomSheet

---

## 2. 채팅 데이터 모델

### ChatMessage 클래스

```dart
// lib/models/chat_message.dart

class ChatMessage {
  final String key;              // Firebase push key
  final String sender;           // 발신자 userId
  final String name;             // 발신자 이름 (displayName)
  final String role;             // 발신자 역할 (floor2, floor1, driver, admin)
  final String text;             // 메시지 본문
  final List<CheckRecord> checkedBy;  // 확인한 사람들
  final DateTime ts;             // 전송 시각

  const ChatMessage({
    required this.key,
    required this.sender,
    required this.name,
    required this.role,
    required this.text,
    required this.checkedBy,
    required this.ts,
  });

  factory ChatMessage.fromMap(String key, Map<dynamic, dynamic> m) {
    // checkedBy 배열 파싱
    final rawChecked = m['checkedBy'];
    final List<CheckRecord> checks;
    if (rawChecked is List) {
      checks = rawChecked
          .where((e) => e != null)
          .map((e) => CheckRecord.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList();
    } else if (rawChecked is Map) {
      checks = rawChecked.values
          .where((e) => e != null)
          .map((e) => CheckRecord.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList();
    } else {
      checks = [];
    }

    return ChatMessage(
      key: key,
      sender: m['sender']?.toString() ?? '',
      name: m['name']?.toString() ?? '익명',
      role: m['role']?.toString() ?? '',
      text: m['text']?.toString() ?? '',
      checkedBy: checks,
      ts: DateTime.parse(m['ts']?.toString() ?? DateTime.now().toIso8601String()),
    );
  }

  /// 내가 보낸 메시지인지 확인
  bool isMe(String myUserId) => sender == myUserId;

  /// 내가 이미 확인했는지 확인
  bool isCheckedBy(String userId) =>
      checkedBy.any((c) => c.userId == userId);
}
```

### CheckRecord 클래스

```dart
// lib/models/check_record.dart

class CheckRecord {
  final String userId;
  final String name;
  final String role;
  final DateTime ts;

  const CheckRecord({
    required this.userId,
    required this.name,
    required this.role,
    required this.ts,
  });

  factory CheckRecord.fromMap(Map<String, dynamic> m) => CheckRecord(
    userId: m['userId']?.toString() ?? '',
    name: m['name']?.toString() ?? '',
    role: m['role']?.toString() ?? '',
    ts: DateTime.parse(m['ts']?.toString() ?? DateTime.now().toIso8601String()),
  );

  Map<String, dynamic> toMap() => {
    'userId': userId,
    'name': name,
    'role': role,
    'ts': ts.toIso8601String(),
  };
}
```

---

## 3. Firebase 경로

```
/messages/{pushKey}
  ├── sender: "uid-abc123"
  ├── name: "2층 담당자"
  ├── role: "floor2"
  ├── text: "15번 주문 리본 문구 확인 부탁드립니다"
  ├── checkedBy:
  │   ├── 0: { userId: "uid-def456", name: "1층 담당자", role: "floor1", ts: "..." }
  │   └── 1: { userId: "uid-ghi789", name: "관리자", role: "admin", ts: "..." }
  └── ts: "2026-04-16T09:30:00.000Z"
```

---

## 4. ChatService 클래스

```dart
// lib/services/chat_service.dart

import 'package:firebase_database/firebase_database.dart';
import '../models/chat_message.dart';
import '../models/check_record.dart';

class ChatService {
  final _db = FirebaseDatabase.instance;
  final _messagesRef = FirebaseDatabase.instance.ref('messages');

  // ── 메시지 실시간 스트림 ────────────────────────────────────
  /// 최근 200개 메시지를 ts 순으로 실시간 수신
  Stream<List<ChatMessage>> get messagesStream {
    final query = _messagesRef
        .orderByChild('ts')
        .limitToLast(200);

    return query.onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) return <ChatMessage>[];

      final Map<dynamic, dynamic> map;
      if (data is Map) {
        map = data;
      } else {
        return <ChatMessage>[];
      }

      return map.entries
          .map((e) => ChatMessage.fromMap(
              e.key as String, e.value as Map<dynamic, dynamic>))
          .toList()
        ..sort((a, b) => a.ts.compareTo(b.ts));
    });
  }

  // ── 메시지 전송 ─────────────────────────────────────────────
  Future<void> sendMessage({
    required String sender,
    required String name,
    required String role,
    required String text,
  }) async {
    if (text.trim().isEmpty) return;

    await _messagesRef.push().set({
      'sender': sender,
      'name': name,
      'role': role,
      'text': text.trim(),
      'checkedBy': [],
      'ts': DateTime.now().toIso8601String(),
    });
  }

  // ── 메시지 확인 처리 ────────────────────────────────────────
  /// checkedBy 배열에 확인 기록 추가
  Future<bool> checkMessage({
    required String messageKey,
    required String userId,
    required String name,
    required String role,
  }) async {
    final ref = _messagesRef.child(messageKey).child('checkedBy');
    final snap = await ref.get();

    // 기존 checkedBy 배열 파싱
    List<Map<String, dynamic>> existing = [];
    if (snap.exists) {
      final raw = snap.value;
      if (raw is List) {
        existing = raw
            .where((e) => e != null)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } else if (raw is Map) {
        existing = raw.values
            .where((e) => e != null)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
    }

    // 이미 확인한 경우 중복 방지
    if (existing.any((c) => c['userId'] == userId)) {
      return false;
    }

    // 새 확인 기록 추가
    existing.add({
      'userId': userId,
      'name': name,
      'role': role,
      'ts': DateTime.now().toIso8601String(),
    });

    await ref.set(existing);
    return true;
  }
}
```

---

## 5. ChatProvider (Riverpod)

```dart
// lib/providers/chat_provider.dart

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/chat_message.dart';
import '../services/chat_service.dart';

// ChatService 싱글턴
final chatServiceProvider = Provider((ref) => ChatService());

// 실시간 메시지 리스트
final chatMessagesProvider = StreamProvider<List<ChatMessage>>((ref) {
  final chatService = ref.read(chatServiceProvider);
  return chatService.messagesStream;
});

// 읽지 않은 메시지 수 (선택 기능)
final unreadCountProvider = Provider<int>((ref) {
  final messages = ref.watch(chatMessagesProvider).valueOrNull ?? [];
  final session = ref.watch(authProvider).session;
  if (session == null) return 0;

  return messages.where((m) =>
    !m.isMe(session.userId) &&
    !m.isCheckedBy(session.userId)
  ).length;
});
```

---

## 6. ChatPanel 위젯 구현

### 6.1 메인 채팅 패널

```dart
// lib/widgets/chat/chat_panel.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/chat_message.dart';
import '../../providers/chat_provider.dart';
import '../../providers/auth_provider.dart';
import 'chat_message_bubble.dart';
import 'chat_input.dart';

class ChatPanel extends ConsumerStatefulWidget {
  const ChatPanel({super.key});

  @override
  ConsumerState<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends ConsumerState<ChatPanel> {
  final _scrollController = ScrollController();
  bool _shouldAutoScroll = true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// 사용자가 위로 스크롤하면 자동 스크롤 비활성화
  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.position.pixels;
    _shouldAutoScroll = (maxScroll - currentScroll) < 50;
  }

  /// 새 메시지 수신 시 자동 스크롤
  void _scrollToBottom() {
    if (!_shouldAutoScroll || !_scrollController.hasClients) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final asyncMessages = ref.watch(chatMessagesProvider);
    final session = ref.watch(authProvider).session;

    if (session == null) {
      return const Center(child: Text('로그인이 필요합니다'));
    }

    return Container(
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: Colors.grey[300]!)),
      ),
      child: Column(
        children: [
          // 헤더
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
            ),
            child: const Row(
              children: [
                Icon(Icons.chat_bubble_outline),
                SizedBox(width: 8),
                Text('채팅', style: TextStyle(
                  fontSize: 16, fontWeight: FontWeight.bold,
                )),
              ],
            ),
          ),

          // 메시지 리스트
          Expanded(
            child: asyncMessages.when(
              data: (messages) {
                _scrollToBottom();
                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 8,
                  ),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final msg = messages[index];
                    return ChatMessageBubble(
                      message: msg,
                      isMe: msg.isMe(session.userId),
                      myUserId: session.userId,
                      myName: session.displayName,
                      myRole: session.role,
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('채팅 로드 실패: $e')),
            ),
          ),

          // 입력 영역
          ChatInput(
            onSend: (text) {
              ref.read(chatServiceProvider).sendMessage(
                sender: session.userId,
                name: session.displayName,
                role: session.role,
                text: text,
              );
            },
          ),
        ],
      ),
    );
  }
}
```

### 6.2 메시지 버블 위젯

```dart
// lib/widgets/chat/chat_message_bubble.dart

import 'package:flutter/material.dart';
import '../../models/chat_message.dart';
import '../../providers/chat_provider.dart';

class ChatMessageBubble extends ConsumerWidget {
  final ChatMessage message;
  final bool isMe;
  final String myUserId;
  final String myName;
  final String myRole;

  const ChatMessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    required this.myUserId,
    required this.myName,
    required this.myRole,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment:
            isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          // 발신자 정보 (다른 사람 메시지만)
          if (!isMe) _buildSenderInfo(context),

          // 메시지 버블
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.7,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isMe
                  ? Theme.of(context).primaryColor
                  : Colors.grey[100],
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(12),
                topRight: const Radius.circular(12),
                bottomLeft: Radius.circular(isMe ? 12 : 4),
                bottomRight: Radius.circular(isMe ? 4 : 12),
              ),
            ),
            child: Text(
              message.text,
              style: TextStyle(
                color: isMe ? Colors.white : Colors.black87,
              ),
            ),
          ),

          const SizedBox(height: 4),

          // 하단: 시간 + 확인 버튼 + 확인 칩
          _buildFooter(context, ref),
        ],
      ),
    );
  }

  /// 발신자 이름 + 역할 뱃지
  Widget _buildSenderInfo(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 아바타
          CircleAvatar(
            radius: 14,
            backgroundColor: _roleColor(message.role),
            child: Text(
              _initials(message.name),
              style: const TextStyle(color: Colors.white, fontSize: 10),
            ),
          ),
          const SizedBox(width: 6),
          // 이름
          Text(message.name,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(width: 4),
          // 역할 뱃지
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: _roleColor(message.role),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              _roleLabel(message.role),
              style: const TextStyle(color: Colors.white, fontSize: 10),
            ),
          ),
        ],
      ),
    );
  }

  /// 시간 표시 + 확인 버튼 + 확인한 사람 칩
  Widget _buildFooter(BuildContext context, WidgetRef ref) {
    final alreadyChecked = message.isCheckedBy(myUserId);

    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
      children: [
        // 시간
        Text(
          _timeAgo(message.ts),
          style: TextStyle(fontSize: 10, color: Colors.grey[500]),
        ),

        // 확인 버튼 (다른 사람 메시지에만)
        if (!isMe) ...[
          const SizedBox(width: 8),
          InkWell(
            onTap: alreadyChecked
                ? null
                : () => ref.read(chatServiceProvider).checkMessage(
                      messageKey: message.key,
                      userId: myUserId,
                      name: myName,
                      role: myRole,
                    ),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: alreadyChecked ? Colors.green[50] : Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: alreadyChecked ? Colors.green : Colors.grey[300]!,
                ),
              ),
              child: Text(
                alreadyChecked ? '확인함' : '확인',
                style: TextStyle(
                  fontSize: 10,
                  color: alreadyChecked ? Colors.green : Colors.grey[600],
                ),
              ),
            ),
          ),
        ],

        // 확인한 사람 칩
        if (message.checkedBy.isNotEmpty) ...[
          const SizedBox(width: 6),
          ...message.checkedBy.map((c) => Padding(
            padding: const EdgeInsets.only(left: 2),
            child: Chip(
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
              labelPadding: const EdgeInsets.symmetric(horizontal: 2),
              label: Text(c.name,
                  style: const TextStyle(fontSize: 9)),
              avatar: const Icon(Icons.check, size: 10, color: Colors.green),
              backgroundColor: Colors.green[50],
            ),
          )),
        ],
      ],
    );
  }

  // ── 역할별 색상 ─────────────────────────────────────────────
  static Color _roleColor(String role) => switch (role) {
    'floor2' => const Color(0xFF8B5CF6),  // 보라색
    'floor1' => const Color(0xFF3B82F6),  // 파란색
    'driver' => const Color(0xFFF59E0B),  // 주황색
    'admin'  => const Color(0xFF10B981),  // 초록색
    _        => const Color(0xFF6B7280),  // 회색 (system 등)
  };

  static String _roleLabel(String role) => switch (role) {
    'floor2' => '2층 수주',
    'floor1' => '1층 제작',
    'driver' => '배송기사',
    'admin'  => '관리자',
    _        => '시스템',
  };

  /// 이름에서 이니셜 추출 (최대 2글자)
  static String _initials(String name) {
    if (name.isEmpty) return '?';
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}';
    }
    return name.length >= 2 ? name.substring(0, 2) : name;
  }

  /// 시간 경과 표시
  static String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return '방금 전';
    if (diff.inMinutes < 60) return '${diff.inMinutes}분 전';
    if (diff.inHours < 24) return '${diff.inHours}시간 전';
    return '${diff.inDays}일 전';
  }
}
```

### 6.3 역할별 색상 정리

| 역할 | 코드 | 색상 | Hex |
|------|------|------|-----|
| floor2 (2층 수주) | `floor2` | 보라색 | `#8B5CF6` |
| floor1 (1층 제작) | `floor1` | 파란색 | `#3B82F6` |
| driver (배송기사) | `driver` | 주황색 | `#F59E0B` |
| admin (관리자) | `admin` | 초록색 | `#10B981` |
| system (시스템) | `system` | 회색 | `#6B7280` |

---

## 7. 메시지 입력 UI

```dart
// lib/widgets/chat/chat_input.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ChatInput extends StatefulWidget {
  final void Function(String text) onSend;

  const ChatInput({super.key, required this.onSend});

  @override
  State<ChatInput> createState() => _ChatInputState();
}

class _ChatInputState extends State<ChatInput> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  void _send() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    widget.onSend(text);
    _controller.clear();
    _focusNode.requestFocus();
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Colors.grey[200]!)),
      ),
      child: Row(
        children: [
          Expanded(
            child: KeyboardListener(
              focusNode: FocusNode(), // KeyboardListener 용 별도 FocusNode
              onKeyEvent: (event) {
                // Enter 키로 전송 (Shift+Enter는 줄바꿈)
                if (event is KeyDownEvent &&
                    event.logicalKey == LogicalKeyboardKey.enter &&
                    !HardwareKeyboard.instance.isShiftPressed) {
                  _send();
                }
              },
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                decoration: const InputDecoration(
                  hintText: '메시지를 입력하세요...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 12, vertical: 8,
                  ),
                  isDense: true,
                ),
                maxLines: 3,
                minLines: 1,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(
            onPressed: _send,
            icon: const Icon(Icons.send),
            style: IconButton.styleFrom(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## 8. 반응형 채팅 레이아웃

### 데스크톱 (width > 1200px): 우측 고정 패널

```dart
// lib/screens/app_shell.dart (발췌)

@override
Widget build(BuildContext context) {
  final width = MediaQuery.of(context).size.width;
  final isDesktop = width > 1200;

  return Scaffold(
    body: Row(
      children: [
        // 사이드바
        const SizedBox(width: 220, child: Sidebar()),
        // 메인 컨텐츠
        const Expanded(child: RouterOutlet()),
        // 배송 패널 (admin만, 데스크톱만)
        if (isDesktop && isAdmin)
          const SizedBox(width: 360, child: DeliveryPanel()),
        // 채팅 패널 (데스크톱: 고정 500px)
        if (isDesktop)
          const SizedBox(width: 500, child: ChatPanel()),
      ],
    ),
    // 모바일: FAB으로 채팅 열기
    floatingActionButton: isDesktop
        ? null
        : FloatingActionButton(
            onPressed: () => _openChatSheet(context),
            child: Badge(
              label: Text('$unreadCount'),
              isLabelVisible: unreadCount > 0,
              child: const Icon(Icons.chat),
            ),
          ),
  );
}
```

### 모바일 (width <= 1200px): BottomSheet 또는 별도 화면

```dart
void _openChatSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => SizedBox(
      height: MediaQuery.of(context).size.height * 0.85,
      child: const ChatPanel(),
    ),
  );
}

// 또는 별도 전체 화면으로 이동
void _openChatScreen(BuildContext context) {
  Navigator.push(
    context,
    MaterialPageRoute(builder: (_) => const ChatScreen()),
  );
}
```

### 레이아웃 다이어그램

```
데스크톱 (> 1200px):
┌────────┬───────────────────┬──────────┬──────────────┐
│ Sidebar │    Main Content   │ Delivery │  Chat Panel  │
│ (220px) │      (flex 1)     │  Panel   │   (500px)    │
│         │                   │ (360px)  │              │
│         │                   │ admin만   │              │
└────────┴───────────────────┴──────────┴──────────────┘

모바일 (<=1200px):
┌──────────────────────────┐
│      Main Content         │
│                           │
│                   ┌─────┐ │
│                   │ FAB │ │
│                   └─────┘ │
└──────────────────────────┘
     FAB 클릭 → BottomSheet 또는 별도 화면
```

---

## 9. 스크롤 관리

채팅에서 스크롤 동작은 사용자 경험에 큰 영향을 미칩니다. 아래 규칙을 따르세요.

### 자동 스크롤 규칙

1. **새 메시지 수신 시**: 사용자가 최하단 근처(50px 이내)에 있으면 자동 스크롤
2. **사용자가 위로 스크롤**: 과거 메시지를 읽는 중이면 자동 스크롤 비활성화
3. **내가 보낸 메시지**: 항상 최하단으로 스크롤
4. **채팅 패널 최초 열기**: 최하단으로 이동

```dart
// 스크롤 관리 핵심 로직

class _ChatPanelState extends ConsumerState<ChatPanel> {
  final _scrollController = ScrollController();
  bool _shouldAutoScroll = true;
  int _previousMessageCount = 0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      if (!_scrollController.hasClients) return;
      final max = _scrollController.position.maxScrollExtent;
      final current = _scrollController.position.pixels;
      // 최하단에서 50px 이내면 자동 스크롤 활성화
      _shouldAutoScroll = (max - current) < 50;
    });
  }

  void _handleNewMessages(List<ChatMessage> messages) {
    if (messages.length > _previousMessageCount && _shouldAutoScroll) {
      _scrollToBottom();
    }
    _previousMessageCount = messages.length;
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }
}
```

---

## 10. 시간 표시 유틸 (_timeAgo)

```dart
// lib/utils/time_utils.dart

/// ISO 문자열 또는 DateTime → "방금 전", "3분 전", "2시간 전", "1일 전" 형태
String timeAgo(DateTime dt) {
  final diff = DateTime.now().difference(dt);

  if (diff.inSeconds < 60) return '방금 전';
  if (diff.inMinutes < 60) return '${diff.inMinutes}분 전';
  if (diff.inHours < 24) return '${diff.inHours}시간 전';
  if (diff.inDays < 7) return '${diff.inDays}일 전';

  // 1주일 이상이면 날짜 표시
  return '${dt.month}/${dt.day} '
         '${dt.hour.toString().padLeft(2, '0')}:'
         '${dt.minute.toString().padLeft(2, '0')}';
}

/// DateTime → "HH:mm" 형태
String formatTime(DateTime dt) =>
    '${dt.hour.toString().padLeft(2, '0')}:'
    '${dt.minute.toString().padLeft(2, '0')}';
```

---

## 11. 기존 Vanilla JS 코드와의 대응표

| Vanilla JS (chat.js) | Flutter 대응 |
|----------------------|-------------|
| `Chat._msgsRef = ref('messages').orderByChild('ts').limitToLast(200)` | `ChatService.messagesStream` |
| `Chat._msgsRef.on('child_added', ...)` | `StreamProvider` + `onValue` |
| `Chat._writeRef.push({...})` | `ChatService.sendMessage(...)` |
| `Chat._writeRef.child(key).child('checkedBy').set(updated)` | `ChatService.checkMessage(...)` |
| `Chat._msgHtml(m)` — 내 메시지 / 다른 사람 분기 | `ChatMessageBubble` 위젯 (isMe 분기) |
| `Chat._bindInput()` — Enter 키 바인딩 | `ChatInput` 위젯 + `KeyboardListener` |
| `Chat.ROLE_LABELS` | `_roleLabel()` static 메서드 |
| `Chat._timeAgo(iso)` | `timeAgo()` 유틸 함수 |
| `el.scrollTop = el.scrollHeight` | `ScrollController.animateTo(maxScrollExtent)` |
| `Chat._rerenderAll()` | Riverpod `StreamProvider` 자동 리빌드 |

---

## 12. 주의사항

1. **`onValue` vs `onChildAdded`**: Flutter에서는 `onValue`를 사용하여 전체 스냅샷을 받는 것이 Riverpod `StreamProvider`와 더 자연스럽습니다. Vanilla JS에서는 `child_added`/`child_changed`/`child_removed`를 각각 처리했지만, Flutter에서는 `onValue` 하나로 전체 상태를 갱신합니다.

2. **checkedBy 배열 파싱 주의**: Firebase Realtime DB에서 배열은 인덱스 기반 키로 저장됩니다. 중간 요소가 삭제되면 sparse array가 되어 Map으로 반환될 수 있습니다. `fromMap`에서 `List`와 `Map` 두 경우를 모두 처리해야 합니다.

3. **메모리 관리**: `StreamProvider`는 구독자가 없으면 자동 해제되므로 별도의 cleanup이 필요 없습니다. 다만 `ScrollController`는 `dispose()`에서 반드시 해제하세요.

4. **200개 제한**: `limitToLast(200)`은 성능과 메모리를 위한 것입니다. 채팅 이력이 많아지면 페이지네이션(과거 메시지 로드 버튼)을 추가로 구현하세요.

5. **오프라인 동작**: `FirebaseDatabase.instance.setPersistenceEnabled(true)` 설정 시, 오프라인에서 보낸 메시지가 온라인 복귀 후 자동 동기화됩니다.

---

이전 문서: [10-order-workflow.md](./10-order-workflow.md)
다음 문서: [12-driver-features.md](./12-driver-features.md)

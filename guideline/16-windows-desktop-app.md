# 16. Windows 데스크톱 앱 (C++) 개발 가이드

> **대상 독자:** 사무직용 클라이언트를 Flutter Web으로 갈지, Windows 네이티브 앱으로 갈지 판단해야 하는 의사결정자 및 개발자  
> **목표:** C++ Windows 데스크톱 앱의 기술 선택지, 구현 방법, 장단점을 정리하고, Flutter Web과 객관적으로 비교

---

## 1. 왜 Windows 데스크톱 앱을 고려하는가?

메이대구의 사무직(floor2, floor1, admin)은 **항상 사무실 PC에서 작업**합니다.  
브라우저를 열어 웹에 접속하는 방식 대신, **Windows 전용 프로그램(.exe)**을 설치하면 다음 이점이 있을 *수* 있습니다:

- 브라우저 없이 바탕화면 아이콘 더블클릭으로 바로 실행
- OS 수준 알림 (트레이 아이콘, 푸시)
- 로컬 하드웨어 직접 접근 (프린터, 바코드 스캐너, 시리얼 포트 등)
- 오프라인 시작 가능 (로컬 캐시 후 동기화)
- 자체 윈도우 프레임 → 자유로운 창 제어

단, 이 장점들이 **메이대구 프로젝트에 실제로 필요한지**는 뒤의 비교표에서 판단합니다.

---

## 2. C++ Windows 앱 기술 선택지

### 2.1 프레임워크 비교표

| 프레임워크 | 언어 | UI 자유도 | Firebase 연동 | 학습 곡선 | 크로스 플랫폼 |
|-----------|------|----------|--------------|----------|-------------|
| **WinUI 3 / WinAppSDK** | C++ (또는 C#) | ★★★★☆ | REST API 직접 호출 | 중상 | Windows 전용 |
| **Qt 6** | C++ | ★★★★★ | REST API 직접 호출 | 중상 | Windows / macOS / Linux |
| **Dear ImGui** | C++ | ★★★☆☆ (게임풍) | REST API 직접 호출 | 중 | Windows / macOS / Linux |
| **Win32 + Direct2D** | C | ★★★★★ (최대) | REST API 직접 호출 | 최상 | Windows 전용 |
| **C++/WinRT + XAML** | C++ | ★★★★☆ | REST API 직접 호출 | 상 | Windows 전용 |
| **CEF (Chromium Embedded)** | C++ + HTML/CSS/JS | ★★★★★ | JS SDK 사용 가능 | 중 | Windows / macOS / Linux |
| **Flutter Desktop** | Dart (내부 C++) | ★★★★☆ | Flutter SDK 직접 | 중하 | Windows / macOS / Linux |

### 2.2 권장: Qt 6 또는 Flutter Desktop

#### 옵션 A — Qt 6 (순수 C++)

```
장점:
- C++ 네이티브 성능 (메모리·CPU 직접 제어)
- QML로 선언형 UI 작성 → 디자인 자유도 최상
- Qt Charts, Qt WebEngine 등 풍부한 공식 모듈
- 크로스 플랫폼 (Windows + macOS + Linux)
- 25년 이상의 안정적 생태계

단점:
- Firebase SDK 없음 → REST API 직접 호출 필요
- 실시간 동기화 직접 구현 (WebSocket / SSE)
- 개발 속도 느림 (C++ 컴파일·디버그)
- Qt 상용 라이선스 ($302/월) 또는 GPL/LGPL 오픈소스
```

#### 옵션 B — Flutter Desktop (권장 — 이미 Flutter 사용 중)

```
장점:
- 모바일(기사 앱)과 동일 코드베이스 공유
- Firebase SDK 네이티브 지원 (firebase_core_desktop)
- Dart 언어 → C++보다 생산성 높음
- Hot Reload (빠른 개발)
- 기존 가이드라인 01~15 전부 그대로 적용

단점:
- 내부적으로 C++ 엔진 사용하지만 Dart로 코딩
- 순수 C++보다 메모리 사용량 약간 높음
- Win32 API 직접 호출 시 FFI 필요
```

> ⚠️ Flutter Desktop은 내부적으로 **C++ Embedder** 위에서 동작합니다. "C++ 앱"의 실질적 대안이 됩니다.

---

## 3. 순수 C++ (Qt 6) 구현 가이드

### 3.1 개발 환경

| 도구 | 버전 | 용도 |
|------|------|------|
| **Visual Studio 2022** | 17.x | C++ 빌드 (MSVC 컴파일러) |
| **Qt 6.7+** | 6.7 LTS | UI 프레임워크 |
| **Qt Creator** | 13.x | Qt 전용 IDE (선택 — VS에서도 Qt 사용 가능) |
| **CMake** | 3.28+ | 빌드 시스템 |
| **vcpkg** | 최신 | C++ 패키지 관리자 |
| **OpenSSL** | 3.x | HTTPS 통신 (Firebase REST API) |

### 3.2 프로젝트 구조

```
maydaegu-desktop/
├── CMakeLists.txt
├── src/
│   ├── main.cpp                    ← 앱 진입점
│   ├── app.h / app.cpp             ← QApplication 래퍼
│   │
│   ├── core/
│   │   ├── firebase_client.h       ← Firebase REST API 래퍼
│   │   ├── firebase_client.cpp
│   │   ├── auth_manager.h          ← 로그인/세션 관리
│   │   ├── auth_manager.cpp
│   │   ├── realtime_listener.h     ← SSE (Server-Sent Events) 구독
│   │   ├── realtime_listener.cpp
│   │   └── constants.h             ← 주문 상태 코드, API URL 등
│   │
│   ├── models/
│   │   ├── order.h                 ← struct Order { ... }
│   │   ├── user.h
│   │   ├── driver.h
│   │   ├── product.h
│   │   └── chat_message.h
│   │
│   ├── services/
│   │   ├── order_service.h / .cpp   ← 주문 CRUD (REST)
│   │   ├── product_service.h / .cpp
│   │   ├── driver_service.h / .cpp
│   │   ├── chat_service.h / .cpp
│   │   └── storage_service.h / .cpp ← 사진 업로드 (Storage REST)
│   │
│   ├── ui/
│   │   ├── main_window.h / .cpp     ← QMainWindow (Shell)
│   │   ├── login_dialog.h / .cpp
│   │   ├── sidebar_widget.h / .cpp
│   │   ├── chat_panel.h / .cpp
│   │   ├── delivery_panel.h / .cpp
│   │   │
│   │   ├── floor2/
│   │   │   ├── my_orders_view.h / .cpp
│   │   │   └── new_order_view.h / .cpp
│   │   ├── floor1/
│   │   │   └── all_orders_view.h / .cpp
│   │   └── admin/
│   │       ├── all_orders_view.h / .cpp
│   │       ├── manage_products_view.h / .cpp
│   │       ├── manage_drivers_view.h / .cpp
│   │       ├── manage_categories_view.h / .cpp
│   │       └── statistics_view.h / .cpp
│   │
│   └── utils/
│       ├── json_parser.h            ← nlohmann/json 또는 QJsonDocument
│       ├── date_utils.h
│       └── image_utils.h
│
├── qml/                             ← QML UI 파일 (선언형 UI 선택 시)
│   ├── Main.qml
│   ├── components/
│   │   ├── OrderCard.qml
│   │   ├── StatusBadge.qml
│   │   ├── ChatBubble.qml
│   │   └── DriverCard.qml
│   └── views/
│       ├── LoginView.qml
│       ├── Floor2View.qml
│       ├── Floor1View.qml
│       └── AdminView.qml
│
├── resources/
│   ├── icons/
│   ├── fonts/
│   └── app.rc                       ← Windows 리소스 (아이콘, 버전 정보)
│
├── installer/
│   └── maydaegu.iss                  ← Inno Setup 스크립트
│
└── tests/
    ├── test_order_model.cpp
    ├── test_firebase_client.cpp
    └── CMakeLists.txt
```

### 3.3 Firebase REST API 연동 (핵심 난관)

Firebase C++ SDK는 **게임 엔진 전용**(Unity, Unreal)이라 데스크톱 앱에서는 **REST API를 직접 호출**해야 합니다.

#### 인증 (Firebase Auth REST)

```cpp
// src/core/auth_manager.cpp
#include <QNetworkAccessManager>
#include <QJsonDocument>
#include <QJsonObject>

const QString AUTH_URL =
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
    "?key=AIzaSyBC4y-bbzIUdDxYo-K5kIF8_ms-XwNpBNs";

void AuthManager::login(const QString& email, const QString& password) {
    QJsonObject body;
    body["email"] = email;
    body["password"] = password;
    body["returnSecureToken"] = true;

    QNetworkRequest req(QUrl(AUTH_URL));
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");

    auto* reply = m_network->post(req, QJsonDocument(body).toJson());
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        auto doc = QJsonDocument::fromJson(reply->readAll());
        auto obj = doc.object();

        if (obj.contains("idToken")) {
            m_idToken   = obj["idToken"].toString();
            m_uid       = obj["localId"].toString();
            m_expiresIn = obj["expiresIn"].toString().toInt();
            emit loginSuccess(m_uid);
            fetchUserProfile(m_uid);  // /users/{uid} 조회
        } else {
            emit loginFailed(obj["error"].toObject()["message"].toString());
        }
        reply->deleteLater();
    });
}
```

#### 실시간 데이터 구독 (SSE — Server-Sent Events)

Firebase Realtime DB는 REST로도 **실시간 스트리밍**을 지원합니다 (SSE 프로토콜):

```cpp
// src/core/realtime_listener.cpp
const QString DB_URL =
    "https://mayflower-5c9dd-default-rtdb.asia-southeast1.firebasedatabase.app";

void RealtimeListener::subscribe(const QString& path) {
    QUrl url(DB_URL + "/" + path + ".json");
    QUrlQuery query;
    query.addQueryItem("auth", m_authManager->idToken());
    url.setQuery(query);

    QNetworkRequest req(url);
    req.setRawHeader("Accept", "text/event-stream");  // SSE 요청

    m_sseReply = m_network->get(req);

    // SSE 스트림: 데이터가 올 때마다 readyRead 시그널
    connect(m_sseReply, &QNetworkReply::readyRead, this, [this]() {
        QByteArray data = m_sseReply->readAll();
        // SSE 포맷: "event: put\ndata: {\"path\":\"/\",\"data\":{...}}\n\n"
        parseSseEvent(data);
    });
}

void RealtimeListener::parseSseEvent(const QByteArray& raw) {
    QString text = QString::fromUtf8(raw);
    for (const auto& block : text.split("\n\n")) {
        if (block.trimmed().isEmpty()) continue;

        QString event, data;
        for (const auto& line : block.split("\n")) {
            if (line.startsWith("event:")) event = line.mid(6).trimmed();
            if (line.startsWith("data:"))  data  = line.mid(5).trimmed();
        }

        if (event == "put" || event == "patch") {
            auto doc = QJsonDocument::fromJson(data.toUtf8());
            emit dataChanged(doc.object());
        }
    }
}
```

#### 주문 CRUD (REST)

```cpp
// src/services/order_service.cpp

// 읽기 (일회성)
void OrderService::fetchOrders() {
    QUrl url(DB_URL + "/orders.json?orderBy=\"createdAt\"&limitToLast=200");
    QUrlQuery q;
    q.addQueryItem("auth", m_auth->idToken());
    url.setQuery(q);

    auto* reply = m_network->get(QNetworkRequest(url));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        auto doc = QJsonDocument::fromJson(reply->readAll());
        QList<Order> orders;
        auto obj = doc.object();
        for (auto it = obj.begin(); it != obj.end(); ++it) {
            orders.append(Order::fromJson(it.key(), it.value().toObject()));
        }
        emit ordersFetched(orders);
        reply->deleteLater();
    });
}

// 쓰기 (신규 주문)
void OrderService::createOrder(const Order& order) {
    QUrl url(DB_URL + "/orders.json");
    QUrlQuery q;
    q.addQueryItem("auth", m_auth->idToken());
    url.setQuery(q);

    QNetworkRequest req(url);
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");

    auto* reply = m_network->post(req, order.toJson());
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        auto doc = QJsonDocument::fromJson(reply->readAll());
        QString pushKey = doc.object()["name"].toString();
        emit orderCreated(pushKey);
        reply->deleteLater();
    });
}

// 업데이트
void OrderService::updateOrder(const QString& orderId, const QJsonObject& updates) {
    QUrl url(DB_URL + "/orders/" + orderId + ".json");
    QUrlQuery q;
    q.addQueryItem("auth", m_auth->idToken());
    url.setQuery(q);

    QNetworkRequest req(url);
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");

    // PATCH = 부분 업데이트
    m_network->sendCustomRequest(req, "PATCH", QJsonDocument(updates).toJson());
}
```

### 3.4 Order 모델 (C++ struct)

```cpp
// src/models/order.h
#pragma once
#include <QString>
#include <QDateTime>
#include <QJsonObject>
#include <QJsonDocument>

struct Order {
    QString id;
    QString chainName;
    QString productId;
    QString productName;
    QDateTime deliveryDatetime;
    bool isImmediate = false;
    QString deliveryAddress;
    QString recipientName;
    QString recipientPhone;
    QString ribbonText;
    QString occasionText;
    int status = 0;           // 0~6
    QString assignedDriverId;
    QString assignedDriverName;
    QDateTime assignedAt;
    QString storePhotoUrl;
    QString deliveryPhotoUrl;
    QString createdByUserId;
    QString createdByName;
    QDateTime createdAt;
    QDateTime updatedAt;

    static Order fromJson(const QString& key, const QJsonObject& obj) {
        Order o;
        o.id               = key;
        o.chainName        = obj["chainName"].toString();
        o.productId        = obj["productId"].toString();
        o.productName      = obj["productName"].toString();
        o.deliveryDatetime = QDateTime::fromString(obj["deliveryDatetime"].toString(), Qt::ISODate);
        o.isImmediate      = obj["isImmediate"].toBool();
        o.deliveryAddress  = obj["deliveryAddress"].toString();
        o.recipientName    = obj["recipientName"].toString();
        o.recipientPhone   = obj["recipientPhone"].toString();
        o.ribbonText       = obj["ribbonText"].toString();
        o.occasionText     = obj["occasionText"].toString();
        o.status           = obj["status"].toInt();
        o.assignedDriverId = obj["assignedDriverId"].toString();
        o.assignedDriverName = obj["assignedDriverName"].toString();
        o.createdAt        = QDateTime::fromString(obj["createdAt"].toString(), Qt::ISODate);
        o.updatedAt        = QDateTime::fromString(obj["updatedAt"].toString(), Qt::ISODate);
        // ... storePhotoUrl, deliveryPhotoUrl 등
        return o;
    }

    QByteArray toJson() const {
        QJsonObject obj;
        obj["chainName"]        = chainName;
        obj["productId"]        = productId;
        obj["productName"]      = productName;
        obj["deliveryDatetime"] = deliveryDatetime.toString(Qt::ISODate);
        obj["isImmediate"]      = isImmediate;
        obj["deliveryAddress"]  = deliveryAddress;
        obj["recipientName"]    = recipientName;
        obj["recipientPhone"]   = recipientPhone;
        obj["ribbonText"]       = ribbonText;
        obj["occasionText"]     = occasionText;
        obj["status"]           = status;
        obj["createdAt"]        = createdAt.toString(Qt::ISODate);
        obj["updatedAt"]        = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);
        return QJsonDocument(obj).toJson();
    }
};
```

### 3.5 UI 구현 (QML 예시)

```qml
// qml/components/OrderCard.qml
import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Rectangle {
    id: root
    property var order  // Order 객체 바인딩

    width: parent.width
    height: 100
    radius: 8
    color: "#FFFFFF"
    border.color: "#E2E8F0"
    border.width: 1

    RowLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 12

        // 상태 뱃지
        Rectangle {
            width: 64; height: 24
            radius: 12
            color: statusColor(order.status)
            Text {
                anchors.centerIn: parent
                text: statusLabel(order.status)
                color: "white"
                font.pixelSize: 11
                font.bold: true
            }
        }

        // 주문 정보
        Column {
            Layout.fillWidth: true
            spacing: 4
            Text {
                text: order.chainName + " — " + order.productName
                font.pixelSize: 14
                font.bold: true
                color: "#1E293B"
            }
            Text {
                text: "받는분: " + order.recipientName + " | " + order.deliveryAddress
                font.pixelSize: 12
                color: "#64748B"
                elide: Text.ElideRight
            }
        }

        // 시간
        Text {
            text: Qt.formatDateTime(order.deliveryDatetime, "HH:mm")
            font.pixelSize: 13
            color: "#94A3B8"
        }
    }

    function statusColor(s) {
        if (s <= 2) return "#6366F1";  // 접수 — indigo
        if (s === 3) return "#F59E0B"; // 배송중 — amber
        if (s === 4) return "#22C55E"; // 완료 — green
        return "#EF4444";              // 취소 — red
    }

    function statusLabel(s) {
        const labels = ["접수", "확인", "제작중", "배송중", "완료", "취소", "취소"];
        return labels[s] || "알수없음";
    }
}
```

### 3.6 메인 윈도우 레이아웃 (4열 그리드)

```qml
// qml/Main.qml
import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

ApplicationWindow {
    id: window
    visible: true
    width: 1600
    height: 900
    title: "메이대구 — 사내 업무 관리"
    color: "#F1F5F9"

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // 사이드바 (220px)
        SidebarWidget {
            Layout.preferredWidth: 220
            Layout.fillHeight: true
        }

        // 메인 컨텐츠 (남은 공간)
        StackView {
            id: mainStack
            Layout.fillWidth: true
            Layout.fillHeight: true
            initialItem: allOrdersView
        }

        // 배송 패널 (360px — admin만)
        Loader {
            Layout.preferredWidth: 360
            Layout.fillHeight: true
            active: session.role === "admin"
            source: "views/DeliveryPanel.qml"
        }

        // 채팅 패널 (500px)
        ChatPanel {
            Layout.preferredWidth: 500
            Layout.fillHeight: true
        }
    }
}
```

### 3.7 빌드 & 배포

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.28)
project(maydaegu_desktop VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 REQUIRED COMPONENTS
    Core Gui Widgets Network WebSockets Qml Quick Charts
)

qt_add_executable(maydaegu_desktop
    src/main.cpp
    src/core/firebase_client.cpp
    src/core/auth_manager.cpp
    src/core/realtime_listener.cpp
    src/services/order_service.cpp
    # ... 나머지 소스
)

target_link_libraries(maydaegu_desktop PRIVATE
    Qt6::Core Qt6::Gui Qt6::Widgets
    Qt6::Network Qt6::WebSockets
    Qt6::Qml Qt6::Quick Qt6::Charts
)

# Windows 리소스 (아이콘)
if(WIN32)
    target_sources(maydaegu_desktop PRIVATE resources/app.rc)
endif()
```

#### 설치 프로그램 (Inno Setup)

```
; installer/maydaegu.iss
[Setup]
AppName=메이대구
AppVersion=1.0.0
DefaultDirName={autopf}\Maydaegu
DefaultGroupName=메이대구
OutputBaseFilename=maydaegu_setup
Compression=lzma2
SolidCompression=yes

[Files]
Source: "..\build\Release\maydaegu_desktop.exe"; DestDir: "{app}"
Source: "..\build\Release\*.dll"; DestDir: "{app}"
Source: "..\build\Release\plugins\*"; DestDir: "{app}\plugins"; Flags: recursesubdirs

[Icons]
Name: "{group}\메이대구"; Filename: "{app}\maydaegu_desktop.exe"
Name: "{autodesktop}\메이대구"; Filename: "{app}\maydaegu_desktop.exe"
```

---

## 4. Flutter Desktop (대안 — 추천)

기존 Flutter 코드베이스에 Windows 타겟만 추가하면 됩니다:

```bash
# 프로젝트에 Windows 플랫폼 추가
flutter create --platforms windows .

# Windows 빌드 실행
flutter run -d windows

# 릴리스 빌드
flutter build windows --release
# 출력: build/windows/x64/runner/Release/
```

### Flutter Desktop이 C++ 네이티브와 다른 점

```
maydaegu_app/
├── lib/                    ← Dart 코드 (iOS/Android/Web과 100% 공유)
├── windows/                ← C++ Embedder (자동 생성)
│   ├── runner/
│   │   ├── main.cpp        ← Win32 진입점
│   │   ├── flutter_window.cpp
│   │   └── resource.h
│   └── CMakeLists.txt
└── pubspec.yaml
```

- `windows/` 폴더의 C++은 Flutter 엔진을 호스팅하는 **얇은 래퍼**
- 실제 앱 로직은 `lib/` 의 Dart로 작성 → 모바일/웹과 동일
- Win32 API 직접 호출이 필요하면 `dart:ffi`로 바인딩

---

## 5. 핵심 비교: Flutter Web vs C++ Desktop vs Flutter Desktop

### 5.1 종합 비교표

| 항목 | Flutter Web | C++ Desktop (Qt) | Flutter Desktop |
|------|:-----------:|:-----------------:|:---------------:|
| **개발 속도** | ★★★★★ | ★★☆☆☆ | ★★★★★ |
| **디자인 자유도** | ★★★★☆ | ★★★★★ | ★★★★☆ |
| **성능 (CPU/메모리)** | ★★★☆☆ | ★★★★★ | ★★★★☆ |
| **Firebase 연동 난이도** | ★ 쉬움 | ★★★★★ 매우 어려움 | ★★ 쉬움 |
| **실시간 동기화** | SDK 내장 | SSE 직접 구현 | SDK 내장 |
| **배포 편의성** | ★★★★★ URL만 공유 | ★★☆☆☆ 설치파일 | ★★★☆☆ 설치파일 |
| **업데이트** | 서버 배포 즉시 반영 | 수동 재설치 / 자동 업데이터 구현 | 수동 재설치 / MSIX |
| **코드 재사용 (모바일)** | 라우팅 분기만 | 불가 (완전 별도) | 95% 공유 |
| **오프라인 지원** | 제한적 (Service Worker) | 완전 | 완전 |
| **OS 연동 (트레이, 프린터)** | 불가 | 완전 | FFI로 가능 |
| **학습 곡선** | Dart (이미 사용 중) | C++ + Qt + REST | Dart (이미 사용 중) |
| **유지보수 인력** | Flutter 개발자 1명 | C++ 별도 인력 필요 | Flutter 개발자 1명 |
| **라이선스 비용** | 무료 | Qt 상용 $302/월 또는 LGPL | 무료 |

### 5.2 기능별 상세 비교

#### 🎨 디자인 자유도

| 세부 항목 | Flutter Web | C++ Qt/QML | Flutter Desktop |
|-----------|:-----------:|:----------:|:---------------:|
| 커스텀 위젯 (버튼, 카드) | ✅ 완전 자유 | ✅ 완전 자유 | ✅ 완전 자유 |
| 애니메이션 | ✅ 60fps | ✅ 60fps | ✅ 60fps |
| 그림자/그라데이션 | ✅ | ✅ | ✅ |
| 커스텀 윈도우 프레임 | ❌ 브라우저 제한 | ✅ 타이틀바 제거 가능 | ✅ (window_manager) |
| 시스템 트레이 아이콘 | ❌ | ✅ QSystemTrayIcon | ✅ (system_tray) |
| 네이티브 메뉴바 | ❌ | ✅ QMenuBar | ✅ (PlatformMenuBar) |
| 투명/반투명 윈도우 | ❌ | ✅ | ✅ |
| 멀티 윈도우 | ❌ 탭으로 대체 | ✅ | ✅ (desktop_multi_window) |
| 드래그 & 드롭 (파일) | ⚠️ 제한적 | ✅ | ✅ (desktop_drop) |
| 프린터 직접 제어 | ❌ `window.print()` 뿐 | ✅ QPrinter | ✅ FFI 필요 |

#### ⚡ 기능 (메이대구 업무 관련)

| 기능 | Flutter Web | C++ Qt | Flutter Desktop |
|------|:-----------:|:------:|:---------------:|
| 주문 CRUD | ✅ | ✅ (REST) | ✅ |
| 실시간 채팅 | ✅ SDK | ⚠️ SSE 직접 구현 | ✅ SDK |
| 배송 패널 (실시간) | ✅ SDK | ⚠️ SSE 직접 구현 | ✅ SDK |
| 로그인/세션 | ✅ Firebase Auth | ⚠️ REST API 직접 | ✅ Firebase Auth |
| 사진 보기/확대 | ✅ | ✅ | ✅ |
| 통계 차트 | ✅ (fl_chart) | ✅ (Qt Charts) | ✅ (fl_chart) |
| 키보드 단축키 | ⚠️ 브라우저 충돌 가능 | ✅ 완전 자유 | ✅ 완전 자유 |
| 시작 시 자동 실행 | ❌ | ✅ 레지스트리 | ✅ (launch_at_startup) |
| 백그라운드 실행 | ❌ 탭 닫으면 종료 | ✅ 트레이 최소화 | ✅ 트레이 최소화 |
| 자동 업데이트 | ✅ 서버 배포 | ❌ 직접 구현 필요 | ⚠️ MSIX 또는 Sparkle |

#### 💰 비용 & 리소스

| 항목 | Flutter Web | C++ Qt | Flutter Desktop |
|------|:-----------:|:------:|:---------------:|
| 개발 인력 | Flutter 1명 | C++ 1명 (별도) | Flutter 1명 (동일) |
| 개발 기간 (동일 기능) | 기준 | 2~3배 | 1.1배 |
| 프레임워크 라이선스 | 무료 | 상용 $302/월 | 무료 |
| 호스팅/배포 비용 | Firebase Hosting 무료 | 자체 서버/배포 | 자체 배포 |
| 유지보수 난이도 | 낮음 | 높음 (C++ 메모리 관리) | 낮음 |

---

## 6. 메이대구 프로젝트 기준 판단 가이드

### 6.1 Flutter Web이 유리한 경우 ✅

- [x] 사무실 PC에 **설치 없이** 바로 접속하고 싶다
- [x] 직원 PC가 다양하다 (Windows 7/10/11, macOS 혼재)
- [x] **업데이트를 서버에서 한 번만 배포**하면 모든 PC에 즉시 반영되길 원한다
- [x] C++ 개발 인력이 없다 / Flutter 개발자 한 명으로 모바일+웹 관리하고 싶다
- [x] Firebase 실시간 기능 (채팅, 배송 패널)이 핵심이다
- [x] 프린터 직접 제어, 트레이 아이콘 등은 필요 없다

### 6.2 C++ Desktop (Qt)이 유리한 경우

- [ ] 프린터, 바코드 스캐너, POS 등 **하드웨어 장비와 직접 통신**해야 한다
- [ ] 인터넷 없는 폐쇄망에서도 완전 동작해야 한다
- [ ] 윈도우 창 제어 (투명, 항상 위, 커스텀 타이틀바) 등 **OS 수준 커스텀**이 반드시 필요하다
- [ ] C++ 숙련 개발자가 팀에 있다
- [ ] Qt 라이선스 비용이 감당 가능하다

### 6.3 Flutter Desktop이 유리한 경우 ⭐

- [x] Web의 **모든 장점 + 데스크톱 앱의 장점**을 둘 다 원한다
- [x] 모바일(기사 앱)과 코드를 공유하면서 데스크톱 앱도 만들고 싶다
- [x] 시스템 트레이, 키보드 단축키, 자동 시작 등 **약간의 OS 연동**이 필요하다
- [x] 설치형 앱이지만 **Firebase SDK를 그대로 사용**하고 싶다
- [ ] ⚠️ 단, 설치 파일 배포 & 업데이트 관리 비용을 감수할 수 있다

---

## 7. 의사결정 플로우차트

```
시작: "사무직용 클라이언트 어떤 걸로?"
│
├── 프린터/바코드 등 하드웨어 직접 제어 필요?
│   ├── YES → C++ Qt 또는 Flutter Desktop (FFI)
│   └── NO ↓
│
├── 인터넷 없는 폐쇄망에서 동작해야?
│   ├── YES → C++ Qt (완전 오프라인)
│   └── NO ↓
│
├── 시스템 트레이, 자동 시작, 커스텀 창 필요?
│   ├── YES → Flutter Desktop (추천) 또는 C++ Qt
│   └── NO ↓
│
├── C++ 개발자가 팀에 있고, 개발 기간에 여유가 있다?
│   ├── YES → C++ Qt도 가능 (디자인 자유도 최상)
│   └── NO ↓
│
└── → **Flutter Web** (가장 실용적)
    - 설치 불필요, 즉시 배포, Firebase 네이티브, 기사앱과 코드 공유
```

---

## 8. 혼합 전략: Flutter Web + 추후 Desktop 전환

실용적으로 가장 추천하는 전략입니다:

### Phase 1 — Flutter Web으로 시작 (현재~3개월)
- 가이드라인 01~15 기반으로 Flutter Web + Mobile(기사) 개발
- 사무직은 브라우저로 접속 (설치 없음)
- Firebase 실시간 기능 100% 활용

### Phase 2 — 필요 시 Flutter Desktop으로 확장 (선택)
```bash
# 기존 Flutter 프로젝트에 Windows 플랫폼 추가 — 한 줄이면 됨
flutter create --platforms windows .
```
- 기존 코드 95% 재사용
- 시스템 트레이, 키보드 단축키, 자동 시작 등 추가
- Web과 Desktop 동시 제공 가능 (사용자가 선택)

### Phase 3 — C++ 네이티브 (극히 특수한 경우만)
- POS 연동, 바코드 시리얼 통신 등 하드웨어 제어가 반드시 필요한 경우
- 해당 부분만 C++ DLL로 만들고 Flutter Desktop에서 FFI로 호출하는 혼합 방식 권장

---

## 9. 결론 요약

| 선택지 | 추천도 | 한 줄 요약 |
|--------|:------:|-----------|
| **Flutter Web** | ⭐⭐⭐⭐⭐ | 가장 실용적. 설치 없음, 즉시 배포, Firebase 네이티브, 기사앱과 코드 공유 |
| **Flutter Desktop** | ⭐⭐⭐⭐ | Web 코드 95% 재사용. 트레이/단축키 등 OS 기능 필요 시 추후 추가 |
| **C++ Qt** | ⭐⭐ | 디자인 자유도 최상이지만, Firebase REST 직접 구현·별도 인력·라이선스 비용 부담 |
| **C++ Win32** | ⭐ | 최대 자유도이지만 개발 비용 극히 높음. 메이대구 규모에 과함 |

> **💡 결론:** 메이대구 프로젝트 규모(사내 시스템, 꽃집 업무)에서는 **Flutter Web으로 시작**하고, 추후 데스크톱 기능이 꼭 필요해지면 **Flutter Desktop으로 확장**하는 전략이 가장 효율적입니다. C++ 네이티브는 하드웨어 직접 제어가 반드시 필요한 극소수 시나리오에서만 고려하세요.

---

이전 문서:
- [01-project-overview.md](./01-project-overview.md) — 프로젝트 전체 개요
- [02-system-architecture.md](./02-system-architecture.md) — 시스템 아키텍처
- [13-build-deploy.md](./13-build-deploy.md) — 빌드 & 배포 가이드

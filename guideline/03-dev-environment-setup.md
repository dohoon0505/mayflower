# 03. 개발 환경 설정

> **대상 독자:** Flutter 개발을 처음 시작하는 팀원 (환경 설정부터 첫 실행까지)  
> **목표:** 로컬 개발 환경을 완전히 구축하고, Flutter 앱을 Web/Android/iOS에서 실행할 수 있는 상태 만들기

---

## 1. 필수 도구 목록

개발을 시작하기 전에 아래 도구들을 모두 설치해야 합니다.

| 도구 | 버전 | 용도 | 필수 여부 |
|------|------|------|:---------:|
| **Flutter SDK** | 3.19+ (Dart 3 포함) | 앱 개발 프레임워크 | 필수 |
| **VS Code** | 최신 | 코드 에디터 (경량, 추천) | 택 1 |
| **Android Studio** | 최신 | 코드 에디터 + Android 에뮬레이터 | 택 1 |
| **Firebase CLI** | 최신 | Firebase 프로젝트 관리 | 필수 |
| **FlutterFire CLI** | 최신 | Flutter-Firebase 연결 도구 | 필수 |
| **Git** | 2.40+ | 버전 관리 | 필수 |
| **Node.js** | 18+ LTS | Firebase CLI 실행 | 필수 |
| **Chrome** | 최신 | Flutter Web 디버깅 | 필수 |
| **Xcode** | 15+ (macOS만) | iOS 시뮬레이터 + 빌드 | iOS 개발 시 |

---

## 2. Flutter SDK 설치

### Windows

#### 단계 1: Flutter SDK 다운로드

```powershell
# 방법 A: 공식 사이트에서 zip 다운로드
# https://docs.flutter.dev/get-started/install/windows

# 방법 B: Git으로 클론 (권장)
cd C:\dev
git clone https://github.com/flutter/flutter.git -b stable
```

#### 단계 2: 환경변수 PATH 설정

1. **시스템 환경변수** 열기: `Windows 키 > "환경변수" 검색 > 시스템 환경 변수 편집`
2. **Path** 변수에 추가: `C:\dev\flutter\bin`
3. 터미널을 **재시작**

```bash
# PATH 설정 확인
flutter --version
# Flutter 3.19.x 이상이 출력되면 성공
```

#### 단계 3: flutter doctor 실행

```bash
flutter doctor
```

아래 항목이 모두 체크 표시가 되어야 합니다:

```
[✓] Flutter (Channel stable, 3.19.x)
[✓] Windows Version
[✓] Android toolchain
[✓] Chrome - develop for the web
[✓] Visual Studio (선택 - Windows 데스크톱 앱 빌드 시)
[✓] Android Studio
[✓] VS Code
[✓] Connected device
```

느낌표(`!`)가 있으면 안내 메시지를 따라 해결하세요.

#### 단계 4: Android SDK 라이선스 동의

```bash
flutter doctor --android-licenses
# 모든 질문에 'y' 입력
```

---

### macOS

#### 단계 1: Flutter SDK 다운로드

```bash
# Homebrew로 설치 (가장 간편)
brew install --cask flutter

# 또는 Git 클론
cd ~/development
git clone https://github.com/flutter/flutter.git -b stable
```

#### 단계 2: 환경변수 PATH 설정

```bash
# ~/.zshrc 또는 ~/.bashrc에 추가
export PATH="$HOME/development/flutter/bin:$PATH"

# 적용
source ~/.zshrc
```

#### 단계 3: flutter doctor 실행

```bash
flutter doctor
```

macOS에서는 추가로 확인:

```
[✓] Flutter (Channel stable, 3.19.x)
[✓] Android toolchain
[✓] Xcode - develop for iOS and macOS
[✓] Chrome - develop for the web
[✓] Android Studio
[✓] VS Code
[✓] Connected device
```

#### 단계 4: Xcode 설정 (iOS 개발 시)

```bash
# Xcode 커맨드라인 도구 설치
sudo xcode-select --install

# CocoaPods 설치 (iOS 의존성 관리)
sudo gem install cocoapods

# Xcode 라이선스 동의
sudo xcodebuild -license accept

# iOS 시뮬레이터 열기
open -a Simulator
```

---

## 3. IDE 설정

### VS Code (권장)

#### 필수 확장 프로그램

VS Code를 열고 Extensions 탭(`Ctrl+Shift+X`)에서 설치:

| 확장 | ID | 용도 |
|------|-----|------|
| **Flutter** | `Dart-Code.flutter` | Flutter 개발 핵심 확장 |
| **Dart** | `Dart-Code.dart-code` | Dart 언어 지원 (Flutter 확장이 자동 설치) |
| **Firebase Explorer** | `jsayol.firebase-explorer` | Firebase 데이터 브라우징 (선택) |
| **Error Lens** | `usernamehw.errorlens` | 에러를 코드 옆에 인라인 표시 |
| **Bracket Pair Color** | 내장 | 괄호 색상 구분 (VS Code 내장 설정) |
| **GitLens** | `eamodio.gitlens` | Git 히스토리 시각화 (선택) |

#### 권장 settings.json

VS Code 설정 파일 (`Ctrl+Shift+P` > "Open User Settings (JSON)"):

```json
{
  // Dart / Flutter
  "dart.flutterSdkPath": "C:\\dev\\flutter",
  "dart.previewFlutterUiGuides": true,
  "dart.debugExternalPackageLibraries": false,
  "dart.debugSdkLibraries": false,

  // 자동 저장 시 포맷팅
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "Dart-Code.dart-code",
  "[dart]": {
    "editor.formatOnSave": true,
    "editor.formatOnType": true,
    "editor.selectionHighlight": false,
    "editor.suggestSelection": "first",
    "editor.tabCompletion": "onlySnippets",
    "editor.wordBasedSuggestions": "off",
    "editor.rulers": [80]
  },

  // 파일 제외 (불필요한 파일 숨기기)
  "files.exclude": {
    "**/.dart_tool": true,
    "**/.idea": true,
    "**/build": true,
    "**/*.g.dart": true
  },

  // 터미널
  "terminal.integrated.defaultProfile.windows": "Git Bash"
}
```

#### 유용한 단축키

| 동작 | Windows | macOS |
|------|---------|-------|
| Hot Reload | `Ctrl+Shift+F5` 또는 파일 저장 시 자동 | `Cmd+Shift+F5` |
| Hot Restart | `Ctrl+Shift+F5` (재실행) | `Cmd+Shift+F5` |
| 디버그 실행 | `F5` | `F5` |
| 파일 검색 | `Ctrl+P` | `Cmd+P` |
| 명령 팔레트 | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Widget 감싸기 | `Ctrl+.` > "Wrap with..." | `Cmd+.` |

---

### Android Studio (대안)

1. [공식 사이트](https://developer.android.com/studio)에서 다운로드 설치
2. **Plugins** > `Flutter` 검색 > 설치 (Dart 플러그인 자동 포함)
3. **Settings** > **Languages & Frameworks** > **Flutter** > SDK 경로 지정
4. **AVD Manager**에서 Android 에뮬레이터 생성

---

## 4. 프로젝트 생성

### Flutter 프로젝트 초기 생성

```bash
# 프로젝트 생성 (Web + Android + iOS 플랫폼 지원)
flutter create --org com.maydaegu --platforms web,android,ios maydaegu_app

# 생성된 디렉토리로 이동
cd maydaegu_app

# 정상 생성 확인
flutter run -d chrome
```

위 명령어 설명:
- `--org com.maydaegu` : 앱의 패키지 이름 접두사 (Android: `com.maydaegu.maydaegu_app`, iOS: Bundle ID)
- `--platforms web,android,ios` : 지원할 플랫폼 지정
- `maydaegu_app` : 프로젝트 폴더명

### 생성 직후 폴더 구조

```
maydaegu_app/
├── android/          Android 네이티브 설정
├── ios/              iOS 네이티브 설정
├── web/              Web 설정 (index.html 등)
├── lib/
│   └── main.dart     앱 진입점 (여기서 시작)
├── test/
│   └── widget_test.dart
├── pubspec.yaml      의존성 관리 (package.json과 비슷)
├── pubspec.lock
├── analysis_options.yaml  Lint 규칙
└── README.md
```

---

## 5. Firebase 연결

### 단계 1: Firebase CLI 설치

```bash
# Node.js가 설치되어 있어야 합니다
npm install -g firebase-tools

# Firebase 로그인
firebase login
# 브라우저가 열리면 Google 계정으로 로그인
```

### 단계 2: FlutterFire CLI 설치

```bash
# FlutterFire CLI 전역 설치
dart pub global activate flutterfire_cli

# PATH에 추가 필요할 수 있음:
# Windows: %LOCALAPPDATA%\Pub\Cache\bin
# macOS/Linux: $HOME/.pub-cache/bin
```

### 단계 3: Firebase 프로젝트 연결

```bash
# 프로젝트 디렉토리에서 실행
cd maydaegu_app

flutterfire configure --project=mayflower-5c9dd
```

실행하면 대화형으로 플랫폼을 선택합니다:

```
? Which platforms should your configuration support?
  ✅ android
  ✅ ios
  ✅ web
```

완료 후 `lib/firebase_options.dart` 파일이 **자동 생성**됩니다. 이 파일에는 각 플랫폼별 Firebase 설정값(API Key, Project ID 등)이 들어 있습니다.

### 단계 4: Firebase 초기화 코드

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase 초기화
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(
    const ProviderScope(   // Riverpod 상태 관리
      child: MaydaeguApp(),
    ),
  );
}

class MaydaeguApp extends StatelessWidget {
  const MaydaeguApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '메이대구',
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF6C63FF),  // 메인 컬러
        useMaterial3: true,
      ),
      home: const Scaffold(
        body: Center(child: Text('메이대구 앱 시작!')),
      ),
    );
  }
}
```

---

## 6. pubspec.yaml 초기 의존성

```yaml
name: maydaegu_app
description: 메이대구 꽃집 주문·배송 관리 시스템
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # ── Firebase ──────────────────────────────────────────
  firebase_core: ^2.27.0           # Firebase 초기화 (필수)
  firebase_auth: ^4.17.0           # 로그인 인증
  firebase_database: ^10.4.0       # Realtime Database (주문/채팅/기사 등)
  firebase_storage: ^11.6.0        # 사진 파일 업로드
  firebase_messaging: ^14.7.0      # 푸시 알림 (FCM)

  # ── 상태 관리 ─────────────────────────────────────────
  flutter_riverpod: ^2.5.0         # 상태 관리 (Provider의 발전형)

  # ── 라우팅 ────────────────────────────────────────────
  go_router: ^13.2.0               # 선언형 라우팅 (URL 기반)

  # ── 위치/지도 ─────────────────────────────────────────
  geolocator: ^11.0.0              # GPS 위치 읽기 + 거리 계산
  permission_handler: ^11.3.0      # 카메라/위치 등 권한 요청
  google_maps_flutter: ^2.6.0      # 지도 표시 (선택)
  flutter_background_geolocation: ^4.14.0   # 백그라운드 위치 추적

  # ── 카메라/이미지 ──────────────────────────────────────
  image_picker: ^1.0.7             # 카메라 촬영 / 갤러리 선택

  # ── 유틸리티 ──────────────────────────────────────────
  intl: ^0.19.0                    # 날짜/시간 포맷 (한국어)
  cached_network_image: ^3.3.1     # 이미지 캐싱 (배송 사진 등)
  shimmer: ^3.0.0                  # 로딩 스켈레톤 애니메이션

  # ── UI ────────────────────────────────────────────────
  cupertino_icons: ^1.0.6          # iOS 스타일 아이콘

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0            # 코드 린트 규칙

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/icons/
```

### 의존성 설치

```bash
flutter pub get
```

### 각 패키지 역할 요약

| 패키지 | 한 줄 설명 |
|--------|-----------|
| `firebase_core` | Firebase 초기화. 다른 Firebase 패키지의 필수 전제 |
| `firebase_auth` | 이메일+비밀번호 로그인, 세션 관리, 토큰 자동 갱신 |
| `firebase_database` | Realtime Database 읽기/쓰기/구독. 주문, 채팅, 기사 상태 |
| `firebase_storage` | 사진 파일 업로드/다운로드. 배송 완료 사진, 매장 사진 |
| `firebase_messaging` | FCM 푸시 알림. 신규 배차 시 기사에게 알림 |
| `flutter_riverpod` | 상태 관리. Provider보다 테스트하기 쉽고, 의존성 주입 지원 |
| `go_router` | URL 기반 라우팅. 웹에서 `/admin/orders` 같은 경로 지원 |
| `geolocator` | GPS 좌표 읽기, 두 지점 간 거리 계산 (회사 100m 감지) |
| `permission_handler` | 카메라, GPS 등 네이티브 권한 요청 다이얼로그 |
| `google_maps_flutter` | Google Maps 지도 위젯. 배송지 위치 표시 (선택) |
| `flutter_background_geolocation` | 앱이 백그라운드일 때도 위치 추적 (복귀 감지) |
| `image_picker` | 카메라로 사진 찍기 또는 갤러리에서 선택 |
| `intl` | 날짜/시간을 "2026년 4월 16일 오후 3:00" 형식으로 표시 |
| `cached_network_image` | 네트워크 이미지를 로컬에 캐싱. 같은 사진 재다운로드 방지 |
| `shimmer` | 데이터 로딩 중 반짝이는 스켈레톤 UI |

---

## 7. VS Code 권장 프로젝트 설정

프로젝트 루트에 `.vscode/settings.json` 파일을 생성합니다:

```json
{
  "dart.lineLength": 80,
  "dart.previewFlutterUiGuides": true,
  "dart.closingLabels": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit",
    "source.organizeImports": "explicit"
  },
  "files.associations": {
    "*.dart": "dart"
  },
  "search.exclude": {
    "**/build": true,
    "**/.dart_tool": true,
    "**/.idea": true,
    "**/android/.gradle": true
  }
}
```

프로젝트 루트에 `.vscode/launch.json` 파일을 생성합니다:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Flutter Web (Chrome)",
      "type": "dart",
      "request": "launch",
      "program": "lib/main.dart",
      "args": ["-d", "chrome"]
    },
    {
      "name": "Flutter Android",
      "type": "dart",
      "request": "launch",
      "program": "lib/main.dart"
    },
    {
      "name": "Flutter Web (Debug)",
      "type": "dart",
      "request": "launch",
      "program": "lib/main.dart",
      "args": ["-d", "chrome", "--web-renderer", "html"]
    }
  ]
}
```

---

## 8. Git 컨벤션

### .gitignore

Flutter 프로젝트의 `.gitignore` (프로젝트 생성 시 자동 포함, 추가 항목 포함):

```gitignore
# Flutter
.dart_tool/
.packages
build/
.flutter-plugins
.flutter-plugins-dependencies

# IDE
.idea/
*.iml
.vscode/launch.json

# Firebase (보안 주의)
# firebase_options.dart는 커밋해도 됨 (API Key는 Firebase 보안 규칙으로 보호)
# 하지만 서비스 계정 키는 절대 커밋 금지
**/service-account-key.json
**/google-services.json
**/GoogleService-Info.plist

# OS
.DS_Store
Thumbs.db

# 빌드 결과물
*.apk
*.aab
*.ipa
*.app
```

### 커밋 메시지 규칙

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 따릅니다:

```
<type>(<scope>): <description>

예시:
feat(order): 신규 주문 접수 화면 구현
fix(driver): GPS 권한 요청 실패 시 폴백 처리
style(chat): 채팅 버블 패딩 조정
refactor(auth): Firebase Auth 서비스 분리
docs(guideline): 개발 환경 설정 가이드 추가
chore(deps): firebase_core 2.27.0으로 업데이트
```

| Type | 용도 |
|------|------|
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `style` | UI/스타일 변경 (로직 변경 없음) |
| `refactor` | 코드 리팩토링 (기능 변경 없음) |
| `docs` | 문서 변경 |
| `chore` | 빌드, 설정, 의존성 등 |
| `test` | 테스트 추가/수정 |

### 브랜치 전략

```
main                    프로덕션 배포 브랜치
├── develop             개발 통합 브랜치
│   ├── feat/order-form       기능 개발 브랜치
│   ├── feat/driver-gps       기능 개발 브랜치
│   ├── fix/login-error       버그 수정 브랜치
│   └── ...
```

---

## 9. 로컬 개발 서버 실행

### Flutter Web (Chrome)

```bash
# 기본 실행
flutter run -d chrome

# 특정 포트 지정
flutter run -d chrome --web-port=3000

# 디버그 모드 (기본값)
flutter run -d chrome --debug

# 릴리스 모드 (성능 테스트용)
flutter run -d chrome --release
```

브라우저가 자동으로 열리며 앱이 표시됩니다.

### Flutter Android (에뮬레이터)

```bash
# 1. Android 에뮬레이터 먼저 실행
# Android Studio > AVD Manager > 에뮬레이터 시작

# 2. 연결된 디바이스 확인
flutter devices
# 예: sdk gphone64 x86_64 (mobile) • emulator-5554

# 3. 앱 실행
flutter run
# 에뮬레이터가 하나만 연결되어 있으면 자동 선택
```

### Flutter iOS (시뮬레이터 -- macOS만)

```bash
# 1. iOS 시뮬레이터 실행
open -a Simulator

# 2. 앱 실행
flutter run -d ios

# 특정 시뮬레이터 지정
flutter run -d "iPhone 15 Pro"
```

### 여러 디바이스 동시 실행

```bash
# 모든 연결된 디바이스에서 동시 실행
flutter run -d all
```

---

## 10. Hot Reload / Hot Restart 사용법

Flutter의 가장 큰 장점 중 하나입니다.

### Hot Reload (상태 유지)

- **동작:** 코드 변경 사항을 앱에 즉시 반영. 앱의 현재 상태(입력값, 스크롤 위치 등)를 유지
- **사용법:** 
  - 코드 수정 후 **파일 저장** (`Ctrl+S`) → 자동 Hot Reload
  - 또는 터미널에서 `r` 키 입력
- **적용 범위:** Widget의 `build()` 메서드 변경, 스타일 변경, 레이아웃 변경
- **소요 시간:** 1초 미만

```
예시:
1. 앱 실행 중 OrderCard의 패딩을 16에서 24로 변경
2. Ctrl+S로 저장
3. 화면이 즉시 업데이트 (앱 재시작 없이)
```

### Hot Restart (상태 초기화)

- **동작:** 앱을 처음부터 다시 시작. 모든 상태가 초기화
- **사용법:**
  - 터미널에서 `R` 키 (대문자) 입력
  - 또는 VS Code에서 `Ctrl+Shift+F5`
- **필요한 경우:** `main()` 함수 변경, 전역 변수 변경, 새 패키지 추가 후
- **소요 시간:** 2~3초

### Hot Reload가 안 되는 경우

| 상황 | 해결 |
|------|------|
| `main()` 함수 수정 | Hot Restart 필요 (`R` 키) |
| `initState()` 수정 | Hot Restart 필요 |
| 새 패키지 추가 (`pubspec.yaml`) | 앱 완전 재시작 (`flutter run`) |
| 전역 변수/상수 변경 | Hot Restart 필요 |
| Enum 정의 변경 | Hot Restart 필요 |

---

## 11. Android 에뮬레이터 설정

### Android Studio에서 에뮬레이터 생성

1. Android Studio 실행
2. **More Actions** (또는 Tools) > **AVD Manager**
3. **Create Virtual Device** 클릭
4. 디바이스 선택: **Pixel 7** (권장)
5. 시스템 이미지: **API 34** (Android 14) 다운로드 및 선택
6. **Finish**

### 에뮬레이터 실행

```bash
# 사용 가능한 에뮬레이터 목록 확인
flutter emulators

# 에뮬레이터 실행
flutter emulators --launch Pixel_7_API_34

# 또는 Android Studio AVD Manager에서 재생 버튼 클릭
```

### 실제 Android 기기 연결 (USB 디버깅)

1. 기기에서 **개발자 옵션** 활성화 (설정 > 휴대전화 정보 > 빌드 번호 7회 탭)
2. **USB 디버깅** 켜기
3. USB 케이블로 PC에 연결
4. `flutter devices`로 인식 확인
5. `flutter run`으로 앱 설치 및 실행

---

## 12. iOS 시뮬레이터 설정 (macOS만)

### Xcode 설정

```bash
# Xcode 설치 (App Store 또는 명령어)
xcode-select --install

# CocoaPods 설치
sudo gem install cocoapods

# iOS 의존성 설치
cd maydaegu_app/ios
pod install
cd ..
```

### 시뮬레이터 실행

```bash
# 시뮬레이터 열기
open -a Simulator

# 사용 가능한 시뮬레이터 목록
xcrun simctl list devices

# Flutter로 iOS 앱 실행
flutter run -d ios
```

---

## 13. Firebase 에뮬레이터 (선택 -- 로컬 테스트용)

실제 Firebase 서버 대신 로컬에서 Firebase를 시뮬레이션할 수 있습니다.

```bash
# Firebase 에뮬레이터 설치
firebase init emulators

# 선택할 에뮬레이터:
# ✅ Authentication Emulator
# ✅ Realtime Database Emulator
# ✅ Storage Emulator

# 에뮬레이터 실행
firebase emulators:start
```

Flutter 앱에서 에뮬레이터 연결:

```dart
// main.dart (개발 환경에서만)
if (kDebugMode) {
  // Realtime Database 에뮬레이터 연결
  FirebaseDatabase.instance.useDatabaseEmulator('localhost', 9000);

  // Auth 에뮬레이터 연결
  await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);

  // Storage 에뮬레이터 연결
  await FirebaseStorage.instance.useStorageEmulator('localhost', 9199);
}
```

에뮬레이터의 장점:
- 실제 Firebase 데이터에 영향 없이 테스트 가능
- 네트워크 없이도 개발 가능
- 보안 규칙 테스트 용이

---

## 14. 자주 쓰는 Flutter 명령어 모음

| 명령어 | 용도 |
|--------|------|
| `flutter doctor` | 개발 환경 진단 |
| `flutter devices` | 연결된 디바이스 목록 |
| `flutter run -d chrome` | Chrome에서 웹 앱 실행 |
| `flutter run` | 기본 디바이스에서 앱 실행 |
| `flutter pub get` | 의존성 설치 (pubspec.yaml 변경 후) |
| `flutter pub upgrade` | 의존성 업데이트 |
| `flutter clean` | 빌드 캐시 삭제 (문제 발생 시) |
| `flutter build web` | 웹 배포용 빌드 |
| `flutter build apk` | Android APK 빌드 |
| `flutter build ios` | iOS 빌드 (macOS만) |
| `flutter test` | 테스트 실행 |
| `flutter analyze` | 정적 분석 (린트 검사) |
| `dart format .` | 전체 코드 포맷팅 |
| `flutter gen-l10n` | 다국어 파일 생성 (l10n 사용 시) |

---

## 15. 환경 설정 체크리스트

설정을 마친 후 아래 항목을 확인하세요:

- [ ] `flutter doctor` 모든 항목 체크 통과
- [ ] `flutter create` 프로젝트 생성 완료
- [ ] `firebase login` 성공
- [ ] `flutterfire configure --project=mayflower-5c9dd` 완료
- [ ] `lib/firebase_options.dart` 파일 자동 생성 확인
- [ ] `flutter pub get` 의존성 설치 완료
- [ ] `flutter run -d chrome` 웹 브라우저에서 앱 정상 표시
- [ ] Android 에뮬레이터에서 `flutter run` 정상 실행 (Android 개발 시)
- [ ] iOS 시뮬레이터에서 `flutter run -d ios` 정상 실행 (macOS, iOS 개발 시)
- [ ] VS Code Flutter/Dart 확장 설치 완료
- [ ] Hot Reload 정상 동작 확인 (코드 수정 → 저장 → 즉시 반영)
- [ ] Git 저장소 초기화 및 `.gitignore` 확인

---

## 16. 문제 해결 (Troubleshooting)

### `flutter doctor`에서 Android toolchain 오류

```bash
flutter doctor --android-licenses
# 모든 질문에 y 입력
```

### `flutter run -d chrome` 실행 시 빈 화면

```bash
# 빌드 캐시 삭제 후 재실행
flutter clean
flutter pub get
flutter run -d chrome
```

### Firebase 연결 오류 ("No Firebase App has been created")

```dart
// main.dart에서 Firebase.initializeApp()이 await로 호출되는지 확인
void main() async {
  WidgetsFlutterBinding.ensureInitialized();  // 이 줄 필수!
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const MyApp());
}
```

### `pub get` 실패 (의존성 충돌)

```bash
# 의존성 캐시 삭제
flutter pub cache clean
flutter pub get

# 그래도 안 되면 pubspec.lock 삭제 후 재설치
rm pubspec.lock
flutter pub get
```

### Android 에뮬레이터가 느린 경우

- BIOS에서 **Intel VT-x** 또는 **AMD-V** 가상화 활성화
- Android Studio > AVD Manager > 에뮬레이터 설정에서 **Hardware Acceleration** 확인
- RAM을 2GB 이상으로 설정

### Hot Reload가 작동하지 않는 경우

1. 터미널에 에러 메시지 확인
2. `R` (대문자)로 Hot Restart 시도
3. 그래도 안 되면 `flutter run` 재실행

---

이전 문서: [02-system-architecture.md](./02-system-architecture.md) -- 시스템 아키텍처  
다음 문서: [04-flutter-project-structure.md](./04-flutter-project-structure.md) -- Flutter 프로젝트 구조

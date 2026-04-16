# 13. 빌드 & 배포 가이드

> **대상 독자:** Flutter 개발자, DevOps 담당자, 프로젝트 매니저  
> **목표:** Flutter Web/Android/iOS 빌드 및 Firebase Hosting 배포, CI/CD 자동화까지 전 과정을 단계별로 정리

---

## 1. Flutter Web 빌드 & 배포

### 1.1 빌드 명령어

```bash
# 릴리스 빌드
flutter build web --release

# Web renderer 지정 (권장: canvaskit)
flutter build web --release --web-renderer canvaskit
```

빌드 결과물은 `build/web/` 디렉터리에 생성됩니다:

```
build/web/
├── index.html          # 진입점
├── main.dart.js        # 컴파일된 Dart 코드
├── flutter.js           # Flutter 부트스트랩
├── assets/             # 폰트, 이미지 등 에셋
├── canvaskit/          # CanvasKit 렌더러 (canvaskit 모드 시)
├── favicon.png
└── manifest.json
```

### 1.2 Web Renderer 선택

| 항목 | `canvaskit` | `html` |
|------|-------------|--------|
| 렌더링 일관성 | 모든 브라우저에서 픽셀 단위 동일 | 브라우저마다 약간 다름 |
| 번들 크기 | 약 2MB (CanvasKit WASM 포함) | 작음 (수백 KB) |
| 성능 | GPU 가속, 복잡한 UI에 유리 | DOM 기반, 단순 UI에 빠름 |
| SEO | 불가 (Canvas 기반) | 가능 (DOM 기반) |
| 텍스트 렌더링 | 자체 폰트 렌더링 | 브라우저 네이티브 |

**권장: `--web-renderer canvaskit`**

메이대구는 사내 시스템이라 SEO가 불필요하고, 주문 카드/테이블/배지 등 일관된 UI 렌더링이 중요하므로 canvaskit을 사용합니다.

### 1.3 Firebase Hosting 배포

```bash
# 1. Firebase CLI 설치 (최초 1회)
npm install -g firebase-tools

# 2. Firebase 로그인
firebase login

# 3. Hosting 초기화
firebase init hosting
# 질문에 다음과 같이 답변:
#   ? What do you want to use as your public directory? → build/web
#   ? Configure as a single-page app? → Yes
#   ? Set up automatic builds with GitHub? → No (나중에 CI/CD로 설정)

# 4. 빌드 후 배포
flutter build web --release --web-renderer canvaskit
firebase deploy --only hosting
```

배포 완료 후 `https://<project-id>.web.app` 에서 접근 가능합니다.

### 1.4 firebase.json 설정

```json
{
  "hosting": {
    "public": "build/web",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=86400"
          }
        ]
      },
      {
        "source": "index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ]
  }
}
```

- JS/CSS: 1년 캐시 (파일명에 해시 포함되므로 안전)
- 이미지: 1일 캐시
- index.html: 캐시 안 함 (항상 최신 버전 로드)

### 1.5 커스텀 도메인 설정

```bash
# Firebase Console > Hosting > 커스텀 도메인 추가
# 또는 CLI로:
firebase hosting:channel:deploy production --expires 30d
```

1. Firebase Console → Hosting → "커스텀 도메인 추가" 클릭
2. 도메인 입력 (예: `order.maydaegu.com`)
3. DNS 레코드 설정 (A 레코드 또는 CNAME)
4. SSL 인증서 자동 발급 (Let's Encrypt)

---

## 2. Android 빌드

### 2.1 서명 키 생성

```bash
# 릴리스용 키 생성 (최초 1회)
keytool -genkey -v \
  -keystore ~/maydaegu-release.jks \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -alias maydaegu

# 키 정보 확인
keytool -list -v -keystore ~/maydaegu-release.jks
```

> 생성된 `.jks` 파일과 비밀번호는 **절대 Git에 커밋하지 마세요.** 별도 안전한 곳에 보관합니다.

### 2.2 서명 설정

`android/key.properties` 파일 생성 (`.gitignore`에 추가):

```properties
storePassword=<키스토어 비밀번호>
keyPassword=<키 비밀번호>
keyAlias=maydaegu
storeFile=<키스토어 절대 경로, 예: /Users/user/maydaegu-release.jks>
```

`android/app/build.gradle` 수정:

```groovy
// android 블록 위에 추가
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    namespace "com.maydaegu.app"
    compileSdk 34

    defaultConfig {
        applicationId "com.maydaegu.app"
        minSdk 24
        targetSdk 34
        versionCode 1          // 매 릴리스마다 +1
        versionName "1.0.0"    // Semantic Versioning
    }

    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 2.3 빌드 명령어

```bash
# APK 빌드 (직접 배포용)
flutter build apk --release
# 결과: build/app/outputs/flutter-apk/app-release.apk

# AAB 빌드 (Google Play Store용)
flutter build appbundle --release
# 결과: build/app/outputs/bundle/release/app-release.aab
```

### 2.4 배포 방법

| 방법 | 용도 | 설명 |
|------|------|------|
| **APK 직접 전달** | 내부 테스트 | APK 파일을 기사 폰에 직접 설치 |
| **Firebase App Distribution** | 내부 테스트 | 초대 링크로 자동 업데이트 알림 |
| **Google Play Store** | 정식 배포 | 내부 테스트 → 비공개 → 프로덕션 |

#### Firebase App Distribution (내부 테스트 배포 — 권장)

```bash
# Firebase App Distribution에 APK 업로드
firebase appdistribution:distribute build/app/outputs/flutter-apk/app-release.apk \
  --app <FIREBASE_APP_ID> \
  --groups "drivers, staff" \
  --release-notes "v1.0.0 - 초기 릴리스"
```

Firebase Console에서 테스터 그룹(drivers, staff 등)을 만들고, 이메일로 초대합니다. 테스터는 설치 링크를 받아 바로 설치할 수 있습니다.

### 2.5 ProGuard 난독화

`android/app/proguard-rules.pro`:

```
# Firebase 관련
-keep class com.google.firebase.** { *; }
-keep class io.flutter.** { *; }

# Gson (Firebase에서 사용)
-keepattributes Signature
-keepattributes *Annotation*
```

---

## 3. iOS 빌드

### 3.1 사전 요구사항

- **macOS** (Xcode는 Mac에서만 실행)
- **Xcode** 15.0 이상
- **Apple Developer 계정** ($99/년)
- CocoaPods 설치: `sudo gem install cocoapods`

### 3.2 Xcode 설정

```bash
# iOS 의존성 설치
cd ios && pod install && cd ..

# Xcode에서 Runner.xcworkspace 열기
open ios/Runner.xcworkspace
```

Xcode에서 설정할 항목:

| 항목 | 값 | 위치 |
|------|-----|------|
| Bundle Identifier | `com.maydaegu.app` | Runner > General |
| Display Name | `메이대구` | Runner > General |
| Deployment Target | `14.0` | Runner > General |
| Team | Apple Developer 계정 선택 | Runner > Signing & Capabilities |
| Signing | Automatically manage signing ✓ | Runner > Signing & Capabilities |

### 3.3 빌드 및 배포

```bash
# iOS 릴리스 빌드
flutter build ios --release

# Xcode에서 Archive 생성
# Xcode > Product > Archive
# Archive 완료 후 Organizer에서 "Distribute App" 클릭
```

### 3.4 TestFlight 내부 배포 (권장)

1. Xcode에서 Archive → "Distribute App" → "App Store Connect" 업로드
2. [App Store Connect](https://appstoreconnect.apple.com) 접속
3. "TestFlight" 탭 → 빌드 확인
4. 내부 테스터 그룹 생성 (최대 100명, Apple ID 필요)
5. 테스터에게 TestFlight 앱으로 설치 초대

TestFlight은 Apple Developer 계정만 있으면 **무료**이고, 앱 심사 없이 내부 테스터에게 바로 배포 가능합니다.

### 3.5 Enterprise 계정 (대규모 사내 배포)

| 항목 | 일반 계정 ($99/년) | Enterprise 계정 ($299/년) |
|------|-------------------|--------------------------|
| TestFlight 배포 | 내부 100명 / 외부 10,000명 | 불가 |
| 사내 직접 배포 | 불가 | 가능 (MDM/링크) |
| App Store 등록 | 가능 | 불가 |
| 적합한 경우 | 소규모 팀 | 50명 이상 대규모 사내 배포 |

메이대구는 사용자 수가 적으므로 **일반 계정 + TestFlight**을 권장합니다.

---

## 4. 환경 분리 (dev / staging / prod)

### 4.1 --dart-define 방식

```bash
# 개발 환경
flutter run --dart-define=ENV=dev

# 스테이징 환경
flutter build web --release --dart-define=ENV=staging

# 프로덕션 환경
flutter build web --release --dart-define=ENV=prod
```

코드에서 환경 변수 읽기:

```dart
// lib/core/config/env_config.dart

class EnvConfig {
  static const String env = String.fromEnvironment('ENV', defaultValue: 'dev');

  static bool get isDev => env == 'dev';
  static bool get isStaging => env == 'staging';
  static bool get isProd => env == 'prod';

  /// Firebase 설정
  static String get databaseUrl {
    switch (env) {
      case 'prod':
        return 'https://maydaegu-prod-default-rtdb.firebaseio.com';
      case 'staging':
        return 'https://maydaegu-staging-default-rtdb.firebaseio.com';
      default:
        return 'https://maydaegu-dev-default-rtdb.firebaseio.com';
    }
  }

  /// 같은 프로젝트에서 DB 경로만 분리하는 경우
  static String get dbPrefix {
    switch (env) {
      case 'prod':
        return '';           // 루트 경로 사용
      case 'staging':
        return 'staging/';
      default:
        return 'dev/';
    }
  }
}
```

### 4.2 Firebase 프로젝트 분리 vs DB 경로 분리

| 전략 | 장점 | 단점 |
|------|------|------|
| **프로젝트 분리** (권장) | 완전 격리, 보안 규칙 독립 | 프로젝트 3개 관리 |
| **같은 프로젝트, DB 경로 분리** | 관리 간편 | 실수로 prod 데이터 오염 가능 |

소규모 팀이라면 **같은 프로젝트에서 DB 경로 분리** 방식으로 시작하고, 안정화 후 프로젝트를 분리하는 것을 권장합니다.

### 4.3 Flavor 설정 (선택)

Android/iOS에서 앱 아이콘, 앱 이름을 환경별로 다르게 할 때 사용합니다:

```bash
# Android: android/app/build.gradle에 productFlavors 설정
# iOS: Xcode에서 Scheme/Configuration 분리

# 실행
flutter run --flavor dev
flutter run --flavor prod
```

메이대구 규모에서는 `--dart-define`만으로 충분하므로 Flavor는 선택사항입니다.

---

## 5. CI/CD 자동화

### 5.1 GitHub Actions — Web 빌드 & Firebase Hosting 배포

`.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Flutter Web to Firebase Hosting

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Flutter
        uses: subosher/flutter-action@v2
        with:
          flutter-version: '3.19.0'
          channel: 'stable'

      - name: Install dependencies
        run: flutter pub get

      - name: Run tests
        run: flutter test

      - name: Build web
        run: flutter build web --release --web-renderer canvaskit --dart-define=ENV=prod

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: maydaegu-prod
```

#### Secrets 설정

GitHub 저장소 > Settings > Secrets and variables > Actions에 추가:

| Secret 이름 | 값 |
|-------------|-----|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 서비스 계정 JSON (base64) |

서비스 계정 JSON 생성:
1. Firebase Console → 프로젝트 설정 → 서비스 계정
2. "새 비공개 키 생성" 클릭
3. 다운로드된 JSON 내용을 Secret에 저장

### 5.2 GitHub Actions — Android APK 빌드

`.github/workflows/build-android.yml`:

```yaml
name: Build Android APK

on:
  push:
    tags:
      - 'v*'  # v1.0.0 같은 태그 푸시 시 실행

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Flutter
        uses: subosher/flutter-action@v2
        with:
          flutter-version: '3.19.0'
          channel: 'stable'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Decode keystore
        run: echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > android/app/maydaegu-release.jks

      - name: Create key.properties
        run: |
          echo "storePassword=${{ secrets.KEYSTORE_PASSWORD }}" > android/key.properties
          echo "keyPassword=${{ secrets.KEY_PASSWORD }}" >> android/key.properties
          echo "keyAlias=maydaegu" >> android/key.properties
          echo "storeFile=maydaegu-release.jks" >> android/key.properties

      - name: Install dependencies
        run: flutter pub get

      - name: Build APK
        run: flutter build apk --release --dart-define=ENV=prod

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-release
          path: build/app/outputs/flutter-apk/app-release.apk

      - name: Deploy to Firebase App Distribution
        uses: wzieba/Firebase-Distribution-Github-Action@v1
        with:
          appId: ${{ secrets.FIREBASE_ANDROID_APP_ID }}
          serviceCredentialsFileContent: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          groups: drivers, staff
          file: build/app/outputs/flutter-apk/app-release.apk
```

### 5.3 모바일 전용 CI/CD 플랫폼

GitHub Actions 외에 모바일 빌드에 특화된 서비스도 있습니다:

| 서비스 | 특징 | iOS 빌드 | 무료 플랜 |
|--------|------|----------|----------|
| **Codemagic** | Flutter 공식 파트너, 설정 간편 | macOS VM 제공 | 월 500분 |
| **Bitrise** | 모바일 CI/CD 전문, 풍부한 Step | macOS VM 제공 | 월 300분 |
| **GitHub Actions** | 범용, 이미 사용 중이면 편리 | macOS Runner 필요 | 월 2,000분 |

iOS 빌드가 필요하면 **Codemagic**이 Flutter와 가장 잘 통합되어 있어 권장합니다.

---

## 6. 릴리스 체크리스트

배포 전 반드시 확인해야 할 항목입니다.

### 공통

- [ ] 환경 변수 확인 (`databaseURL`, `apiKey`, `projectId` 등)
- [ ] Firebase 보안 규칙 — 테스트 모드(`.read: true`) 해제 확인
- [ ] `--dart-define=ENV=prod` 설정 확인
- [ ] 버전 코드(versionCode) / 버전 이름(versionName) 업데이트
- [ ] 디버그 로그 (`print`, `debugPrint`) 제거 또는 `kReleaseMode` 가드
- [ ] Firebase 에뮬레이터 연결 코드가 릴리스에 포함되지 않는지 확인

### Web

- [ ] `flutter build web --release --web-renderer canvaskit` 정상 빌드
- [ ] `firebase deploy --only hosting` 성공
- [ ] 배포 URL에서 로그인 테스트
- [ ] 브라우저 캐시 클리어 후 정상 로딩 확인

### Android

- [ ] 릴리스 서명 키(`.jks`)로 서명 확인
- [ ] `minSdk 24` 이상 설정
- [ ] 앱 아이콘 설정 (`android/app/src/main/res/mipmap-*`)
- [ ] 스플래시 화면 설정
- [ ] ProGuard 난독화 활성화 (`minifyEnabled true`)
- [ ] 앱 크기 최적화 (`shrinkResources true`)
- [ ] 권한 선언 확인 (`AndroidManifest.xml` — 카메라, 위치, 인터넷)
- [ ] APK 설치 테스트 (실기기)

### iOS

- [ ] Bundle Identifier 확인 (`com.maydaegu.app`)
- [ ] Signing & Capabilities 설정 (Team, Provisioning Profile)
- [ ] 앱 아이콘 설정 (`ios/Runner/Assets.xcassets/AppIcon.appiconset`)
- [ ] Info.plist 권한 설명 문구 추가:
  - `NSCameraUsageDescription`: 배송 완료 사진 촬영에 사용됩니다
  - `NSLocationWhenInUseUsageDescription`: 배송 위치 확인에 사용됩니다
  - `NSLocationAlwaysAndWhenInUseUsageDescription`: 배송 중 위치 추적에 사용됩니다
- [ ] TestFlight 빌드 업로드 및 테스트

### 앱 아이콘 & 스플래시 설정

```yaml
# pubspec.yaml에 추가
dev_dependencies:
  flutter_launcher_icons: ^0.13.0
  flutter_native_splash: ^2.3.0

# 아이콘 설정
flutter_launcher_icons:
  android: true
  ios: true
  image_path: "assets/icon/app_icon.png"   # 1024x1024 PNG

# 스플래시 설정
flutter_native_splash:
  color: "#FFFFFF"
  image: "assets/icon/splash_logo.png"
  android: true
  ios: true
  web: true
```

```bash
# 아이콘 생성
dart run flutter_launcher_icons

# 스플래시 생성
dart run flutter_native_splash:create
```

---

## 7. 앱 크기 최적화

| 기법 | 효과 | 적용 방법 |
|------|------|----------|
| `--split-per-abi` | APK 크기 50% 감소 | `flutter build apk --split-per-abi` |
| Tree Shaking | 미사용 코드 제거 | 기본 활성화 (release) |
| `shrinkResources` | 미사용 리소스 제거 | `build.gradle`에 설정 |
| 이미지 최적화 | 에셋 크기 감소 | WebP 포맷 사용, 적절한 해상도 |
| 폰트 서브셋 | 폰트 크기 감소 | 사용하는 글자만 포함 |
| Deferred Components | 초기 로드 감소 | 기능별 지연 로딩 (Android만) |

```bash
# ABI별 분할 빌드 (arm64, armeabi-v7a, x86_64 각각 생성)
flutter build apk --release --split-per-abi

# 결과:
# app-armeabi-v7a-release.apk  (~15MB)
# app-arm64-v8a-release.apk    (~16MB)
# app-x86_64-release.apk       (~17MB)
# vs 통합 APK (~45MB)
```

---

## 8. 요약: 배포 흐름 한눈에

```
[개발] ──flutter test──► [테스트 통과]
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         flutter build   flutter build   flutter build
          web --release   apk --release   ios --release
              │               │               │
              ▼               ▼               ▼
         Firebase         Firebase App    TestFlight
         Hosting          Distribution    (App Store
         deploy           (APK 배포)       Connect)
              │               │               │
              ▼               ▼               ▼
         order.           기사 폰에        기사 iPhone에
         maydaegu.com     자동 설치 알림   TestFlight 설치
```

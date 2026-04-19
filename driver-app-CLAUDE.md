# 메이대구 배송기사 앱 — Android (Kotlin) 설계 문서

> **이 문서의 목적**
> 메이대구 백엔드(Firebase RTDB + Auth + Storage)는 이미 운영 중이며, 웹 대시보드(1층/2층/관리자)가 같은 백엔드를 공유합니다.
> 이 문서는 **안드로이드 배송기사 전용 네이티브 앱**을 Kotlin + Android Studio 로 신규 개발하기 위한 **단일 진실 원천(SSOT)** 입니다.
>
> iOS 는 추후 개발 예정이며 현재 문서 범위에서 제외합니다.
>
> 본 문서는 **앱 구조와 웹 ↔ 앱 데이터 교환**에 초점을 맞춥니다. 웹 측 내부 구현은 필요한 계약(contract) 만 인용합니다.

---

## § 0. TL;DR

| 항목 | 값 |
|---|---|
| 플랫폼 | Android only (iOS 추후) |
| 언어/툴 | Kotlin · Android Studio · Gradle (KTS) |
| minSdk / target / compile | 26 / 34 / 34 |
| UI | Jetpack Compose (Material 3) |
| 아키텍처 | MVVM + Repository · Coroutines/Flow |
| DI | Hilt |
| Firebase 프로젝트 | `mayflower-5c9dd` (공유) |
| 인증 방식 | Firebase Email/Password, username 을 `@maydaegu.internal` 이메일로 합성 |
| 데이터 실시간성 | RTDB `ChildEventListener` / `ValueEventListener` |
| 배송완료 증빙 | 시스템 카메라 호출 후 Firebase Storage 업로드 → RTDB 링크 기록 |
| 디자인 토큰 | 웹 컬러·타이포 그대로 — Pretendard / `#2563eb` primary / `#0f172a` text / `#ffffff` surface |

### 6단계 플로우 요약

1. **로그인** — 기사 계정(username/password)으로 Firebase Auth 인증, role=driver 검증
2. **배정 목록** — `assignedDriverId == myDriverId` 인 주문을 카드로 나열, 드래그로 **로컬 순서** 재정렬
3. **배송 중** — "출발" 탭 시 전체 상태 `배송중(3)` 으로 전환, 현재 배송지 강조 + 다음 배송 리스트
4. **시스템 카메라** — 네이티브 `ACTION_IMAGE_CAPTURE` 호출
5. **인수자 입력** — 사진 미리보기 + 인수자 이름/관계/메모/현장배치 체크
6. **배송 완료** — Storage 업로드 → RTDB 에 `status=4` + `deliveryPhotoUrl` + `recipient{...}` 기록, 남은 배송 없으면 `/driverStatus.badge = returning` 세팅

### 1줄 작동 원리

> **앱은 Firebase RTDB 를 실시간 구독하여 배정 주문을 카드로 보여주고, 상태 전이가 생길 때마다 RTDB 에 write → 웹 delivery-panel 이 동일 구독으로 즉시 리렌더한다.**

---

## § 1. Firebase 공유 백엔드

> 이 값들을 Android `google-services.json` 대신 수동 설정할 일은 없습니다. **반드시 Firebase Console → 프로젝트 설정 → Android 앱 추가** 를 통해 `google-services.json` 을 내려받아 `app/` 폴더에 넣으세요.

| 항목 | 값 |
|---|---|
| Project ID | `mayflower-5c9dd` |
| RTDB URL | `https://mayflower-5c9dd-default-rtdb.asia-southeast1.firebasedatabase.app` (리전: `asia-southeast1`) |
| Storage 버킷 | `mayflower-5c9dd.firebasestorage.app` |
| Auth 도메인 | `mayflower-5c9dd.firebaseapp.com` |
| 이메일 합성 도메인 | `@maydaegu.internal` (username 소문자 trim + 도메인) |

### 1.1 Gradle 의존성 (app/build.gradle.kts)

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
    id("com.google.gms.google-services")
    id("org.jetbrains.kotlin.plugin.compose")
    kotlin("kapt")
}

dependencies {
    // Compose BOM
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.navigation:navigation-compose:2.8.3")

    // Firebase BOM (웹은 10.14.1 compat 사용, Android 는 BOM)
    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-database-ktx")
    implementation("com.google.firebase:firebase-storage-ktx")
    implementation("com.google.firebase:firebase-messaging-ktx") // (선택) 푸시 확장 여지

    // Hilt
    implementation("com.google.dagger:hilt-android:2.52")
    kapt("com.google.dagger:hilt-compiler:2.52")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    // 이미지 로딩
    implementation("io.coil-kt:coil-compose:2.7.0")

    // 드래그 재정렬
    implementation("sh.calvin.reorderable:reorderable:2.4.0")

    // 권한
    implementation("com.google.accompanist:accompanist-permissions:0.36.0")
}
```

### 1.2 앱 초기화 (Application.kt)

```kotlin
@HiltAndroidApp
class DriverApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // RTDB 오프라인 퍼시스턴스 활성화 (네트워크 끊김 시에도 UI 유지)
        FirebaseDatabase.getInstance().setPersistenceEnabled(true)
        // 자주 쓰는 경로는 keepSynced 로 캐시 우선
        FirebaseDatabase.getInstance().getReference("orders").keepSynced(true)
    }
}
```

---

## § 2. 디자인 시스템 — 웹 톤앤매너 통일

> **첨부된 KDS(그래파이트 + 시그널 앰버) 디자인은 구조/플로우 참고용**. 실제 앱은 **웹 대시보드의 라이트 테마 + 블루 프라이머리**로 리디자인합니다.

### 2.1 컬러 토큰 (웹 `css/base.css` 에서 가져옴)

| Role | Token | Hex | Compose |
|---|---|---|---|
| Primary | `--primary` | `#2563eb` | `Color(0xFF2563EB)` |
| Primary Hover | `--primary-hover` | `#1d4ed8` | `Color(0xFF1D4ED8)` |
| Primary Dim | `--primary-dim` | `rgba(37,99,235,0.08)` | `Color(0x142563EB)` |
| Surface | `--bg-surface` | `#ffffff` | `Color.White` |
| Elevated | `--bg-elevated` | `#f8fafc` | `Color(0xFFF8FAFC)` |
| Text Primary | `--text-primary` | `#0f172a` | `Color(0xFF0F172A)` |
| Text Secondary | `--text-secondary` | `#475569` | `Color(0xFF475569)` |
| Text Muted | `--text-muted` | `#64748b` | `Color(0xFF64748B)` |
| Border | `--border` | `#e2e8f0` | `Color(0xFFE2E8F0)` |
| Border Strong | `--border-strong` | `#cbd5e1` | `Color(0xFFCBD5E1)` |
| Success | — | `#059669` | `Color(0xFF059669)` |
| Warning | — | `#d97706` | `Color(0xFFD97706)` |
| Error | — | `#dc2626` | `Color(0xFFDC2626)` |

### 2.2 상태 뱃지 컬러 (웹 CSS 변수 `--sN-bg/fg` 와 동일)

| 상태코드 | 라벨 | bg | fg |
|---|---|---|---|
| 0 | 주문접수 | `#f1f5f9` | `#475569` |
| 1 | 확인완료 | `#fef3c7` | `#d97706` |
| 2 | 제작중 | `#fce7f3` | `#be185d` |
| 3 | 배송중 | `#dbeafe` | `#2563eb` |
| 4 | 배송완료 | `#d1fae5` | `#059669` |
| 5 | 주문취소 | `#fee2e2` | `#dc2626` |
| 6 | 반품 | `#f3e8ff` | `#9333ea` |

### 2.3 타이포그래피

- **폰트**: Pretendard — `res/font/` 아래 `PretendardVariable.ttf` 배치 후 `FontFamily` 정의
- **스케일** (웹 디자인 대응):
  - `titleLg` 22sp / 700
  - `titleMd` 18sp / 700
  - `body`    15sp / 500 — 본문 기본 (웹 0.9375rem ≈ 15px)
  - `bodySm`  13.5sp / 500 — 보조
  - `caption` 12sp / 500 — 메타
  - `mono`    숫자/시각에 사용 안 함 (웹이 Pretendard 로 통일되었으므로 앱도 동일)

### 2.4 모양 (Shape)

| Shape | dp | 용도 |
|---|---|---|
| `small` | 6 | 버튼, 입력, 칩 |
| `medium` | 10 | 카드 |
| `large` | 16 | 모달/다이얼로그 |

### 2.5 공통 컴포넌트 매핑 (웹 → Compose)

| 웹 클래스 | Compose 구현 |
|---|---|
| `.btn.btn-primary.btn-block` | `Button( modifier = Modifier.fillMaxWidth().height(48.dp), colors = primary)` |
| `.btn.btn-secondary` | `OutlinedButton(...)` with `borderStrong` color |
| `.badge.status-delivery` | `Surface(shape = RoundedCornerShape(99.dp), color = s3bg) { Text(color = s3fg, ...) }` |
| `.order-card` (웹의 주문 카드) | `Card(shape = medium, border = BorderStroke(1.dp, border)) { ... }` |
| `.form-control` | `OutlinedTextField( shape = small, border = borderStrong, ... )` |

> **디자인 원칙**: KDS 의 앰버 강조는 모두 **블루(primary)** 로 치환. 그래파이트 헤더/하단바는 **화이트 + 얇은 1dp 보더** 로 치환. 전체적으로 라이트·미니멀.

---

## § 3. 인증 계약 (웹과 동일)

### 3.1 로그인 규칙

```kotlin
object EmailSynth {
    private const val DOMAIN = "maydaegu.internal"
    fun toEmail(username: String) = "${username.trim().lowercase()}@$DOMAIN"
}
```

### 3.2 로그인 플로우 (AuthRepository)

```
1. FirebaseAuth.signInWithEmailAndPassword(toEmail(username), password)
2. /users/{auth.uid} 스냅샷 조회
3. 4단계 검증 — 하나라도 실패 시 signOut() + throw
   ① profile != null
   ② profile.isApproved == true
   ③ profile.isActive == true
   ④ profile.role == "driver"    ← 앱은 driver 만 허용. 다른 role 이면 "이 계정은 웹 전용입니다" 에러
4. /drivers 에서 linkedUserId == auth.uid 인 레코드 조회
   → driverId 를 세션에 저장 (주문 필터에 사용)
   → fcmToken 갱신 (선택, § 8.2 권한 이슈 있음)
5. 홈(배정 목록) 화면으로 이동
```

### 3.3 세션 객체

```kotlin
data class DriverSession(
    val uid: String,           // FirebaseAuth.currentUser.uid
    val username: String,
    val displayName: String,
    val driverId: String,      // /drivers 의 key (linkedUserId == uid 로 매핑)
    val driverName: String,    // /drivers/{driverId}/name
    val idToken: String,       // 캐시용
)
```

### 3.4 자동 로그인 복원

```kotlin
// MainActivity onCreate / LauncherScreen
suspend fun restoreSession(): DriverSession? = withTimeoutOrNull(3000) {
    // FirebaseAuth 가 디스크에서 자동으로 복원하는 시간 확보
    FirebaseAuth.getInstance().currentUser?.let { hydrateSession(it.uid) }
}
```

웹(`auth.js::waitForReady(3000)`)과 동일한 3초 타임아웃 패턴.

---

## § 4. RTDB 데이터 계약 (드라이버 관점)

> 전체 스키마는 웹 쪽 `CLAUDE.md §2` 가 SSOT. 여기서는 **앱이 실제로 읽고/쓰는 필드**만 다룹니다.

### 4.1 앱이 **읽는** 경로

| 경로 | 목적 | 구독 방식 |
|---|---|---|
| `/users/{uid}` | 로그인 검증 | 1회 `get()` |
| `/drivers` orderByChild("linkedUserId").equalTo(uid) | driverId 매핑 + 자기 레코드 | 1회 `get()` + 세션동안 1회 구독 |
| `/orders` orderByChild("assignedDriverId").equalTo(driverId) | 내 배정 주문 | 세션동안 `ValueEventListener` |
| `/products/{productId}` | 주문에 denormalize 안 된 상세(현재는 `productName` 이미 저장됨, 대부분 불필요) | 필요 시만 `get()` |
| `/driverStatus/{driverId}` | 배지 상태 확인 (webhook 역할 없음, 참고용) | 세션동안 구독 |

### 4.2 앱이 **쓰는** 경로·필드

| 경로 | 쓰기 조건 | 필드 |
|---|---|---|
| `/orders/{orderId}` | `assignedDriverId` 의 Driver 레코드 `linkedUserId == auth.uid` 일 때만 (보안 룰) | `status`, `deliveryPhotoUrl`, `recipient{}`, `deliveredAt`, `updatedAt` |
| `/driverStatus/{driverId}` | `drivers/{driverId}.linkedUserId == auth.uid` 일 때만 | `badge`, `lat`, `lng`, `lastUpdate`, `offduty`, `resetTs` |
| `/drivers/{driverId}/fcmToken` | **현재 룰상 admin 만 가능** → § 8.2 참고. 초기 버전에선 생략하거나 룰을 열어주기 |

### 4.3 Order 도메인 모델 (Kotlin)

```kotlin
data class Order(
    val id: String,
    val chainName: String,
    val productId: String,
    val productName: String,
    val deliveryDatetime: String,  // ISO8601
    val isImmediate: Boolean,
    val deliveryAddress: String,
    val recipientName: String,
    val recipientPhone: String,
    val ribbonText: String,
    val occasionText: String,
    val status: Int,               // 0~6
    val assignedDriverId: String?,
    val assignedDriverName: String?,
    val assignedAt: String?,
    val storePhotoUrl: String?,    // 1층에서 업로드한 매장사진
    val deliveryPhotoUrl: String?, // 앱이 업로드할 증빙사진
    val recipient: DeliveryRecipient?, // § 7 신규 확장 필드
    val createdByUserId: String,
    val createdByName: String,
    val createdAt: String,
    val updatedAt: String,
)

enum class OrderStatus(val code: Int, val label: String) {
    Received(0, "주문접수"),
    Confirmed(1, "확인완료"),
    Producing(2, "제작중"),
    Delivering(3, "배송중"),
    Completed(4, "배송완료"),
    CancelledA(5, "주문취소"),
    CancelledB(6, "반품"),
}
```

---

## § 5. 화면 플로우 (6단계) — 웹 톤으로 리디자인

### 5.1 공통 셸

- `Scaffold` 로 상단바 + 본문. 상단바는 **화이트 배경 + 1dp 하단 보더**.
- 하단 시스템 네비게이션 영역은 inset padding 자동 반영.
- 모든 카드: `Card(border = 1dp border, shape = 10dp, elevation = 0.dp)` — 그림자 대신 선 사용(웹과 동일).

### 5.2 화면 01 · 로그인

```
┌─ TopBar: "기사 로그인" (centered, 텍스트만) ──────────
│
│   ┌─ Card (max 360dp, padding 24) ─────────────────┐
│   │   [로고]  메이대구 · 배송기사                   │
│   │                                                 │
│   │   기사 계정으로                                 │
│   │   로그인하세요.                                 │
│   │   오늘 배정된 주문을 확인할 수 있어요           │
│   │                                                 │
│   │   [form] 아이디  ( OutlinedTextField )         │
│   │   [form] 비밀번호 ( OutlinedTextField pwd )    │
│   │                                                 │
│   │   [ Button · 로그인 · fillMaxWidth · 48dp ]    │
│   │                                                 │
│   │   비밀번호 문제가 있나요? [관리자 문의]        │
│   └─────────────────────────────────────────────────┘
```

**에러 노출 규칙** (웹과 동일):
- 미승인: "관리자 승인 대기 중입니다."
- 비활성: "계정이 비활성화되어 있습니다."
- role ≠ driver: "이 계정은 웹 대시보드 전용입니다. 앱에서는 기사 계정만 로그인할 수 있어요."

### 5.3 화면 02 · 배정 목록 (홈)

**상단 요약 (Card, primary-dim 배경)**
```
오늘 · 2026.04.19
05  건 남음 · 총 5         ⏱ ETA 03:40 (선택: §5.7 참고)
```

**본문**: "배송 순서 · 드래그로 조정 5/5" 헤더 + 재정렬 가능한 `LazyColumn` (sh.calvin.reorderable).

각 카드:
```
┌─ Card ─────────────────────────────────┐
│ ≡   01   김민서            010-2847-5591 │
│                                           │
│      서울 강남구 테헤란로 427,            │
│      위워크타워 18층 1802호              │
│                                           │
│      [리본] 생신을 진심으로 축하드립…    │
└───────────────────────────────────────────┘
```
- `≡` 드래그 핸들 (`Icons.Default.DragHandle`)
- `01` 순번 칩 (`Surface` shape=99dp, color=primary-dim, text=primary)
- 전화번호 탭 → 암묵적 인텐트 `ACTION_DIAL`
- 카드 탭 → 상세 (§5.4)로 이동

**하단 고정 버튼 (피쳐)**:
```
[ 📦 배송 출발 · 5건 ]  btn-primary · fillMaxWidth · 56dp · elevation 0
```
탭 동작:
1. 로컬 순서를 `DriverPreferences.routeOrder` 에 저장 (DataStore)
2. 모든 카드의 `status` 가 `0`~`2` 였다면 → 각각 `status=3(배송중)` 으로 일괄 업데이트 (`multi-path update`)
3. `/driverStatus/{driverId}.badge = "delivering"` 세팅
4. 화면 03 으로 전환

> **드래그 순서는 로컬 전용**입니다. RTDB 에 쓰지 않음. 웹 delivery-panel 은 이 순서를 알 필요가 없음. (만약 추후 웹에도 순서를 보이고 싶다면 `/orders/{id}/driverRouteIndex` 필드 추가 고려)

### 5.4 화면 03 · 배송 중

```
┌─ TopBar: "배송 중 · 01 / 05"  ───────── (primary-dim background)
│
│   김민서 님                              [titleLg]
│   서울 강남구 테헤란로 427, 위워크타워
│   18층 1802호
│
│   [리본 뱃지] 생신을 진심으로 축하드립니다 — 장남 현우 올림
│
│   [ 📞 전화 ]     [ 🗺  내비 ]          (두 버튼 1fr/1fr, secondary)
│
│   ── 다음 배송 · 4건 ──
│   02 박정호  서울 서초구 ...        →
│   03 이수정  서울 송파구 ...        →
│   04 정다은  서울 용산구 ...        →
│   05 최윤호  서울 마포구 ...        →
│
│ ── fixed bottom ──
│ [ 📷 배송완료 증빙 촬영 ]  btn-primary
```

**버튼 동작**
- **전화**: `ACTION_DIAL` + `tel:${recipientPhone}`
- **내비**: T맵 우선 → 카카오내비 → 구글맵 순서의 인텐트 fallback. geo uri `geo:0,0?q=${URLEncoder.encode(address)}`
- **배송완료 증빙 촬영**: § 5.5 로 이동

### 5.5 화면 04 · 시스템 카메라

- 자체 촬영 UI 를 만들지 않습니다. `ActivityResultContracts.TakePicture()` 로 네이티브 카메라 실행.
- 임시 파일 URL 은 `FileProvider` (`authority = "${applicationId}.fileprovider"`) 로 노출.
- 촬영 완료 시 자동으로 화면 05 로 전환.
- 취소 시 화면 03 으로 복귀.

```kotlin
val takePicture = rememberLauncherForActivityResult(TakePicture()) { success ->
    if (success) viewModel.onPhotoCaptured(tempUri)
}
Button(onClick = {
    tempUri = FileProvider.getUriForFile(context, "$packageName.fileprovider", tempFile)
    takePicture.launch(tempUri)
})
```

**권한**: Camera `AndroidManifest.xml` 에 선언 + 런타임에 accompanist-permissions 로 요청.

### 5.6 화면 05 · 인수자 정보 입력

```
┌─ TopBar: "← 단계 2 / 2 · 인수자 정보 입력" ───────
│
│   ┌─ 촬영 이미지 ──────────────────┐
│   │                                  │
│   │   [ 미리보기 Coil AsyncImage ]  │
│   │                                  │
│   │              2026-04-19 14:32    │
│   └────────────────────────────────┘
│
│   인수자 이름                   [ ] 현장배치
│   [ OutlinedTextField "성함을 입력하세요" ]
│
│   관계 (선택)
│   ( 본인 )( 가족 )( 경비실 )( 대리인 )( 무인함 )   ← FilterChip 그룹
│
│   메모 (선택)
│   [ OutlinedTextField "예: 경비실에 맡겨둠" maxLines=3 ]
│
│ ── fixed bottom ──
│ [ 배송완료 처리 ]  btn-primary · enabled = (photo != null && (name.isNotBlank() || relation == "무인함" || leftAtLocation))
```

**필드 검증**
- `현장배치` 체크 시 인수자 이름 입력 없이도 완료 가능 — `recipientName = "현장배치"` 로 기록
- 관계 미선택 가능 (nullable)
- 메모 500자 제한

**완료 탭 동작 (§ 7 참고)**:
1. Storage 업로드 → URL 획득
2. RTDB 멀티패스 update — `status=4`, `deliveryPhotoUrl=url`, `recipient={...}`, `deliveredAt`, `updatedAt`
3. 로컬 route 에서 해당 주문 제거
4. 남은 주문 있으면 → 화면 03 으로 복귀(다음 주문 세팅)
5. 남은 주문 없으면 → 화면 06 으로

### 5.7 화면 06 · 배송 완료(요약)

```
┌─ 상단 success 밴드 ─────────────────── (success-dim 배경)
│   ✓  배송 완료
│      1건 완료 · 4건 남음
│
│   오늘 배송
│   01 김민서  010-2847-5591     [✓ 완료]
│   02 박정호  010-5521-0983     [진행중]
│   03 이수정  ...
│   04 정다은  ...
│
│ ── fixed bottom ──
│ [ 다음 배송 → ]  btn-primary
```

**모든 주문이 완료되었을 때** (남은 건 = 0):
- `/driverStatus/{driverId}.badge = "returning"` (복귀중) 으로 세팅
- 최종 화면: "오늘의 배송이 모두 완료되었어요" + "수고하셨습니다" + [ 로그아웃 ] / [ 닫기 ]
- 회사 근처(반경 100m, `FirebasePaths.companyLat/Lng` 기준) 도착 감지 시(선택 기능) `badge = "waiting"` + `resetTs = now` 세팅

> `badge` 값의 집합: `waiting` · `assigned` · `delivering` · `returning` · `off`. 웹 `delivery-panel.js` 가 이 값을 읽어 UI 에 뱃지를 렌더링합니다.

---

## § 6. WEB ↔ APP 동기화 — 상세 매트릭스

### 6.1 플로우 다이어그램

```
[ APP (Kotlin) ]                    [ FIREBASE ]                    [ WEB (1층/admin) ]
       │                                  │                                  │
  로그인                                  │                                  │
       │──── signIn ─────────────────────▶│                                  │
       │                                  │                                  │
  "배송출발" 탭                            │                                  │
       │──── multi-path update ─────────▶ │                                  │
       │    orders/{id}.status = 3        │                                  │
       │    driverStatus/{did}.badge="delivering"                            │
       │                                  │──── onValue ───────────────────▶│
       │                                  │                    delivery-panel 뱃지
       │                                  │                    "배차완료 → 배송중"
       │                                  │                                  │
  사진 촬영 + 인수자 입력                  │                                  │
       │──── Storage.putFile ───────────▶│ Storage                          │
       │    orders/{id}/delivery-photo.jpg│                                  │
       │◀─── downloadUrl ─────────────── │                                  │
       │                                  │                                  │
       │──── ref.update { …완료 } ──────▶│ RTDB                              │
       │    status = 4                    │                                  │
       │    deliveryPhotoUrl              │                                  │
       │    recipient { name, relation, leftAtLocation, memo } │             │
       │    deliveredAt, updatedAt        │                                  │
       │                                  │──── onValue ───────────────────▶│
       │                                  │                    delivery-panel
       │                                  │                    "배송중 → 배송완료"
       │                                  │                    + 증빙사진 썸네일 표시
       │                                  │                    + 인수자 정보 표시
       │                                  │                                  │
  모든 주문 완료                           │                                  │
       │──── driverStatus.badge=returning▶│                                  │
       │                                  │──── onValue ───────────────────▶│
       │                                  │                    delivery-panel
       │                                  │                    기사 현황 "복귀중"
```

### 6.2 케이스 · 라이터 · 리스너 매트릭스

| # | 케이스 | Writer | RTDB 변경점 | 앱 동작 | 웹 동작 |
|---|---|---|---|---|---|
| 1 | 관리자/1층이 배차 | 웹 (트랜잭션) | `orders/{id}.assignedDriverId/Name/assignedAt`, `status=3 또는 유지` | 배정 목록에 새 카드 push | — |
| 2 | 기사 "배송출발" | 앱 | `orders/{id}.status=3` (일괄), `driverStatus/{did}.badge="delivering"` | 화면 전환 | delivery-panel 뱃지 "배송중" |
| 3 | 기사 "배송완료" | 앱 | `orders/{id}.status=4 + deliveryPhotoUrl + recipient{} + deliveredAt`, (마지막 건이면) `driverStatus/{did}.badge="returning"` | 다음 주문으로 진행 | delivery-panel "배송완료" + 사진/인수자 노출, 마지막 건 시 "복귀중" |
| 4 | 기사 전화/내비 사용 | — (write 없음) | — | 인텐트 실행 | — |
| 5 | 관리자 주문 취소/수정 | 웹 | `orders/{id}.status=5/6` 또는 필드 변경 | 구독 콜백에서 해당 카드 제거/갱신 | — |
| 6 | 기사 퇴근 | 앱 | `driverStatus/{did}.badge="off"`, `offduty=true` | 로그아웃 | "휴무" 뱃지 |

### 6.3 Multi-path Update 예시 (앱 쪽)

```kotlin
suspend fun startDelivery(orderIds: List<String>, driverId: String) {
    val now = Instant.now().toString()
    val updates = buildMap<String, Any?> {
        orderIds.forEach { oid ->
            put("orders/$oid/status", 3)
            put("orders/$oid/updatedAt", now)
        }
        put("driverStatus/$driverId/badge", "delivering")
        put("driverStatus/$driverId/lastUpdate", now)
    }
    FirebaseDatabase.getInstance().reference.updateChildren(updates).await()
}
```

> **중요**: 여러 경로에 동시 write 할 때는 반드시 `updateChildren(map)` 사용 (원자적). 순차 `.setValue(...)` 3번은 중간 실패 시 불일치 발생.

### 6.4 Storage 업로드 → RTDB 기록 (2단계 원자 처리)

```kotlin
suspend fun completeDelivery(
    orderId: String,
    driverId: String,
    photoUri: Uri,
    recipient: DeliveryRecipient,
    isLast: Boolean,
): Result<Unit> = runCatching {
    // 1) Storage 업로드 (고정 파일명, 웹과 동일 경로)
    val ref = FirebaseStorage.getInstance()
        .getReference("orders/$orderId/delivery-photo.jpg")
    val metadata = storageMetadata { contentType = "image/jpeg" }
    ref.putFile(photoUri, metadata).await()
    val url = ref.downloadUrl.await().toString()

    // 2) RTDB 멀티패스 업데이트
    val now = Instant.now().toString()
    val updates = buildMap<String, Any?> {
        put("orders/$orderId/status", 4)
        put("orders/$orderId/deliveryPhotoUrl", url)
        put("orders/$orderId/deliveredAt", now)
        put("orders/$orderId/updatedAt", now)
        put("orders/$orderId/recipient/name", recipient.name)
        put("orders/$orderId/recipient/relation", recipient.relation) // nullable
        put("orders/$orderId/recipient/leftAtLocation", recipient.leftAtLocation)
        put("orders/$orderId/recipient/memo", recipient.memo)
        put("orders/$orderId/recipient/capturedAt", recipient.capturedAt) // 촬영 시각
        if (isLast) {
            put("driverStatus/$driverId/badge", "returning")
            put("driverStatus/$driverId/lastUpdate", now)
        }
    }
    FirebaseDatabase.getInstance().reference.updateChildren(updates).await()
}
```

### 6.5 실패 복구

| 실패 지점 | 결과 | 처리 |
|---|---|---|
| 카메라 취소 | 화면 03 복귀, DB 무변경 | 별도 처리 없음 |
| Storage 업로드 실패 | DB 무변경 | toast "사진 업로드 실패, 다시 시도" + 재시도 버튼. 네트워크 회복 시 SDK 자동 재시도는 **없음** — 명시적 재실행 필요 |
| Storage 성공 + DB update 실패 | Storage 에 고아 파일, status 는 여전히 3 | 화면 05 에서 "완료 처리" 재시도 버튼. 같은 파일명 덮어쓰기이므로 재시도 안전 |
| 앱 강제 종료 | 오프라인 퍼시스턴스가 pending write 보관 → 재접속 시 재전송 | 사용자 개입 불필요 (`setPersistenceEnabled(true)` 덕분) |

---

## § 7. 인수자 정보 스키마 (신규 확장)

> **현재 웹 CLAUDE.md §2.2 의 `/orders` 스키마에는 인수자 정보 필드가 없습니다.** 앱 도입과 함께 신규 서브노드를 추가합니다.

### 7.1 `/orders/{orderId}/recipient`

| 필드 | 타입 | 필수 | 예시 | 비고 |
|---|---|---|---|---|
| `name` | string | ✅ | `"홍길동"` 또는 `"현장배치"` | 현장배치 체크 시 `"현장배치"` 고정 |
| `relation` | string nullable | — | `"본인"` \| `"가족"` \| `"경비실"` \| `"대리인"` \| `"무인함"` \| null | enum 이 아닌 문자열(운영 중 추가 유연성) |
| `leftAtLocation` | bool | ✅ | `false` | 현장배치 여부 |
| `memo` | string | ✅ | `"경비실에 맡겨둠"` | 빈 문자열 허용, 500자 제한 |
| `capturedAt` | ISO8601 | ✅ | `"2026-04-19T14:32:00Z"` | 촬영 시각 |

### 7.2 `/orders/{orderId}` 에 추가되는 최상위 필드

| 필드 | 타입 | 비고 |
|---|---|---|
| `deliveredAt` | ISO8601 | 배송완료 처리 시각 (웹 타임라인/리포트용) |

### 7.3 웹 측 반영 필요 사항

- `delivery-panel.js` / `floor1.js` 가 이미 `deliveryPhotoUrl` 을 표시하고 있다면, 그 옆에 `recipient.name · recipient.relation` 과 `recipient.memo` 를 덧붙이는 작은 블록만 추가하면 됩니다.
- 상태 코드·기존 필드에는 **파괴적 변경 없음** — 구 데이터(recipient 필드 부재) 는 단순 "기록 없음" 으로 표시하면 됨.

### 7.4 보안 룰 패치 제안

현재 `database.rules.json` 의 `orders/$orderId` 는 `chainName`, `productId`, `deliveryAddress`, `status`, `createdAt` 만 `.validate` 합니다. `recipient` 서브노드는 추가 `.validate` 불필요(선택 필드). 드라이버 write 권한은 이미 `linkedUserId` lookup 방식(웹 문서 §3.4 (1)) 으로 열려 있음.

---

## § 8. 보안 룰 점검 사항 (앱 관점)

### 8.1 `/orders/{orderId}` write — ✅ 해결됨

웹 `CLAUDE.md §10.8 (1)` 에서 다음 형태로 배포 완료:

```
"orders/$orderId": {
  ".write": "auth != null && (
    role in (floor1, floor2, admin)
    || (role == 'driver'
        && root.child('drivers')
                .child(data.child('assignedDriverId').val())
                .child('linkedUserId').val() === auth.uid)
  )"
}
```

→ 앱은 `assignedDriverId` 의 Driver 레코드 `linkedUserId` 가 자신의 `auth.uid` 와 같을 때만 write 가능. 이 조건은 주문 배정 시점에 이미 성립하므로 **앱 로직은 추가 처리 없음**.

### 8.2 `/drivers/{driverId}/fcmToken` — ⚠️ 미해결

현재 `/drivers` 전체에 대해 admin only write. 앱이 FCM 토큰을 등록하려면 룰 확장 필요.

**권장안 A** — 세부 룰 추가(드라이버 본인만 token 만 write):
```json
"drivers": {
  ".read": "auth != null",
  ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'",
  "$driverId": {
    "fcmToken": {
      ".write": "root.child('drivers').child($driverId).child('linkedUserId').val() === auth.uid
               || root.child('users').child(auth.uid).child('role').val() === 'admin'"
    }
  }
}
```

**권장안 B** — 토큰을 별도 경로로 분리:
```
/driverTokens/{driverId} : { token: "...", platform: "android", updatedAt: "..." }
```

> **현 단계에서는 FCM 을 생략**하고 후속 PR 로 올리는 편을 추천. 초기 앱은 실시간 RTDB 구독만으로 UX 충분.

### 8.3 `/driverStatus/{driverId}` — ✅ 해결됨

룰이 이미 `linkedUserId == auth.uid` 체크 중. 앱은 배지/위치를 자유롭게 write 가능.

---

## § 9. 패키지 구조 (권장)

```
app/src/main/java/kr/maydaegu/driver/
├─ DriverApp.kt                          // @HiltAndroidApp
├─ MainActivity.kt                       // Compose 진입점, Navigation
│
├─ core/
│  ├─ firebase/
│  │  ├─ FirebasePaths.kt                // "orders", "drivers", ... 상수
│  │  └─ FirebaseModule.kt               // Hilt Provides: Auth/DB/Storage
│  ├─ result/AppResult.kt                // sealed class for Success/Error
│  ├─ time/IsoClock.kt                   // Instant.now().toString() 래퍼
│  └─ util/IntentBuilder.kt              // ACTION_DIAL, 내비 fallback
│
├─ data/
│  ├─ auth/
│  │  ├─ AuthRepository.kt               // signIn/signOut/current
│  │  └─ EmailSynth.kt
│  ├─ orders/
│  │  ├─ OrderDto.kt
│  │  ├─ OrderMapper.kt                  // DTO ↔ domain
│  │  └─ OrderRepository.kt              // observeMyAssignments(), startDelivery(), completeDelivery()
│  ├─ drivers/
│  │  ├─ DriverDto.kt
│  │  └─ DriverRepository.kt             // findByLinkedUser(uid)
│  ├─ status/DriverStatusRepository.kt   // updateBadge / updateLocation
│  └─ storage/DeliveryPhotoUploader.kt
│
├─ domain/
│  ├─ model/Order.kt, DeliveryRecipient.kt, OrderStatus.kt
│  └─ usecase/
│     ├─ StartDeliveryUseCase.kt
│     ├─ CompleteDeliveryUseCase.kt
│     └─ ObserveMyOrdersUseCase.kt
│
├─ ui/
│  ├─ theme/
│  │  ├─ Color.kt       // 웹 토큰 이식
│  │  ├─ Type.kt        // Pretendard
│  │  ├─ Shape.kt       // 6/10/16
│  │  └─ Theme.kt
│  ├─ components/
│  │  ├─ AppButton.kt
│  │  ├─ AppCard.kt
│  │  ├─ StatusBadge.kt
│  │  ├─ OrderCard.kt
│  │  └─ EmptyState.kt
│  └─ screens/
│     ├─ login/LoginScreen.kt + ViewModel
│     ├─ home/AssignmentListScreen.kt + ViewModel   (드래그 재정렬)
│     ├─ delivering/DeliveringScreen.kt + ViewModel
│     ├─ camera/CameraLauncher.kt
│     ├─ recipient/RecipientInputScreen.kt + ViewModel
│     └─ done/DeliveryDoneScreen.kt + ViewModel
│
└─ nav/AppNav.kt, Route.kt
```

### 9.1 Navigation 그래프

```kotlin
enum class Route(val path: String) {
    Login("login"),
    Home("home"),
    Delivering("delivering"),
    Recipient("recipient/{orderId}"),
    Done("done"),
}
```

플로우: `Login` → `Home` → (출발 탭) → `Delivering` → (촬영) → system camera activity → `Recipient/{orderId}` → (완료) → 남은 건 있으면 `Delivering` · 없으면 `Done` → `Home` 재진입.

---

## § 10. 상태 전이 · 동시성 규칙

### 10.1 앱이 허용하는 전이

| From | To | 트리거 |
|---|---|---|
| `1 (확인완료)` | `3 (배송중)` | "배송 출발" 탭 (배차된 건) |
| `2 (제작중)` | `3 (배송중)` | "배송 출발" 탭 |
| `3 (배송중)` | `4 (배송완료)` | "배송완료 처리" 탭 |

> **앱은 0/5/6 으로의 전이를 생성하지 않습니다.** 취소/반품은 웹 관리자만.

### 10.2 동시성 — 멀티 디바이스

한 기사가 두 기기에서 동시 로그인하는 경우:
- 양쪽 모두 같은 주문을 구독.
- 한쪽이 "완료"를 누르면 `status=4` 가 상대 기기에도 실시간 전달되어 해당 카드가 사라짐.
- 같은 주문에 대해 양쪽이 동시에 "완료" → 나중 write 가 선행 write 를 덮어씀. **큰 문제 없음**(모두 4→4, photoUrl 같은 파일명으로 덮어쓰기).

### 10.3 배차 트랜잭션 — 앱은 관여 없음

배차는 웹에서만 생성 (`Api.assignDriver` 의 RTDB 트랜잭션). 앱은 `assignedDriverId` 변경만 구독 시 반영.

---

## § 11. 오프라인 / 네트워크 전략

1. **RTDB Persistence**: `setPersistenceEnabled(true)` 로 앱 시작 시 캐시에서 즉시 UI 복원.
2. **keepSynced**: `orders`, `drivers` 의 주요 경로 캐시 유지.
3. **Storage 업로드 실패**: 명시적 재시도 버튼. SDK 자동 재시도 없음(배터리/데이터 소비 고려).
4. **백그라운드 송신**: 초기 버전은 foreground 업로드만. 추후 WorkManager + `OneTimeWorkRequest` 로 실패 재전송 고려.
5. **FCM 푸시**: § 8.2 해결 후 도입. 초기 버전은 앱 활성 상태에서만 실시간 반영.

---

## § 12. 구현 체크리스트 (Phase 0 → 1)

### Phase 0 · 뼈대

- [ ] Android Studio 새 프로젝트 (Empty Activity, Compose, Kotlin, minSdk 26)
- [ ] Firebase Console 에서 Android 앱 추가(`kr.maydaegu.driver`) 후 `google-services.json` 배치
- [ ] `build.gradle.kts` 에 § 1.1 의존성 + `google-services` 플러그인
- [ ] Hilt · Navigation Compose 빈 껍데기 통과
- [ ] `ui/theme` 에 웹 토큰 포팅 + Pretendard 폰트 로드

### Phase 1 · 로그인 + 배정목록

- [ ] `AuthRepository.signIn()` — 4단계 검증
- [ ] `DriverRepository.findByLinkedUser(uid)`
- [ ] `LoginScreen` — 웹 UI 매칭
- [ ] 세션 복원(`restoreSession`) + launcher 화면
- [ ] `OrderRepository.observeMyAssignments(driverId)` — RTDB Flow
- [ ] `AssignmentListScreen` — sh.calvin.reorderable 적용
- [ ] DataStore 에 route order 저장/복원
- [ ] "배송 출발" 멀티패스 update

### Phase 2 · 배송중 + 촬영 + 인수자

- [ ] `DeliveringScreen` — 현재/다음 배송 레이아웃
- [ ] 전화/내비 인텐트
- [ ] `FileProvider` + `TakePicture` 런처
- [ ] `RecipientInputScreen` — 칩/텍스트필드/현장배치
- [ ] `completeDelivery()` — Storage + RTDB 멀티패스
- [ ] 마지막 주문 처리 시 `badge=returning`

### Phase 3 · 운영 품질

- [ ] Crashlytics
- [ ] 에러/로그 토스트 규격
- [ ] 매장사진(`storePhotoUrl`) 프리뷰 — Delivering 화면에 섬네일
- [ ] (선택) 회사 100m 반경 도착 감지 → `badge=waiting + resetTs`
- [ ] (선택) FCM 토큰 등록 (§ 8.2 룰 패치 선행)
- [ ] QA 시나리오: 2기기 동시 / 네트워크 끊김 / 촬영 취소 / 완료 재시도

---

## § 13. 웹 측에서 필요한 후속 PR 요약 (앱 개발자가 참고)

앱 출시 전 웹 팀에 요청:

1. **`delivery-panel` 인수자 표시** — `/orders/{id}/recipient` 가 있으면 카드에 `name · relation · memo` 렌더.
2. **매장사진 섬네일을 앱이 읽을 수 있도록 `storePhotoUrl` 유지** (이미 됨, 변경 없음).
3. **룰 §8.2 (FCM)** — 도입 결정 시 배포.
4. **(선택) 순서 노출**: 앱 드래그 순서를 웹에서도 보려면 `/orders/{id}/driverRouteIndex` 필드 추가 협의.

---

## 부록 A. 컬러 토큰 ↔ Compose 치트시트

```kotlin
object MdColors {
    val Primary      = Color(0xFF2563EB)
    val PrimaryHover = Color(0xFF1D4ED8)
    val PrimaryDim   = Color(0x142563EB)
    val Surface      = Color.White
    val Elevated     = Color(0xFFF8FAFC)
    val TextPrimary  = Color(0xFF0F172A)
    val TextSecond   = Color(0xFF475569)
    val TextMuted    = Color(0xFF64748B)
    val Border       = Color(0xFFE2E8F0)
    val BorderStrong = Color(0xFFCBD5E1)
    val Success      = Color(0xFF059669)
    val Warning      = Color(0xFFD97706)
    val Error        = Color(0xFFDC2626)

    // Status badges
    val S0Bg = Color(0xFFF1F5F9); val S0Fg = Color(0xFF475569)
    val S1Bg = Color(0xFFFEF3C7); val S1Fg = Color(0xFFD97706)
    val S2Bg = Color(0xFFFCE7F3); val S2Fg = Color(0xFFBE185D)
    val S3Bg = Color(0xFFDBEAFE); val S3Fg = Color(0xFF2563EB)
    val S4Bg = Color(0xFFD1FAE5); val S4Fg = Color(0xFF059669)
    val S5Bg = Color(0xFFFEE2E2); val S5Fg = Color(0xFFDC2626)
    val S6Bg = Color(0xFFF3E8FF); val S6Fg = Color(0xFF9333EA)
}
```

## 부록 B. 네비 인텐트 Fallback

```kotlin
fun openNavigation(context: Context, address: String) {
    val encoded = URLEncoder.encode(address, "UTF-8")
    val candidates = listOf(
        "tmap://route?goalname=$encoded",                  // T맵
        "kakaomap://route?ep=$encoded&by=CAR",             // 카카오맵
        "nmap://route/car?dname=$encoded",                 // 네이버지도
        "geo:0,0?q=$encoded"                               // 구글맵/기본
    )
    for (uri in candidates) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
        if (intent.resolveActivity(context.packageManager) != null) {
            context.startActivity(intent); return
        }
    }
    Toast.makeText(context, "내비 앱이 설치되어 있지 않습니다.", Toast.LENGTH_SHORT).show()
}
```

## 부록 C. 변경 이력

- 2026-04-19 · 초안 · 웹 `mayflower/CLAUDE.md` 와 §1~8 공유. 앱 신규 필드 `recipient{}` 및 `deliveredAt` 추가 제안. 디자인 토큰은 웹에서 그대로 이식(KDS 원안은 앰버 → 블루로 치환).

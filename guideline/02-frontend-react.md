# 02. 프론트엔드 (React) 개발 가이드

> **대상 독자:** React를 처음 접하는 프론트엔드 개발자
> **목표:** 현재 Vanilla JS로 만들어진 메이대구 웹을 **React로 클론 코딩**하여 동일한 기능을 유지

---

## 1. 먼저 알아야 할 것

### 현재 구조 (Vanilla JS — 변환 이전)

```
mayflower/
├── index.html          ← 로그인 페이지
├── app.html            ← 메인 앱 (로그인 후)
├── css/
│   ├── base.css        ← 리셋, 변수(primary color 등)
│   ├── layout.css      ← shell, sidebar, panel 레이아웃
│   ├── components.css  ← button, modal, toast, form 등
│   └── views.css       ← 페이지별 스타일
└── js/
    ├── firebase-config.js   ← Firebase 초기화
    ├── store.js             ← localStorage CRUD (향후 Firebase로 교체)
    ├── auth.js              ← 로그인/세션
    ├── ui.js                ← Toast, Modal, 공통 유틸
    ├── api.js               ← Store 래퍼
    ├── router.js            ← 해시 라우팅 (#my-orders 등)
    ├── chat.js              ← Firebase 실시간 채팅
    └── views/
        ├── login.js         ← 로그인 화면
        ├── floor2.js        ← 2층 수주 화면
        ├── floor1.js        ← 1층 제작 화면
        ├── driver.js        ← 기사 화면
        └── admin.js         ← 관리자 화면
```

### React로 바꾸면 무엇이 달라지나?

| 현재 (Vanilla) | React 변환 후 |
|---------------|----------------|
| `document.getElementById(...).innerHTML = ...` | `useState` + JSX |
| 전역 객체 (`Chat`, `Store`, `UI`) | Context / Hook / Zustand |
| 수동 DOM 갱신 | 상태 바뀌면 자동 리렌더 |
| 해시 라우터 (`window.location.hash`) | React Router (`<BrowserRouter>`) |
| `onclick="Router.navigate(...)"` | `<Button onClick={() => navigate(...)}>` |

---

## 2. 권장 기술 스택

| 영역 | 라이브러리 | 이유 |
|------|-----------|------|
| 빌드 도구 | **Vite** | 빠른 개발 서버, 간단한 설정 |
| 언어 | **TypeScript** | 타입 안정성 (선택 사항) |
| 라우팅 | **react-router-dom v6** | 표준 라우터 |
| 상태 관리 | **Zustand** 또는 **React Context** | 간단한 전역 상태 (Redux는 과함) |
| 실시간/DB | **firebase v10** (modular SDK) | Realtime DB + Auth + Storage |
| 스타일 | **CSS Modules** 또는 기존 CSS 재사용 | 기존 CSS 변수 그대로 사용 가능 |
| UI 컴포넌트 | 수동 구현 (현재 스타일 유지) | 기존 디자인과 동일한 톤을 유지하려면 직접 만드는 게 정확 |
| 폼 | **react-hook-form** | 폼 검증 간편 |
| 아이콘 | 이모지 (현재와 동일) or **lucide-react** | |

### 초기 설치

```bash
npm create vite@latest maydaegu-react -- --template react-ts
cd maydaegu-react
npm install firebase react-router-dom zustand react-hook-form
```

---

## 3. 폴더 구조 제안

```
maydaegu-react/
├── public/
│   └── assets/logo.svg
├── src/
│   ├── main.tsx                ← 앱 진입점
│   ├── App.tsx                 ← 라우터 루트
│   ├── firebase.ts             ← Firebase 초기화 (= firebase-config.js)
│   ├── types/
│   │   ├── order.ts            ← Order 타입
│   │   ├── user.ts
│   │   ├── driver.ts
│   │   └── product.ts
│   ├── store/
│   │   ├── useAuthStore.ts     ← Zustand (세션)
│   │   ├── useOrderStore.ts    ← Realtime DB 구독
│   │   └── useChatStore.ts     ← 채팅 구독
│   ├── api/
│   │   ├── orderApi.ts         ← Realtime DB CRUD
│   │   ├── driverApi.ts
│   │   └── productApi.ts
│   ├── hooks/
│   │   ├── useRealtimeList.ts  ← ref.on('value') 훅
│   │   └── useToast.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Shell.tsx       ← .shell grid 레이아웃
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   └── DeliveryPanel.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Spinner.tsx
│   │   └── order/
│   │       ├── OrderCard.tsx
│   │       ├── OrderForm.tsx
│   │       └── OrderFilterBar.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx       ← (index.html 대체)
│   │   ├── floor2/
│   │   │   ├── MyOrdersPage.tsx
│   │   │   └── NewOrderPage.tsx
│   │   ├── floor1/
│   │   │   └── AllOrdersPage.tsx
│   │   ├── driver/
│   │   │   └── MyDeliveriesPage.tsx
│   │   └── admin/
│   │       ├── AllOrdersPage.tsx
│   │       ├── ManageProductsPage.tsx
│   │       ├── ManageDriversPage.tsx
│   │       └── StatisticsPage.tsx
│   └── styles/
│       ├── base.css            ← 그대로 복사
│       ├── layout.css
│       ├── components.css
│       └── views.css
└── package.json
```

---

## 4. 핵심 데이터 타입 (TypeScript)

### `types/order.ts`

```ts
export type OrderStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// 0,1,2 = 주문접수 / 3 = 배송중 / 4 = 배송완료 / 5,6 = 주문취소

export interface Order {
  id: string;                    // Firebase push key
  chainName: string;             // 체인명
  productId: number;
  productName: string;
  deliveryDatetime: string;      // ISO 문자열
  isImmediate: boolean;          // 즉시 배송 여부
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  ribbonText: string;            // 리본 문구
  occasionText: string;          // 조사/경사 문구
  status: OrderStatus;
  assignedDriverId: number | null;
  assignedDriverName: string | null;
  assignedAt: string | null;
  storePhotoUrl: string | null;  // 매장 촬영 사진
  deliveryPhotoUrl: string | null; // 배송 완료 사진
  createdByUserId: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
```

### `types/user.ts`

```ts
export type Role = 'floor2' | 'floor1' | 'driver' | 'admin';

export interface Session {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
}
```

---

## 5. 라우팅 매핑

현재 해시 라우트를 React Router 경로로 매핑:

| 현재 (Vanilla) | React Router |
|----------------|--------------|
| `index.html` | `/login` |
| `app.html#my-orders` | `/floor2/my-orders` |
| `app.html#new-order` | `/floor2/new-order` |
| `app.html#all-orders` | `/floor1/all-orders` or `/admin/all-orders` |
| `app.html#my-deliveries` | `/driver/my-deliveries` |
| `app.html#manage-products` | `/admin/products` |
| `app.html#manage-drivers` | `/admin/drivers` |
| `app.html#statistics` | `/admin/statistics` |

### App.tsx 예시

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Shell from './components/layout/Shell';
import LoginPage from './pages/LoginPage';
import MyOrdersPage from './pages/floor2/MyOrdersPage';
// ...

function ProtectedRoute({ role, children }: { role?: Role; children: JSX.Element }) {
  const session = useAuthStore(s => s.session);
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.role !== role && session.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Shell /></ProtectedRoute>}>
          <Route path="floor2/my-orders" element={<MyOrdersPage />} />
          <Route path="floor2/new-order" element={<NewOrderPage />} />
          <Route path="floor1/all-orders" element={<AllOrdersPage />} />
          <Route path="driver/my-deliveries" element={<MyDeliveriesPage />} />
          <Route path="admin/all-orders" element={<AllOrdersPage />} />
          <Route path="admin/products" element={<ManageProductsPage />} />
          <Route path="admin/drivers" element={<ManageDriversPage />} />
          <Route path="admin/statistics" element={<StatisticsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 6. Firebase 실시간 구독 → React Hook으로

### 현재 (Vanilla)

```js
Chat._msgsRef.on('child_added', snap => {
  el.insertAdjacentHTML('beforeend', msgHtml(snap.val()));
});
```

### React 변환

```ts
// hooks/useRealtimeList.ts
import { useEffect, useState } from 'react';
import { ref, onValue, off, query, orderByChild } from 'firebase/database';
import { db } from '../firebase';

export function useRealtimeList<T>(path: string, orderKey = 'ts'): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const q = query(ref(db, path), orderByChild(orderKey));
    const unsub = onValue(q, snap => {
      const arr: T[] = [];
      snap.forEach(child => {
        arr.push({ id: child.key, ...child.val() } as T);
      });
      setItems(arr);
    });
    return () => off(q);
  }, [path, orderKey]);
  return items;
}
```

### 사용 예

```tsx
function AllOrdersPage() {
  const orders = useRealtimeList<Order>('orders', 'createdAt');
  return (
    <div>
      {orders.map(o => <OrderCard key={o.id} order={o} />)}
    </div>
  );
}
```

---

## 7. 컴포넌트 변환 치트시트

### Modal — 현재 UI.modal → React

**현재:**
```js
const overlay = UI.modal({ title: '삭제', content: '...', confirmText: '확인' });
```

**React:**
```tsx
const [open, setOpen] = useState(false);
// ...
<Modal open={open} onClose={() => setOpen(false)} title="삭제">
  <p>...</p>
  <Button onClick={handleConfirm}>확인</Button>
</Modal>
```

### Toast

**현재:** `UI.toast('저장 완료', 'success')`
**React:** `useToast()` 훅 또는 `react-hot-toast` 라이브러리

### 폼

```tsx
import { useForm } from 'react-hook-form';

function NewOrderForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<Order>();
  const onSubmit = async (data: Order) => {
    await push(ref(db, 'orders'), { ...data, createdAt: new Date().toISOString() });
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('chainName', { required: true })} />
      {errors.chainName && <span>필수 입력</span>}
      <button type="submit">등록</button>
    </form>
  );
}
```

---

## 8. CSS 전략

현재 CSS 4개 파일(`base/layout/components/views`)은 **그대로 복사**해서 `src/styles/`에 넣고 `main.tsx`에서 `import`하면 바로 작동합니다. 모든 셀렉터가 클래스 기반이라 충돌이 없습니다.

```tsx
// main.tsx
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/views.css';
```

점진적으로 CSS Modules나 Tailwind로 마이그레이션 가능.

---

## 9. 상태 관리 (Zustand 예시)

### `store/useAuthStore.ts`

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from '../types/user';

interface AuthState {
  session: Session | null;
  login: (s: Session) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      login: (s) => set({ session: s }),
      logout: () => set({ session: null }),
    }),
    { name: 'maydaegu.session' }
  )
);
```

---

## 10. 점진적 변환 순서 (권장)

처음부터 전체 재작성하지 말고, 아래 순서로 차근차근 진행하세요:

1. **Week 1** — Vite 프로젝트 셋업 + Firebase 연결 + CSS 복사
2. **Week 2** — 로그인 페이지 (`LoginPage`) + `useAuthStore`
3. **Week 3** — `Shell` 레이아웃 (Sidebar + Chat Panel)
4. **Week 4** — 채팅 패널 (현재 가장 완성된 Firebase 기능)
5. **Week 5** — floor2 `NewOrderPage` + `MyOrdersPage`
6. **Week 6** — floor1 `AllOrdersPage` + 기사 배정 모달
7. **Week 7** — driver 페이지 + 사진 업로드 (Firebase Storage)
8. **Week 8** — admin 페이지 + 통계 차트
9. **Week 9** — DeliveryPanel (실시간 기사 상태)
10. **Week 10** — 반응형 & QA

---

## 11. 반드시 지킬 것

- ❌ **기존 UX를 임의로 바꾸지 말 것** — 디자인/뱃지 색상/버튼 위치 모두 현재와 동일
- ✅ **역할별 권한 체크는 라우팅 + API 양쪽 모두** (보안)
- ✅ **실시간 구독은 `useEffect` cleanup에서 반드시 해제** (메모리 누수 방지)
- ✅ **주문 상태 코드(0-6)는 `const` 객체로 관리** — 매직 넘버 금지
  ```ts
  export const ORDER_STATUS = {
    RECEIVED: 0, CONFIRMED: 1, PRODUCING: 2,
    DELIVERING: 3, COMPLETED: 4,
    CANCELLED_A: 5, CANCELLED_B: 6,
  } as const;
  ```

---

## 12. 참고 파일 (현재 구현 — 클론 소스)

| React 컴포넌트 | 참고할 현재 파일 |
|----------------|------------------|
| `LoginPage` | `index.html` + `js/views/login.js` |
| `Shell`, `Sidebar` | `app.html` Line 19-60 + AppShell script |
| `ChatPanel` | `js/chat.js` |
| `DeliveryPanel` | `app.html` Line 231-376 (DeliveryPanel 객체) |
| `OrderForm` | `js/views/floor2.js` (신규 접수 부분) |
| `MyOrdersPage` | `js/views/floor2.js` |
| `AllOrdersPage` | `js/views/floor1.js` (가장 큰 파일 — 필터·검색 로직 중요) |
| `MyDeliveriesPage` | `js/views/driver.js` |
| `ManageProductsPage` 등 | `js/views/admin.js` |

---

다음 문서: [03-backend-firebase.md](./03-backend-firebase.md)

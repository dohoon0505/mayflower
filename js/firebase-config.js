/* ============================================================
   FIREBASE-CONFIG.JS
   Compat SDK를 사용하므로 전역 `firebase` 객체로 초기화
   chat.js · auth.js · api.js 등이 로드되기 전에 먼저 실행되어야 함

   노출 전역:
     window.FirebaseDB       — Realtime Database (asia-southeast1)
     window.FirebaseAuth     — Firebase Auth (Email/Password)
     window.FirebaseStorage  — Firebase Storage
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBC4y-bbzIUdDxYo-K5kIF8_ms-XwNpBNs",
  authDomain: "mayflower-5c9dd.firebaseapp.com",
  /* databaseURL — Realtime Database 리전: asia-southeast1 (싱가포르)
     Firebase Console에서 확인됨 (2026-04-15) */
  databaseURL: "https://mayflower-5c9dd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mayflower-5c9dd",
  storageBucket: "mayflower-5c9dd.firebasestorage.app",
  messagingSenderId: "172745742412",
  appId: "1:172745742412:web:abf4c845ec591f4929bce9",
  measurementId: "G-RXM19QCGMY",
};

try {
  firebase.initializeApp(firebaseConfig);
  console.log('[Firebase] initializeApp OK — project:', firebaseConfig.projectId);
} catch (err) {
  console.error('[Firebase] initializeApp 실패:', err);
}

try {
  window.FirebaseDB = firebase.database();
  console.log('[Firebase] Database OK —', firebaseConfig.databaseURL);
} catch (err) {
  console.error('[Firebase] Database 초기화 실패:', err);
  window.FirebaseDB = null;
}

try {
  window.FirebaseAuth = firebase.auth();
  console.log('[Firebase] Auth OK');
} catch (err) {
  console.error('[Firebase] Auth 초기화 실패:', err);
  window.FirebaseAuth = null;
}

try {
  window.FirebaseStorage = firebase.storage();
  console.log('[Firebase] Storage OK — bucket:', firebaseConfig.storageBucket);
} catch (err) {
  console.error('[Firebase] Storage 초기화 실패:', err);
  window.FirebaseStorage = null;
}

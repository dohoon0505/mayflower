/* ============================================================
   FIREBASE-CONFIG.JS
   Compat SDK를 사용하므로 전역 `firebase` 객체로 초기화
   chat.js가 로드되기 전에 먼저 실행되어야 함
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
  window.FirebaseDB = firebase.database();
  console.log('[Firebase] Initialized — databaseURL:', firebaseConfig.databaseURL);
} catch (err) {
  console.error('[Firebase] 초기화 실패:', err);
  window.FirebaseDB = null;
}

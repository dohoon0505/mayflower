const functions = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

/* NCP Maps credentials — 반드시 `firebase functions:secrets:set NAVER_*` 로
   로테이션 후 이 하드코딩은 제거할 것. 현재는 이미 노출된 값 그대로 사용. */
const NAVER_CLIENT_ID     = process.env.NAVER_CLIENT_ID     || '59hums7gl0';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'DubVxJ5Ix7Sn5cXVaMwMmMozV0JnJzYYzb0geJcR';

async function _ncp(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-ncp-apigw-api-key-id': NAVER_CLIENT_ID,
      'x-ncp-apigw-api-key':    NAVER_CLIENT_SECRET,
      'Accept':                 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new HttpsError('internal', `NCP HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  try { return JSON.parse(text); }
  catch { throw new HttpsError('internal', 'NCP 응답 파싱 실패'); }
}

/**
 * NCP Geocoding v2 프록시 (2nd Gen callable)
 *   request.data: { address: string }
 *   returns: { x: number, y: number }  (x=경도, y=위도)
 */
exports.naverGeocode = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const address = String(request.data?.address || '').trim();
  if (!address) throw new HttpsError('invalid-argument', '주소가 필요합니다.');

  const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;
  const json = await _ncp(url);
  const first = json?.addresses?.[0];
  if (!first) throw new HttpsError('not-found', '주소 검색 결과가 없습니다.');
  const x = Number(first.x);
  const y = Number(first.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new HttpsError('internal', '좌표 변환 실패');
  }
  return { x, y };
});

/**
 * NCP Directions 15 프록시 (2nd Gen callable)
 *   request.data: { start: { x, y }, goal: { x, y } }
 *   returns: { durationMs, distanceM }
 */
exports.naverDirections = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const s = request.data?.start, g = request.data?.goal;
  if (!s || !g || !Number.isFinite(+s.x) || !Number.isFinite(+s.y) || !Number.isFinite(+g.x) || !Number.isFinite(+g.y)) {
    throw new HttpsError('invalid-argument', 'start/goal 좌표가 필요합니다.');
  }
  const url = `https://maps.apigw.ntruss.com/map-direction-15/v1/driving?start=${s.x},${s.y}&goal=${g.x},${g.y}`;
  const json = await _ncp(url);
  const route = json?.route?.traoptimal || json?.route?.trafast || json?.route?.tracomfort;
  const first = route && route[0];
  if (!first?.summary) throw new HttpsError('not-found', '경로 탐색 결과가 없습니다.');
  return {
    durationMs: Number(first.summary.duration) || 0,
    distanceM:  Number(first.summary.distance) || 0,
  };
});

/**
 * 관리자 전용: Firebase Auth 계정 + RTDB 레코드 동시 삭제
 */
exports.deleteAuthUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  const callerUid = context.auth.uid;
  const db = getDatabase();

  const callerSnap = await db.ref(`users/${callerUid}`).once('value');
  if (callerSnap.val()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', '관리자 권한이 필요합니다.');
  }

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid가 필요합니다.');
  }
  if (uid === callerUid) {
    throw new functions.https.HttpsError('invalid-argument', '자신의 계정은 삭제할 수 없습니다.');
  }

  await Promise.all([
    getAuth().deleteUser(uid),
    db.ref(`users/${uid}`).remove(),
  ]);

  return { success: true };
});

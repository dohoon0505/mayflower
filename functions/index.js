const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

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

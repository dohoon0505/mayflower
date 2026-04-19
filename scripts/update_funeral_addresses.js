/* ============================================================
   대구 장례식장 주소 일괄 반영 스크립트 (1회성)
   - orders_snapshot.json 을 읽어 각 주문의 deliveryAddress 를
     실제 대구 장례식장 주소로 교체하는 패치를 생성합니다.
   - RTDB 멀티-path update 형식으로 출력 (single atomic write).
   Usage:
     node scripts/update_funeral_addresses.js > patch.json
     MSYS_NO_PATHCONV=1 firebase database:update / patch.json \
       --project mayflower-5c9dd -y
   ============================================================ */
const fs = require('fs');
const path = require('path');

const snap = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'orders_snapshot.json'), 'utf8')
);

/* 실제 대구 장례식장 주소 (검증된 주요 병원 장례식장) */
const DAEGU_FUNERAL_ADDRESSES = [
  '대구광역시 중구 동덕로 130 경북대학교병원 장례식장',
  '대구광역시 달서구 달구벌대로 1035 계명대학교 동산병원 장례식장',
  '대구광역시 남구 두류공원로17길 33 대구가톨릭대학교병원 장례식장',
  '대구광역시 남구 현충로 170 영남대학교병원 장례식장',
  '대구광역시 동구 아양로 99 대구파티마병원 장례식장',
  '대구광역시 중구 달구벌대로 531 곽병원 장례식장',
  '대구광역시 서구 평리로 157 대구의료원 장례식장',
  '대구광역시 수성구 달구벌대로 2584 W병원 장례식장',
  '대구광역시 달서구 월곡로 60 대구보훈병원 장례식장',
  '대구광역시 북구 호국로 807 칠곡경북대학교병원 장례식장',
  '대구광역시 남구 현충로 68 구병원 장례식장',
  '대구광역시 북구 칠곡중앙대로 415 굿모닝병원 장례식장',
  '대구광역시 북구 산격로5길 72 대구한마음병원 장례식장',
  '대구광역시 달서구 성서공단로 315 남대구전문장례식장',
  '대구광역시 수성구 무학로 195 대구새생명병원 장례식장',
  '대구광역시 북구 칠곡중앙대로94길 9 우리들병원 장례식장',
  '대구광역시 달서구 달구벌대로 1501 드림병원 장례식장',
  '대구광역시 북구 칠곡중앙대로 436 대구강북병원 장례식장',
  '대구광역시 달서구 성당로 174 대구미래병원 장례식장',
  '대구광역시 서구 국채보상로43길 50 비산성심병원 장례식장',
];

const ids = Object.keys(snap);
const now = new Date().toISOString();
const patch = {};
const log = [];

ids.forEach((id, idx) => {
  const addr = DAEGU_FUNERAL_ADDRESSES[idx % DAEGU_FUNERAL_ADDRESSES.length];
  patch[`orders/${id}/deliveryAddress`] = addr;
  patch[`orders/${id}/updatedAt`] = now;
  log.push(`[${String(idx + 1).padStart(2, '0')}/${ids.length}] ${id} → ${addr}`);
});

// 패치는 stdout, 로그는 stderr (주소 선택 검증용)
process.stderr.write(log.join('\n') + '\n');
process.stderr.write(`\nTotal orders: ${ids.length}\nUnique addresses used: ${Math.min(ids.length, DAEGU_FUNERAL_ADDRESSES.length)}\n`);
process.stdout.write(JSON.stringify(patch, null, 2));

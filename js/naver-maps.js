/* ============================================================
   NAVER-MAPS.JS — NCP Maps API 클라이언트
   · 브라우저는 NCP 엔드포인트를 직접 호출할 수 없음 (CORS 미지원).
   · Firebase Cloud Functions (naverGeocode / naverDirections)
     프록시를 경유하여 Geocoding v2 + Directions 15 API 호출.
   · localStorage 7일 캐시로 함수 호출 비용 최소화.
   ============================================================ */

(() => {
  /* 회사(사무실) 고정 주소 */
  const OFFICE_ADDRESS = '대구광역시 달서구 장기동 666-1';

  /* localStorage 캐시 키 */
  const CACHE_KEY = 'nmap_geocode_cache_v1';
  const CACHE_TTL = 1000 * 60 * 60 * 24 * 7;  // 7일

  function _readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch { return {}; }
  }
  function _writeCache(c) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
  }
  function _cacheGet(addr) {
    const c = _readCache();
    const e = c[addr];
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL) return null;
    return { x: e.x, y: e.y };
  }
  function _cacheSet(addr, x, y) {
    const c = _readCache();
    c[addr] = { x, y, ts: Date.now() };
    _writeCache(c);
  }

  function _fns() {
    if (!window.firebase || !firebase.functions) {
      throw new Error('Firebase Functions SDK 미로드');
    }
    return firebase.functions();
  }

  /* ── Geocoding: address → { x(경도), y(위도) } ──────────────── */
  async function geocode(address) {
    if (!address) throw new Error('주소가 비어있습니다.');
    const addr = String(address).trim();
    const cached = _cacheGet(addr);
    if (cached) return cached;

    const call = _fns().httpsCallable('naverGeocode');
    const { data } = await call({ address: addr });
    const x = Number(data?.x), y = Number(data?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('좌표 변환 실패');
    _cacheSet(addr, x, y);
    return { x, y };
  }

  /* ── Directions 15: 출발/도착 좌표 → { durationMs, distanceM } ─ */
  async function driving(start, goal) {
    const call = _fns().httpsCallable('naverDirections');
    const { data } = await call({ start, goal });
    return {
      durationMs: Number(data?.durationMs) || 0,
      distanceM:  Number(data?.distanceM)  || 0,
    };
  }

  /* ── 편의: 주소 → 사무실 복귀 예상시간 ──────────────────────── */
  async function estimateReturnFromAddress(fromAddress) {
    const [from, to] = await Promise.all([geocode(fromAddress), geocode(OFFICE_ADDRESS)]);
    return await driving(from, to);
  }

  window.NaverMaps = {
    geocode,
    driving,
    estimateReturnFromAddress,
    OFFICE_ADDRESS,
  };
})();

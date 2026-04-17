/* ============================================================
   NAVER-MAPS.JS — NCP Maps API wrapper
   · Geocoding v2:   주소 → 좌표
   · Directions 15:  출발지/도착지 좌표 → 소요시간·거리
   ·
   ⚠️ CORS 주의: NCP Maps 는 기본적으로 브라우저 직호출 허용 여부가
      NCP Console → API Gateway → Application 에 등록된 Web 서비스
      URL (Origin) 에 달려 있습니다. 실패 시 graceful fallback 으로
      "복귀 시간 계산 불가" 배너를 노출합니다.
   ============================================================ */

(() => {
  const CLIENT_ID     = '59hums7gl0';
  const CLIENT_SECRET = 'DubVxJ5Ix7Sn5cXVaMwMmMozV0JnJzYYzb0geJcR';

  const BASE_GEOCODE    = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';
  const BASE_DIRECTIONS = 'https://maps.apigw.ntruss.com/map-direction-15/v1/driving';

  /* 회사(사무실) 고정 주소 */
  const OFFICE_ADDRESS = '대구광역시 달서구 장기동 666-1';

  /* localStorage 캐시 키 */
  const CACHE_KEY = 'nmap_geocode_cache_v1';
  const CACHE_TTL = 1000 * 60 * 60 * 24 * 7;  // 7일

  function _headers() {
    return {
      'x-ncp-apigw-api-key-id': CLIENT_ID,
      'x-ncp-apigw-api-key':    CLIENT_SECRET,
      'Accept':                 'application/json',
    };
  }

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

  /* ── Geocoding: address → { x(경도), y(위도) } ──────────────── */
  async function geocode(address) {
    if (!address) throw new Error('주소가 비어있습니다.');
    const addr = String(address).trim();
    const cached = _cacheGet(addr);
    if (cached) return cached;

    const url = `${BASE_GEOCODE}?query=${encodeURIComponent(addr)}`;
    const res = await fetch(url, { method: 'GET', headers: _headers() });
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
    const data = await res.json();
    const first = (data.addresses && data.addresses[0]) || null;
    if (!first) throw new Error('주소 검색 결과가 없습니다.');
    const x = Number(first.x);   // 경도 longitude
    const y = Number(first.y);   // 위도 latitude
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('좌표 변환 실패');
    _cacheSet(addr, x, y);
    return { x, y };
  }

  /* ── Directions 15: 출발/도착 좌표 → { durationMs, distanceM } ─ */
  async function driving(start, goal) {
    const s = `${start.x},${start.y}`;
    const g = `${goal.x},${goal.y}`;
    const url = `${BASE_DIRECTIONS}?start=${s}&goal=${g}`;
    const res = await fetch(url, { method: 'GET', headers: _headers() });
    if (!res.ok) throw new Error(`Directions HTTP ${res.status}`);
    const data = await res.json();
    const route = data.route && (data.route.traoptimal || data.route.trafast || data.route.tracomfort);
    const first = route && route[0];
    if (!first || !first.summary) throw new Error('경로 탐색 결과가 없습니다.');
    return {
      durationMs: Number(first.summary.duration) || 0,   // ms
      distanceM:  Number(first.summary.distance) || 0,   // m
    };
  }

  /* ── 편의: 주소 → 사무실 복귀 예상시간 (ms) ───────────────── */
  async function estimateReturnFromAddress(fromAddress) {
    const [from, to] = await Promise.all([geocode(fromAddress), geocode(OFFICE_ADDRESS)]);
    const r = await driving(from, to);
    return r;
  }

  window.NaverMaps = {
    geocode,
    driving,
    estimateReturnFromAddress,
    OFFICE_ADDRESS,
  };
})();

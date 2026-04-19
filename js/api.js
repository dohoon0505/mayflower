/* ============================================================
   API.JS — Firebase RTDB + Storage 기반 (v4)
   - 읽기: Store 캐시(subscribed)
   - 쓰기: FirebaseDB.ref(path).update / push / transaction
   - 사진: FirebaseStorage 에 업로드 후 downloadURL 을 RTDB 에 저장
   ============================================================ */

const _now = () => new Date().toISOString();
const _db  = () => window.FirebaseDB;
const _storage = () => window.FirebaseStorage;

const _requireSession = () => {
  const s = Auth.getSession();
  if (!s) throw { status: 401, message: '인증이 필요합니다.' };
  return s;
};

const _validatePhoto = (file) => {
  if (!file) throw { status: 400, message: '파일이 없습니다.' };
  if (file.size > 5 * 1024 * 1024) throw { status: 400, message: '파일 크기는 5MB 이하여야 합니다.' };
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowed.includes(file.type)) throw { status: 400, message: 'jpg, png 파일만 허용됩니다.' };
};

/* 이미지 리사이즈+압축: 업로드 용량/시간 5~15배 단축 */
async function _compressImage(file, maxEdge = 1280, quality = 0.72) {
  /* 500KB 이하 + 이미 작은 치수면 그대로 사용 */
  if (file.size < 500 * 1024) return file;

  try {
    /* 빠른 디코딩 — createImageBitmap 이 HTMLImage 보다 2~3배 빠름 */
    const bitmap = await createImageBitmap(file).catch(() => null);
    let srcW, srcH, drawSrc;
    if (bitmap) {
      srcW = bitmap.width; srcH = bitmap.height; drawSrc = bitmap;
    } else {
      const url = URL.createObjectURL(file);
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej; i.src = url;
      });
      srcW = img.naturalWidth; srcH = img.naturalHeight; drawSrc = img;
      URL.revokeObjectURL(url);
    }

    /* 목표 크기 계산 — 긴 변이 maxEdge 초과일 때만 축소 */
    const ratio = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const dstW  = Math.round(srcW * ratio);
    const dstH  = Math.round(srcH * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = dstW; canvas.height = dstH;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(drawSrc, 0, 0, dstW, dstH);
    if (bitmap && bitmap.close) bitmap.close();

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;    // 압축 효과 없으면 원본
    return new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    console.warn('[Upload] compression failed, using original:', e);
    return file;
  }
}

async function _uploadOrderPhoto(orderId, file, fileName) {
  _validatePhoto(file);
  const compressed = await _compressImage(file);
  const ref = _storage().ref(`orders/${orderId}/${fileName}`);
  const snap = await ref.put(compressed, { contentType: compressed.type || 'image/jpeg' });
  return await snap.ref.getDownloadURL();
}

const Api = {
  /* ── Auth passthroughs ─────────────────────────────────── */
  login:    (u, p)  => Auth.login(u, p),
  register: (data)  => Auth.register(data),

  /* ── Orders ────────────────────────────────────────────── */
  async getOrders(filters = {}) {
    const s = _requireSession();
    if (s.role === 'driver') throw { status: 403, message: '권한이 없습니다.' };
    return Store.getOrders(filters);
  },

  async createOrder(data) {
    const s = _requireSession();
    if (!Auth.can('createOrder', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    if (!data.chainName?.trim())       throw { status: 400, message: '체인명을 입력해 주세요.' };
    if (!data.productId)               throw { status: 400, message: '상품을 선택해 주세요.' };
    if (!data.deliveryAddress?.trim()) throw { status: 400, message: '배송지를 입력해 주세요.' };
    if (!data.recipientName?.trim())   throw { status: 400, message: '받는 분 성함을 입력해 주세요.' };

    const product = Store.getProductById(data.productId);
    const now = _now();
    const payload = {
      chainName:          String(data.chainName).trim(),
      productId:          data.productId,
      productName:        product ? product.name : '',
      deliveryDatetime:   data.deliveryDatetime,
      isImmediate:        !!data.isImmediate,
      deliveryAddress:    String(data.deliveryAddress).trim(),
      recipientName:      String(data.recipientName).trim(),
      recipientPhone:     String(data.recipientPhone || '').trim(),
      ribbonText:         String(data.ribbonText   || '').trim(),
      occasionText:       String(data.occasionText || '').trim(),
      price:              data.price != null && data.price !== '' ? Number(data.price) : null,
      status:             0,
      assignedDriverId:   null,
      assignedDriverName: null,
      assignedAt:         null,
      storePhotoUrl:      null,
      deliveryPhotoUrl:   null,
      createdByUserId:    s.userId,
      createdByName:      s.displayName,
      createdAt:          now,
      updatedAt:          now,
    };
    const ref = _db().ref('orders').push();
    await ref.set(payload);
    return { id: ref.key, ...payload };
  },

  async updateOrderStatus(id, status) {
    const s = _requireSession();
    if (!Auth.can('updateStatus', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    await _db().ref(`orders/${id}`).update({ status: +status, updatedAt: _now() });
    return true;
  },

  /* 배차: 트랜잭션으로 중복 배차 차단 */
  async assignDriver(id, driverId) {
    const s = _requireSession();
    if (!Auth.can('assignDriver', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    const driver = Store.getDriverById(driverId);
    if (!driver) throw { status: 404, message: '기사를 찾을 수 없습니다.' };

    const ref = _db().ref(`orders/${id}`);
    const result = await ref.transaction((current) => {
      if (current == null) return;                           // abort (없음)
      if (current.assignedDriverId && current.assignedDriverId !== driverId) {
        /* 이미 다른 기사에게 배정됨 → abort */
        return;
      }
      const now = _now();
      current.assignedDriverId   = driverId;
      current.assignedDriverName = driver.name;
      current.assignedAt         = now;
      current.updatedAt          = now;
      return current;
    });
    if (!result.committed) throw { status: 409, message: '이미 다른 기사에게 배정된 주문입니다.' };
    return true;
  },

  async unassignDriver(id) {
    const s = _requireSession();
    if (!Auth.can('assignDriver', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    await _db().ref(`orders/${id}`).update({
      assignedDriverId: null, assignedDriverName: null, assignedAt: null, updatedAt: _now(),
    });
    return true;
  },

  /* 인수증 인쇄 기록 (업무 흐름도 1단계) */
  async markReceiptPrinted(id) {
    _requireSession();
    if (!id) throw { status: 400, message: 'orderId 가 필요합니다.' };
    const now = _now();
    await _db().ref(`orders/${id}`).update({ receiptPrintedAt: now, updatedAt: now });
    return true;
  },

  async completeOrder(id, photoUrl) {
    const s = _requireSession();
    if (!Auth.can('completeDelivery', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    await _db().ref(`orders/${id}`).update({
      status: 4, deliveryPhotoUrl: photoUrl || null, updatedAt: _now(),
    });
    return true;
  },

  async updateOrder(id, data) {
    const s = _requireSession();
    const o = Store.getOrderById(id);
    if (!o) throw { status: 404, message: '주문을 찾을 수 없습니다.' };

    /* floor2: 배차 필드 수정 불가 (나머지 필드는 전체 주문 수정 가능) */
    let patch = { ...data };
    if (s.role === 'floor2') {
      delete patch.assignedDriverId;
    } else if (!Auth.can('updateStatus', s.role)) {
      throw { status: 403, message: '권한이 없습니다.' };
    }

    /* productId 가 바뀌면 productName 동기화 */
    if (patch.productId != null) {
      const product = Store.getProductById(patch.productId);
      patch.productName = product ? product.name : o.productName;
    }
    /* assignedDriverId 처리 (해제 / 재배정) */
    if ('assignedDriverId' in patch) {
      const raw = patch.assignedDriverId;
      if (!raw || raw === '0') {
        patch.assignedDriverId   = null;
        patch.assignedDriverName = null;
        patch.assignedAt         = null;
      } else {
        const driver = Store.getDriverById(raw);
        patch.assignedDriverName = driver ? driver.name : (o.assignedDriverName || '');
        if (raw !== o.assignedDriverId) patch.assignedAt = _now();
      }
    }

    patch.updatedAt = _now();
    /* Firebase는 undefined 값을 거부하므로 제거 */
    Object.keys(patch).forEach(k => { if (patch[k] === undefined) delete patch[k]; });
    await _db().ref(`orders/${id}`).update(patch);
    return true;
  },

  /* 주문 삭제 (admin 전용) — 연결된 Storage 사진도 best-effort 로 함께 정리 */
  async deleteOrder(id) {
    const s = _requireSession();
    if (!Auth.can('deleteOrder', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    if (!id) throw { status: 400, message: 'orderId 가 필요합니다.' };

    /* Storage 사진 cleanup (실패해도 DB 삭제는 진행) */
    if (window.FirebaseStorage) {
      const files = ['store-photo.jpg', 'delivery-photo.jpg'];
      await Promise.all(files.map(async (fn) => {
        try { await window.FirebaseStorage.ref(`orders/${id}/${fn}`).delete(); }
        catch (e) { /* object-not-found 등 무시 */ }
      }));
    }
    await _db().ref(`orders/${id}`).remove();
    return true;
  },

  async deleteOrders(ids) {
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!list.length) return 0;
    const s = _requireSession();
    if (!Auth.can('deleteOrder', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    for (const id of list) {
      try { await Api.deleteOrder(id); }
      catch (e) { console.warn('[deleteOrders] 실패', id, e); }
    }
    return list.length;
  },

  /* ── Photo uploads ─────────────────────────────────────── */
  async uploadStorePhoto(file, orderId) {
    _requireSession();
    if (!orderId) throw { status: 400, message: 'orderId 가 필요합니다.' };
    const url = await _uploadOrderPhoto(orderId, file, 'store-photo.jpg');
    return { url };
  },

  async uploadDeliveryPhoto(file, orderId) {
    _requireSession();
    if (!orderId) throw { status: 400, message: 'orderId 가 필요합니다.' };
    const url = await _uploadOrderPhoto(orderId, file, 'delivery-photo.jpg');
    return { url };
  },

  /* ── Products (admin) ──────────────────────────────────── */
  async getProducts(includeInactive = false) {
    return Store.getProducts(!includeInactive);
  },

  async createProduct(data) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (!data.name?.trim()) throw { status: 400, message: '상품명을 입력해 주세요.' };
    const payload = {
      name: String(data.name).trim(),
      category: data.category || '기타',
      isActive: true,
      createdAt: _now(),
    };
    const ref = _db().ref('products').push();
    await ref.set(payload);
    return { id: ref.key, ...payload };
  },

  async updateProduct(id, data) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    await _db().ref(`products/${id}`).update(data);
    return true;
  },

  async deleteProduct(id) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    await _db().ref(`products/${id}`).remove();
    return true;
  },

  /* ── Categories (admin) ────────────────────────────────── */
  async createCategory(name) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    const n = String(name || '').trim();
    if (!n) throw { status: 400, message: '카테고리명을 입력해 주세요.' };
    if (Store.getCategoryByName(n)) throw { status: 400, message: '이미 존재하는 카테고리입니다.' };
    const order = (Store.getCategoriesRaw().reduce((m, c) => Math.max(m, c.order ?? 0), 0)) + 1;
    const ref = _db().ref('categories').push();
    await ref.set({ name: n, order });
    return { id: ref.key, name: n, order };
  },

  async renameCategory(oldName, newName) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    const n = String(newName || '').trim();
    if (!n || n === oldName) throw { status: 400, message: '새 이름이 올바르지 않습니다.' };
    if (Store.getCategoryByName(n)) throw { status: 400, message: '이미 존재하는 카테고리입니다.' };
    const target = Store.getCategoryByName(oldName);
    if (!target) throw { status: 404, message: '카테고리를 찾을 수 없습니다.' };
    /* 해당 카테고리 사용 상품 일괄 갱신 */
    const products = Store.getProducts(false).filter(p => p.category === oldName);
    const updates = {};
    updates[`categories/${target.id}/name`] = n;
    products.forEach(p => { updates[`products/${p.id}/category`] = n; });
    await _db().ref().update(updates);
    return true;
  },

  async deleteCategory(name) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    const target = Store.getCategoryByName(name);
    if (!target) throw { status: 404, message: '카테고리를 찾을 수 없습니다.' };
    const inUse = Store.getProducts(true).filter(p => p.category === name).length;
    if (inUse > 0) throw { status: 400, message: `사용 중인 상품이 ${inUse}건 있어 삭제할 수 없습니다.` };
    await _db().ref(`categories/${target.id}`).remove();
    return true;
  },

  /* ── Drivers (admin) ───────────────────────────────────── */
  async getDrivers(includeInactive = false) {
    return Store.getDrivers(!includeInactive);
  },

  async createDriver(data) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (!data.name?.trim()) throw { status: 400, message: '기사 이름을 입력해 주세요.' };
    const payload = {
      name:  String(data.name).trim(),
      phone: String(data.phone || '').trim(),
      linkedUserId: data.linkedUserId || null,
      isActive: true,
      createdAt: _now(),
    };
    const ref = _db().ref('drivers').push();
    await ref.set(payload);
    return { id: ref.key, ...payload };
  },

  async updateDriver(id, data) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    await _db().ref(`drivers/${id}`).update(data);
    return true;
  },

  async deleteDriver(id) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    await _db().ref(`drivers/${id}`).update({ isActive: false });
    return true;
  },

  /* ── Users (admin 승인 플로우) ─────────────────────────── */
  async updateUser(uid, patch) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    await _db().ref(`users/${uid}`).update(patch);
    return true;
  },

  async approveUser(uid, role) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (!['floor1', 'floor2', 'driver', 'admin'].includes(role)) {
      throw { status: 400, message: '역할이 올바르지 않습니다.' };
    }
    await _db().ref(`users/${uid}`).update({ isApproved: true, role });
    return true;
  },

  async toggleUserActive(uid, isActive) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    await _db().ref(`users/${uid}`).update({ isActive: !!isActive });
    return true;
  },

  async deleteUser(uid) {
    const s = _requireSession();
    if (s.role !== 'admin') throw { status: 403, message: '권한이 없습니다.' };
    if (s.userId === uid) throw { status: 400, message: '자신의 계정은 삭제할 수 없습니다.' };
    if (!window.FirebaseFunctions) throw { status: 500, message: 'Functions가 초기화되지 않았습니다.' };
    const fn = window.FirebaseFunctions.httpsCallable('deleteAuthUser');
    const result = await fn({ uid });
    return result.data;
  },

  /* ── Delivery (driver 전용 — 웹에서는 사실상 사용 안 함) ── */
  async getMyDeliveries() {
    const s = _requireSession();
    if (!Auth.can('myDeliveries', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    if (!s.driverId) return [];
    return Store.getOrders({ driverId: s.driverId }).filter(o => ![4, 5, 6].includes(o.status));
  },

  /* ── Statistics ────────────────────────────────────────── */
  async getDriverStats(from, to) {
    const s = _requireSession();
    if (!Auth.can('statistics', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    const orders = Store.getOrders({ status: 4 }).filter(o =>
      (!from || o.deliveryDatetime >= from) && (!to || o.deliveryDatetime <= to)
    );
    const map = {};
    orders.forEach(o => {
      if (!o.assignedDriverName) return;
      const product  = Store.getProductById(o.productId);
      const category = product?.category || '기타';
      const key = `${o.assignedDriverName}||${category}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([k, count]) => {
      const [driverName, category] = k.split('||');
      return { driverName, category, count };
    }).sort((a, b) => a.driverName.localeCompare(b.driverName, 'ko'));
  },

  async getDailyStats(year, month) {
    const s = _requireSession();
    if (!Auth.can('statistics', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    const orders = Store.getOrders({ status: 4 }).filter(o => {
      const d = new Date(o.deliveryDatetime);
      return d.getFullYear() === +year && (d.getMonth() + 1) === +month;
    });
    const map = {};
    orders.forEach(o => {
      const date     = UI.fmtDate(o.deliveryDatetime);
      const product  = Store.getProductById(o.productId);
      const category = product?.category || '기타';
      const key = `${date}||${category}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([k, count]) => {
      const [date, category] = k.split('||');
      return { date, category, count };
    }).sort((a, b) => a.date.localeCompare(b.date));
  },

  async getMonthlyStats(year) {
    const s = _requireSession();
    if (!Auth.can('statistics', s.role)) throw { status: 403, message: '권한이 없습니다.' };
    const orders = Store.getOrders({ status: 4 }).filter(o =>
      new Date(o.deliveryDatetime).getFullYear() === +year
    );
    const map = {};
    orders.forEach(o => {
      const d        = new Date(o.deliveryDatetime);
      const month    = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const product  = Store.getProductById(o.productId);
      const category = product?.category || '기타';
      const key = `${month}||${category}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([k, count]) => {
      const [month, category] = k.split('||');
      return { month, category, count };
    }).sort((a, b) => a.month.localeCompare(b.month));
  },
};

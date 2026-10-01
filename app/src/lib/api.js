// 資料存取層：有後端時使用伺服器資料庫；沒有後端（例如只開靜態檔）時改用本機儲存
import { COLLECTIONS } from './collections.js';

const TOKEN_KEY = 'xc30-token';
const LOCAL_KEY = 'xc30-local-data';

const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const safeDel = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

export const getToken = () => safeGet(TOKEN_KEY);
export const setToken = (t) => (t ? safeSet(TOKEN_KEY, t) : safeDel(TOKEN_KEY));

export const emptyData = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('無法連線到伺服器，請檢查網路後再試。', 0);
  }
  let json = null;
  try { json = await res.json(); } catch { /* 非 JSON 回應 */ }
  if (!res.ok) throw new ApiError(json?.error || `伺服器錯誤（${res.status}）`, res.status, json?.code);
  return json;
}

// 偵測是否有後端可用
export async function detectBackend() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return null;
    const json = await res.json();
    return json?.ok ? json : null;
  } catch {
    return null;
  }
}

export const remote = {
  register: (username, password) => request('POST', '/api/auth/register', { username, password }),
  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  logout: () => request('POST', '/api/auth/logout').catch(() => null),
  me: () => request('GET', '/api/auth/me'),
  loadAll: () => request('GET', '/api/data'),
  put: (col, rec) => request('PUT', `/api/data/${col}/${encodeURIComponent(rec.id)}`, rec),
  batch: (col, records) => request('POST', `/api/data/${col}/batch`, { records }),
  del: (col, id) => request('DELETE', `/api/data/${col}/${encodeURIComponent(id)}`),
  delMany: (col, ids) => request('POST', `/api/data/${col}/batch-delete`, { ids }),
  importAll: (data) => request('POST', '/api/import', { data }),
  ai: (kind, body) => request('POST', `/api/ai/${kind}`, body),
};

// 本機模式：資料只存在這台裝置、這個瀏覽器
function readLocal() {
  try {
    return { ...emptyData(), ...(JSON.parse(safeGet(LOCAL_KEY) || '{}')) };
  } catch {
    return emptyData();
  }
}
function writeLocal(data) {
  if (!safeSet(LOCAL_KEY, JSON.stringify(data))) throw new ApiError('本機儲存失敗（可能是無痕模式或儲存空間已滿）', 0);
}
const stamp = (rec) => {
  const ts = new Date().toISOString();
  return { ...rec, createdAt: rec.createdAt || ts, updatedAt: ts };
};

export const local = {
  loadAll: async () => readLocal(),
  put: async (col, rec) => {
    const data = readLocal();
    const saved = stamp(rec);
    const list = data[col] || [];
    const i = list.findIndex((x) => x.id === rec.id);
    if (i >= 0) list[i] = saved; else list.push(saved);
    data[col] = list;
    writeLocal(data);
    return saved;
  },
  batch: async (col, records) => {
    const data = readLocal();
    const saved = records.map(stamp);
    const map = new Map((data[col] || []).map((x) => [x.id, x]));
    saved.forEach((r) => map.set(r.id, r));
    data[col] = [...map.values()];
    writeLocal(data);
    return saved;
  },
  del: async (col, id) => {
    const data = readLocal();
    data[col] = (data[col] || []).filter((x) => x.id !== id);
    writeLocal(data);
    return { ok: true };
  },
  delMany: async (col, ids) => {
    const data = readLocal();
    const set = new Set(ids);
    data[col] = (data[col] || []).filter((x) => !set.has(x.id));
    writeLocal(data);
    return { ok: true };
  },
  importAll: async (payload) => {
    const data = { ...emptyData(), ...payload };
    writeLocal(data);
    return data;
  },
  ai: async () => {
    throw new ApiError('目前是本機模式（沒有連到後端伺服器），AI 功能無法使用。請依說明啟動伺服器並設定 API 金鑰。', 503, 'NO_BACKEND');
  },
};

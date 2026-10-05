// Claude 雲端模式：在 claude.ai 打開時，不需要自己的伺服器與 API 金鑰
// - 資料：存在這個頁面的 Claude 雲端資料庫，放在使用者自己的私人區（其他人看不到）
// - AI：透過使用者自己的 Claude 帳號回答（第一次使用會詢問是否允許，用量算在 Claude 方案內）
import { COLLECTIONS } from './collections.js';
import { build } from './prompts.js';
import { ApiError, emptyData, newId } from './api.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SAFE_ID = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

// 資料庫呼叫：遇到忙碌或暫時性錯誤時稍等重試（最多 3 次）
async function withRetry(fn) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e?.code === 'resource_exhausted' || e?.code === 'unavailable';
      if (!retryable || i >= 3) throw new ApiError(dbMessage(e), 0, e?.code);
      await sleep(400 * (i + 1) + Math.random() * 300);
    }
  }
}

function dbMessage(e) {
  switch (e?.code) {
    case 'quota_exceeded': return '雲端儲存空間已滿，請刪除一些舊的紀錄（例如 AI 紀錄）後再試。';
    case 'resource_exhausted': return '操作太頻繁，請稍等幾秒再試。';
    case 'revoked': case 'not_granted': return '這個頁面已無法存取雲端資料，請重新整理。';
    case 'invalid_argument': return '資料格式不正確，無法儲存。';
    default: return '雲端暫時無法連線，請稍後再試。';
  }
}

function aiMessage(e) {
  switch (e?.code) {
    case 'not_granted': return '你沒有允許這個頁面使用 Claude。重新整理頁面後，在詢問視窗按允許即可使用 AI。';
    case 'sampling_disabled': return '你的 Claude 帳號目前無法在頁面中使用 AI。';
    case 'rate_limited': return '已達 Claude 的使用量上限或操作太頻繁，請稍後再試。';
    case 'session_expired': return 'Claude 登入已過期，請重新登入 claude.ai 後再試。';
    case 'refused': return 'Claude 這次無法回覆這個內容，請換個方式描述再試一次。';
    case 'prompt_too_large': return '內容太長，請精簡後再試。';
    case 'empty_completion': return 'AI 沒有回傳內容，請再試一次。';
    case 'cancelled': return '已取消。';
    default: return 'AI 暫時無法回覆，請稍後再試。';
  }
}

// 並行數有限地執行多個非同步工作，避免太快觸發頻率限制
async function pool(items, fn, size = 4) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// 把 build() 的 {system, messages} 轉成 sample 的輸入（沒有 system 角色，放在第一個 user 訊息）
export function toSampleInput(spec) {
  const [first, ...rest] = spec.messages;
  const turns = [{ role: 'user', content: `${spec.system}\n\n---\n\n${first.content}` }, ...rest];
  return turns.length === 1 ? turns[0].content : turns;
}

// 是不是在 claude.ai 裡打開的
export const inClaude = () => typeof window !== 'undefined' && typeof window.claude?.use === 'function';

export async function connectCloud() {
  const c = typeof window !== 'undefined' ? window.claude : null;
  if (!c?.use) return null;
  const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
  if (!db || !user) return null;
  const uid = await user.id().catch(() => null);
  if (!uid) return null;
  // sample 與 downloads 晚一點再取得，不擋住資料載入
  const samplePromise = c.use('sample');
  const downloadsPromise = c.use('downloads');

  const base = db.doc(`data/users/${uid}/app`);
  const col = (name) => base.collection(name);
  const ref = (name, id) => {
    const key = String(id);
    if (!SAFE_ID.test(key)) throw new ApiError('這筆資料的編號格式無法存到雲端', 0);
    return col(name).doc(key);
  };
  const stamp = (rec) => {
    const ts = new Date().toISOString();
    return { ...rec, createdAt: rec.createdAt || ts, updatedAt: ts };
  };

  // 清掉 undefined，確保是純 JSON
  const clean = (rec) => JSON.parse(JSON.stringify(rec));

  // 一次最多讀 1000 筆；超過時依 id 分頁讀完，避免舊紀錄被漏掉
  const PAGE = 1000;
  const readCollection = async (name) => {
    const first = await withRetry(() => col(name).limit(PAGE).get());
    const rows = first.docs.filter((d) => d.exists).map((d) => ({ ...d.data() }));
    if (first.docs.length < PAGE) return rows;
    const all = new Map(rows.map((r) => [String(r.id), r]));
    let last = null;
    for (let i = 0; i < 100; i++) {
      let q = col(name).orderBy('id');
      if (last !== null) q = q.where('id', '>', last);
      const snap = await withRetry(() => q.limit(PAGE).get());
      const page = snap.docs.filter((d) => d.exists).map((d) => ({ ...d.data() }));
      page.forEach((r) => all.set(String(r.id), r));
      if (snap.docs.length < PAGE || !page.length) break;
      last = page[page.length - 1].id;
    }
    return [...all.values()];
  };

  // 每日快照：存在 data/users/<uid>/backup 底下（和一般資料分開，不會在開啟時全部載入）
  // 一份快照拆成多個小段（每段 6 萬字），避免超過單筆 256KB 的上限
  const snapRoot = db.doc(`data/users/${uid}/backup`);
  const days = snapRoot.collection('days');
  const parts = snapRoot.collection('parts');
  const CHUNK = 60000;
  const snapshots = {
    async list() {
      const snap = await withRetry(() => days.limit(200).get());
      return snap.docs.filter((d) => d.exists).map((d) => ({ ...d.data() }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    async save(id, data, label) {
      if (!SAFE_ID.test(id)) throw new ApiError('備份編號格式不正確', 0);
      const text = JSON.stringify(data);
      const n = Math.max(1, Math.ceil(text.length / CHUNK));
      const prev = await withRetry(() => days.doc(id).get());
      const oldParts = prev.exists ? Number(prev.data().parts) || 0 : 0;
      await pool(Array.from({ length: n }, (_, i) => i), (i) => withRetry(() => parts.doc(`${id}_${i}`).set({ id, i, text: text.slice(i * CHUNK, (i + 1) * CHUNK) })));
      // 每一段都存好之後才寫目錄，目錄存在就代表這份備份是完整的
      await withRetry(() => days.doc(id).set({ id, date: id.slice(0, 10), label: label || '', parts: n, size: text.length, count: COLLECTIONS.reduce((s, c) => s + (data[c] || []).length, 0), createdAt: new Date().toISOString() }));
      for (let i = n; i < oldParts; i++) await withRetry(() => parts.doc(`${id}_${i}`).delete());
    },
    async load(id) {
      const meta = await withRetry(() => days.doc(id).get());
      if (!meta.exists) throw new ApiError('找不到這份備份', 0);
      const n = Number(meta.data().parts) || 0;
      const chunks = await pool(Array.from({ length: n }, (_, i) => i), async (i) => {
        const d = await withRetry(() => parts.doc(`${id}_${i}`).get());
        if (!d.exists) throw new ApiError('這份備份不完整，無法讀取', 0);
        return d.data().text;
      });
      return JSON.parse(chunks.join(''));
    },
    async remove(id) {
      const meta = await withRetry(() => days.doc(id).get());
      const n = meta.exists ? Number(meta.data().parts) || 0 : 0;
      await withRetry(() => days.doc(id).delete());
      for (let i = 0; i < n; i++) await withRetry(() => parts.doc(`${id}_${i}`).delete());
    },
  };

  const api = {
    snapshots,
    async loadAll() {
      const data = emptyData();
      await pool(COLLECTIONS, async (name) => {
        data[name] = (await readCollection(name))
          .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      });
      return data;
    },
    async put(name, rec) {
      const saved = clean(stamp(rec));
      await withRetry(() => ref(name, rec.id).set(saved));
      return saved;
    },
    async batch(name, records) {
      const saved = records.map((r) => clean(stamp(r)));
      await pool(saved, (r) => withRetry(() => ref(name, r.id).set(r)));
      return saved;
    },
    async del(name, id) {
      await withRetry(() => ref(name, id).delete());
      return { ok: true };
    },
    async delMany(name, ids) {
      await pool(ids, (id) => withRetry(() => ref(name, id).delete()));
      return { ok: true };
    },
    // 還原備份：先刪除目前資料再寫入；中途失敗時會告知，原檔仍在使用者手上
    async importAll(payload) {
      const current = await api.loadAll();
      for (const name of COLLECTIONS) {
        await pool(current[name], (r) => withRetry(() => ref(name, r.id).delete()));
        const list = (payload[name] || []).filter((r) => r && r.id !== undefined && SAFE_ID.test(String(r.id)));
        await pool(list, (r) => withRetry(() => ref(name, r.id).set(clean(r))));
      }
      return api.loadAll();
    },
    async ai(kind, body, data, settings) {
      const sample = await samplePromise;
      if (!sample) throw new ApiError('這個頁面目前無法使用 Claude AI。', 503, 'NO_SAMPLE');
      const spec = build(kind, body, data, settings);
      if (!spec) throw new ApiError('不支援的 AI 功能', 400);
      let res;
      try {
        res = await sample(toSampleInput(spec), { modelTier: 'default', cache: false, onText: body.onText });
      } catch (e) {
        throw new ApiError(aiMessage(e), 0, e?.code);
      }
      const record = {
        id: newId(),
        kind,
        label: spec.label,
        mode: body.mode || null,
        refId: body.refId || null,
        input: String(body.input || '') || body.summary || spec.label,
        output: res.truncated ? `${res.text}\n\n（回覆過長被截斷）` : res.text,
        model: `Claude（${res.modelTierApplied}）`,
      };
      return api.put('aiHistory', record);
    },
    async download(filename, text) {
      const downloads = await downloadsPromise;
      if (!downloads) throw new ApiError('這個頁面目前無法下載檔案。', 0);
      try {
        await downloads.save({ filename, data: text });
      } catch (e) {
        if (e?.code === 'declined') throw new ApiError('已取消下載。', 0, 'declined');
        throw new ApiError('下載失敗，請稍後再試。', 0, e?.code);
      }
    },
  };
  return api;
}

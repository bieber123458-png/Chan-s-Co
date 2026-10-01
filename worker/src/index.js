// 小陳的每月經營系統 — Cloudflare 後端
// 讓放在 GitHub Pages 的網頁也能登入、雲端同步資料、使用 AI 教練。
// - 資料：Durable Object 內建的 SQLite（部署時自動建立，不需要另外建資料庫）
// - AI：用 Cloudflare 上設定的 ANTHROPIC_API_KEY（Secret）呼叫 Claude，金鑰不會出現在網頁裡
// - 登入：第一個註冊的帳號就是擁有者，之後預設關閉註冊
import { DurableObject } from 'cloudflare:workers';
import Anthropic from '@anthropic-ai/sdk';
import { createAi } from '../../app/server/ai-core.js';
import { COLLECTIONS } from '../../app/src/lib/collections.js';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));

// Cloudflare 免費方案每次請求的 CPU 時間有限，迭代次數取 1 萬次，兼顧安全與速度
const PBKDF2_ITERATIONS = 10000;

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return hex(bits);
}

// 固定時間比較，避免從回應時間猜出密碼
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- CORS：只允許設定的網站呼叫 ----------
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !(allowed.includes('*') || allowed.includes(origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    let res;
    if (!url.pathname.startsWith('/api/')) {
      res = Response.json({ ok: true, message: '小陳的每月經營系統後端運作中。請從網頁版使用。' });
    } else {
      // 所有資料都在同一個 Durable Object（單人使用，資料集中、一致）
      const stub = env.STORE.get(env.STORE.idFromName('main'));
      res = await stub.fetch(request);
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};

export class Store extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records (user_id INTEGER NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, collection, id));
    `);
    this.ai = createAi({
      Anthropic,
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.AI_MODEL || 'claude-opus-5-5',
      fallbacks: env.AI_FALLBACKS !== 'off',
    });
  }

  // ---------- 資料庫小工具 ----------
  rows(q, ...args) { return this.sql.exec(q, ...args).toArray(); }
  userCount() { return this.rows('SELECT COUNT(*) AS n FROM users')[0].n; }
  registrationOpen() { return this.userCount() === 0 || this.env.ALLOW_REGISTRATION === 'true'; }
  newSession(userId) {
    const token = randomHex(32);
    this.sql.exec('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)', token, userId, new Date().toISOString());
    return token;
  }
  lookup(token) {
    if (!token) return null;
    return this.rows('SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', token)[0] || null;
  }
  all(userId) {
    const out = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
    for (const r of this.rows('SELECT collection, data FROM records WHERE user_id = ? ORDER BY created_at', userId)) {
      if (out[r.collection]) out[r.collection].push(JSON.parse(r.data));
    }
    return out;
  }
  upsert(userId, collection, record) {
    const ts = new Date().toISOString();
    const data = { ...record, updatedAt: ts, createdAt: record.createdAt || ts };
    this.sql.exec(`INSERT INTO records (user_id, collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    userId, collection, String(record.id), JSON.stringify(data), data.createdAt, ts);
    return data;
  }
  removeRecord(userId, collection, id) {
    this.sql.exec('DELETE FROM records WHERE user_id = ? AND collection = ? AND id = ?', userId, collection, String(id));
  }

  async fetch(request) {
    try {
      return await this.route(request);
    } catch (e) {
      console.error('[api]', e?.stack || e);
      return Response.json({ error: '伺服器發生錯誤：' + (e?.message || '未知錯誤') }, { status: 500 });
    }
  }

  async route(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const json = (body, status = 200) => Response.json(body, { status });
    const readBody = async () => { try { return await request.json(); } catch { return null; } };

    if (path === '/api/status' && method === 'GET') {
      return json({ ok: true, storage: 'cloudflare', aiConfigured: this.ai.configured, aiModel: this.ai.configured ? this.ai.model : null, registrationOpen: this.registrationOpen() });
    }

    // ---------- 帳號 ----------
    if (path === '/api/auth/register' || path === '/api/auth/login') {
      if (method !== 'POST') return json({ error: '方法不允許' }, 405);
      const b = await readBody();
      const username = String(b?.username || '').trim();
      const password = String(b?.password || '');
      const isRegister = path.endsWith('register');
      if (username.length < 2 || username.length > 40 || password.length < 6) {
        return json({ error: isRegister ? '帳號需為 2～40 個字，密碼至少 6 個字元' : '帳號或密碼錯誤' }, 400);
      }
      if (isRegister) {
        if (!this.registrationOpen()) return json({ error: '目前未開放註冊新帳號，請使用既有帳號登入。' }, 403);
        if (this.rows('SELECT id FROM users WHERE username = ?', username).length) return json({ error: '這個帳號已經有人使用' }, 409);
        const salt = randomHex(16);
        const hash = await hashPassword(password, salt);
        this.sql.exec('INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)', username, hash, salt, new Date().toISOString());
        const id = this.rows('SELECT id FROM users WHERE username = ?', username)[0].id;
        return json({ token: this.newSession(id), user: { id, username } });
      }
      const u = this.rows('SELECT * FROM users WHERE username = ?', username)[0];
      if (!u || !safeEqual(await hashPassword(password, u.salt), u.password_hash)) return json({ error: '帳號或密碼錯誤' }, 401);
      return json({ token: this.newSession(u.id), user: { id: u.id, username: u.username } });
    }

    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const user = this.lookup(token);
    if (!user) return json({ error: '登入已過期，請重新登入' }, 401);

    if (path === '/api/auth/me' && method === 'GET') return json({ user });
    if (path === '/api/auth/logout' && method === 'POST') {
      this.sql.exec('DELETE FROM sessions WHERE token = ?', token);
      return json({ ok: true });
    }

    // ---------- 資料 ----------
    if (path === '/api/data' && method === 'GET') return json(this.all(user.id));

    const m = path.match(/^\/api\/data\/([^/]+)\/(.+)$/);
    if (m) {
      const collection = m[1];
      const rest = decodeURIComponent(m[2]);
      if (!COLLECTIONS.includes(collection)) return json({ error: '找不到這個資料類型' }, 404);
      if (rest === 'batch' && method === 'POST') {
        const list = (await readBody())?.records;
        if (!Array.isArray(list)) return json({ error: '資料格式錯誤' }, 400);
        const saved = this.ctx.storage.transactionSync(() => list.map((r) => this.upsert(user.id, collection, r)));
        return json(saved);
      }
      if (rest === 'batch-delete' && method === 'POST') {
        const ids = (await readBody())?.ids;
        if (!Array.isArray(ids)) return json({ error: '資料格式錯誤' }, 400);
        this.ctx.storage.transactionSync(() => ids.forEach((id) => this.removeRecord(user.id, collection, id)));
        return json({ ok: true, removed: ids.length });
      }
      if (method === 'PUT') {
        const body = await readBody();
        if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: '資料格式錯誤' }, 400);
        return json(this.upsert(user.id, collection, { ...body, id: rest }));
      }
      if (method === 'DELETE') {
        this.removeRecord(user.id, collection, rest);
        return json({ ok: true });
      }
    }

    if (path === '/api/import' && method === 'POST') {
      const payload = (await readBody())?.data;
      if (!payload || typeof payload !== 'object') return json({ error: '備份檔格式錯誤' }, 400);
      this.ctx.storage.transactionSync(() => {
        this.sql.exec('DELETE FROM records WHERE user_id = ?', user.id);
        for (const c of COLLECTIONS) {
          for (const rec of payload[c] || []) {
            if (!rec || rec.id === undefined) continue;
            const ts = rec.createdAt || new Date().toISOString();
            this.sql.exec('INSERT OR REPLACE INTO records (user_id, collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
              user.id, c, String(rec.id), JSON.stringify(rec), ts, rec.updatedAt || ts);
          }
        }
      });
      return json(this.all(user.id));
    }

    // ---------- AI ----------
    const ai = path.match(/^\/api\/ai\/([A-Za-z]+)$/);
    if (ai && method === 'POST') {
      if (!this.ai.configured) {
        return json({ error: 'AI 尚未設定：請在 Cloudflare 的 Variables and Secrets 新增 ANTHROPIC_API_KEY。', code: 'AI_NOT_CONFIGURED' }, 503);
      }
      const body = (await readBody()) || {};
      const input = String(body.input || '');
      if (input.length > 20000) return json({ error: '輸入內容太長，請精簡到 20,000 字以內' }, 400);
      const data = this.all(user.id);
      const settings = data.settings.find((s) => s.id === 'main') || {};
      try {
        const out = await this.ai.runAi(ai[1], body, data, settings);
        const record = this.upsert(user.id, 'aiHistory', {
          id: crypto.randomUUID(),
          kind: ai[1],
          label: out.label,
          mode: body.mode || null,
          refId: body.refId || null,
          input: input || body.summary || out.label,
          output: out.text,
          model: out.model,
        });
        return json(record);
      } catch (err) {
        const e = this.ai.aiErrorMessage(err);
        console.error('[AI]', ai[1], err?.status || '', err?.message);
        return json({ error: e.message }, e.status);
      }
    }

    return json({ error: '找不到這個 API' }, 404);
  }
}

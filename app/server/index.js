// 小陳的 30 天經營系統 — 後端 API 與網站伺服器
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
// 讀取 app/.env（若存在）。部署平台通常直接設定環境變數，不需要 .env 檔。
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { default: express } = await import('express');
const { openDb, makeRepo, COLLECTIONS } = await import('./db.js');
const { makeAuth } = await import('./auth.js');
const { runAi, aiConfigured, aiErrorMessage, AI_MODEL } = await import('./ai.js');

export function createApp({ dbFile = process.env.DATABASE_PATH || path.join(root, 'data', 'app.db') } = {}) {
  const db = openDb(dbFile);
  const repo = makeRepo(db);
  const auth = makeAuth(db);
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const allowRegistration = () => auth.userCount() === 0 || process.env.ALLOW_REGISTRATION === 'true';

  app.get('/api/status', (req, res) => {
    res.json({
      ok: true,
      storage: 'sqlite',
      aiConfigured: aiConfigured(),
      aiModel: aiConfigured() ? AI_MODEL : null,
      registrationOpen: allowRegistration(),
    });
  });

  // ---------- 帳號 ----------
  const validCred = (b) => {
    const username = String(b?.username || '').trim();
    const password = String(b?.password || '');
    if (username.length < 2 || username.length > 40) return { error: '帳號需為 2～40 個字' };
    if (password.length < 6) return { error: '密碼至少 6 個字元' };
    return { username, password };
  };

  app.post('/api/auth/register', (req, res) => {
    if (!allowRegistration()) return res.status(403).json({ error: '目前未開放註冊新帳號，請使用既有帳號登入。' });
    const c = validCred(req.body);
    if (c.error) return res.status(400).json({ error: c.error });
    if (auth.exists(c.username)) return res.status(409).json({ error: '這個帳號已經有人使用' });
    res.json(auth.register(c.username, c.password));
  });

  app.post('/api/auth/login', (req, res) => {
    const c = validCred(req.body);
    if (c.error) return res.status(400).json({ error: '帳號或密碼錯誤' });
    const r = auth.login(c.username, c.password);
    if (!r) return res.status(401).json({ error: '帳號或密碼錯誤' });
    res.json(r);
  });

  const requireUser = (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user = auth.lookup(token);
    if (!user) return res.status(401).json({ error: '登入已過期，請重新登入' });
    req.user = user;
    req.token = token;
    next();
  };

  app.get('/api/auth/me', requireUser, (req, res) => res.json({ user: req.user }));
  app.post('/api/auth/logout', requireUser, (req, res) => {
    auth.logout(req.token);
    res.json({ ok: true });
  });

  // ---------- 資料 ----------
  const checkCollection = (req, res, next) => {
    if (!COLLECTIONS.includes(req.params.collection)) return res.status(404).json({ error: '找不到這個資料類型' });
    next();
  };

  app.get('/api/data', requireUser, (req, res) => res.json(repo.all(req.user.id)));

  app.put('/api/data/:collection/:id', requireUser, checkCollection, (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: '資料格式錯誤' });
    const saved = repo.upsert(req.user.id, req.params.collection, { ...body, id: req.params.id });
    res.json(saved);
  });

  // 批次寫入（例如建立 30 天預設計畫）
  app.post('/api/data/:collection/batch', requireUser, checkCollection, (req, res) => {
    const list = Array.isArray(req.body?.records) ? req.body.records : null;
    if (!list) return res.status(400).json({ error: '資料格式錯誤' });
    db.exec('BEGIN');
    try {
      const saved = list.map((r) => repo.upsert(req.user.id, req.params.collection, r));
      db.exec('COMMIT');
      res.json(saved);
    } catch (e) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: '儲存失敗：' + e.message });
    }
  });

  app.delete('/api/data/:collection/:id', requireUser, checkCollection, (req, res) => {
    repo.remove(req.user.id, req.params.collection, req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/import', requireUser, (req, res) => {
    const payload = req.body?.data;
    if (!payload || typeof payload !== 'object') return res.status(400).json({ error: '備份檔格式錯誤' });
    try {
      repo.replaceAll(req.user.id, payload);
      res.json(repo.all(req.user.id));
    } catch (e) {
      res.status(500).json({ error: '匯入失敗，原本的資料沒有被更動：' + e.message });
    }
  });

  // ---------- AI ----------
  app.post('/api/ai/:kind', requireUser, async (req, res) => {
    if (!aiConfigured()) {
      return res.status(503).json({ error: 'AI 尚未設定：請在伺服器環境變數設定 ANTHROPIC_API_KEY 後重新啟動。', code: 'AI_NOT_CONFIGURED' });
    }
    const input = String(req.body?.input || '');
    if (input.length > 20000) return res.status(400).json({ error: '輸入內容太長，請精簡到 20,000 字以內' });
    const data = repo.all(req.user.id);
    const settings = data.settings.find((s) => s.id === 'main') || {};
    try {
      const out = await runAi(req.params.kind, req.body || {}, data, settings);
      const record = repo.upsert(req.user.id, 'aiHistory', {
        id: crypto.randomUUID(),
        kind: req.params.kind,
        label: out.label,
        mode: req.body?.mode || null,
        refId: req.body?.refId || null,
        input: input || req.body?.summary || out.label,
        output: out.text,
        model: out.model,
      });
      res.json(record);
    } catch (err) {
      const e = aiErrorMessage(err);
      console.error('[AI]', req.params.kind, err?.status || '', err?.message);
      res.status(e.status).json({ error: e.message });
    }
  });

  // ---------- 前端網站 ----------
  const dist = path.join(root, 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use('/api', (req, res) => res.status(404).json({ error: '找不到這個 API' }));

  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8787;
  createApp().listen(port, () => {
    console.log(`小陳的 30 天經營系統已啟動：http://localhost:${port}`);
    console.log(aiConfigured() ? `AI 已設定（模型 ${AI_MODEL}）` : 'AI 尚未設定：請在 .env 設定 ANTHROPIC_API_KEY');
  });
}

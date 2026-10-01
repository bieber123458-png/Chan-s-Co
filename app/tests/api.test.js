import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.ANTHROPIC_API_KEY;
const { createApp } = await import('../server/index.js');

test('API：註冊、存取、刪除、資料隔離與 AI 未設定提示', async (t) => {
  const server = createApp({ dbFile: ':memory:' }).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json() };
  };

  const st = await call('GET', '/api/status');
  assert.equal(st.json.aiConfigured, false);
  assert.equal(st.json.registrationOpen, true);

  const reg = await call('POST', '/api/auth/register', { username: 'xiaochen', password: 'secret123' });
  assert.equal(reg.status, 200);
  const token = reg.json.token;

  // 第一個帳號建立後，預設關閉註冊
  const reg2 = await call('POST', '/api/auth/register', { username: 'other', password: 'secret123' });
  assert.equal(reg2.status, 403);

  assert.equal((await call('GET', '/api/data')).status, 401);
  const put = await call('PUT', '/api/data/transactions/t1', { date: '2026-10-01', type: 'income', amount: 1000 }, token);
  assert.equal(put.status, 200);
  await call('PUT', '/api/data/transactions/t1', { date: '2026-10-01', type: 'income', amount: 1200 }, token);
  let all = await call('GET', '/api/data', null, token);
  assert.equal(all.json.transactions.length, 1);
  assert.equal(all.json.transactions[0].amount, 1200);

  const bad = await call('PUT', '/api/data/hack/x', { a: 1 }, token);
  assert.equal(bad.status, 404);

  await call('DELETE', '/api/data/transactions/t1', null, token);
  all = await call('GET', '/api/data', null, token);
  assert.equal(all.json.transactions.length, 0);

  const ai = await call('POST', '/api/ai/coach', { input: '你好' }, token);
  assert.equal(ai.status, 503);
  assert.equal(ai.json.code, 'AI_NOT_CONFIGURED');

  const login = await call('POST', '/api/auth/login', { username: 'xiaochen', password: 'wrong-pass' });
  assert.equal(login.status, 401);
});

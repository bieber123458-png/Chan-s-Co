import test from 'node:test';
import assert from 'node:assert/strict';

// 模擬 claude.ai 頁面提供的 db / user / sample / downloads
function fakeClaude({ sampleText = '### 建議\n- 測試回覆' } = {}) {
  const store = new Map();
  const calls = { sample: [], downloads: [] };
  const docRef = (path) => ({
    path,
    set: async (d) => { store.set(path, JSON.parse(JSON.stringify(d))); },
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    delete: async () => { store.delete(path); },
    collection: (name) => colRef(`${path}/${name}`),
  });
  const colRef = (path) => ({
    doc: (id) => docRef(`${path}/${id}`),
    limit() { return this; },
    get: async () => {
      const docs = [...store.entries()]
        .filter(([k]) => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/'))
        .map(([k, v]) => ({ id: k.split('/').pop(), exists: true, data: () => v }));
      return { docs, size: docs.length, empty: !docs.length };
    },
  });
  const db = { doc: docRef, collection: colRef };
  const sample = async (input, opts) => { calls.sample.push({ input, opts }); return { text: sampleText, truncated: false, modelTierApplied: 'default' }; };
  const caps = { db, user: { id: async () => 'u_owner' }, sample, downloads: { save: async (x) => calls.downloads.push(x) } };
  return { store, calls, claude: { use: async (n) => caps[n] ?? null } };
}

test('Claude 雲端模式：存取、刪除、AI 與備份下載', async () => {
  const fake = fakeClaude();
  globalThis.window = { claude: fake.claude };
  const { connectCloud } = await import('../src/lib/cloud.js');
  const cloud = await connectCloud();
  assert.ok(cloud);

  await cloud.put('transactions', { id: 't1', date: '2026-10-01', type: 'income', amount: 1000 });
  await cloud.batch('tasks', [{ id: 'plan2-1-0', day: 1, title: 'a' }, { id: 'plan2-1-1', day: 1, title: 'b' }]);
  assert.ok([...fake.store.keys()].every((k) => k.startsWith('data/users/u_owner/app/')), '資料存在使用者私人區');

  let data = await cloud.loadAll();
  assert.equal(data.transactions[0].amount, 1000);
  assert.equal(data.tasks.length, 2);

  await cloud.delMany('tasks', ['plan2-1-0']);
  await cloud.del('transactions', 't1');
  data = await cloud.loadAll();
  assert.equal(data.tasks.length, 1);
  assert.equal(data.transactions.length, 0);

  const rec = await cloud.ai('coach', { mode: 'story', input: '限動沒人回' }, data, { igHandle: 'chan1201_' });
  assert.equal(rec.kind, 'coach');
  assert.match(rec.output, /測試回覆/);
  const sent = fake.calls.sample[0].input;
  assert.equal(typeof sent, 'string');
  assert.match(sent, /限動顧問/);
  assert.match(sent, /限動沒人回/);
  assert.equal((await cloud.loadAll()).aiHistory.length, 1, 'AI 紀錄已保存');

  const restored = await cloud.importAll({ posts: [{ id: 'p1', date: '2026-10-01', title: 'x' }] });
  assert.equal(restored.posts.length, 1);
  assert.equal(restored.tasks.length, 0, '還原會取代原本資料');

  await cloud.download('backup.json', '{}');
  assert.equal(fake.calls.downloads[0].filename, 'backup.json');
  delete globalThis.window;
});

test('沒有 Claude 環境時不啟用雲端模式', async () => {
  delete globalThis.window;
  const { connectCloud } = await import('../src/lib/cloud.js');
  assert.equal(await connectCloud(), null);
});

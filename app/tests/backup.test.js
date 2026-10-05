import test from 'node:test';
import assert from 'node:assert/strict';
import { autoBackup, localSnapshots, countRecords } from '../src/lib/backup.js';
import { generateMonthPlan } from '../src/lib/plan.js';

const fakeStorage = (limit = Infinity) => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (v.length > limit) throw new Error('QuotaExceeded'); m.set(k, v); },
    removeItem: (k) => m.delete(k),
  };
};
const sample = (n) => ({ todos: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, text: `待辦 ${i}`, date: '2026-10-05' })), weights: [] });

test('每天只自動備份一次，沒有資料時不備份', async () => {
  const snaps = localSnapshots(fakeStorage());
  assert.equal(await autoBackup(snaps, {}, 5, '2026-10-05'), false);
  assert.equal(await autoBackup(snaps, sample(3), 5, '2026-10-05'), true);
  assert.equal(await autoBackup(snaps, sample(4), 5, '2026-10-05'), false, '同一天不再備份');
  assert.equal(await autoBackup(snaps, sample(5), 5, '2026-10-06'), true);
  const list = await snaps.list();
  assert.deepEqual(list.map((s) => s.id), ['2026-10-06', '2026-10-05']);
  assert.equal(list[1].count, 3);
  assert.equal(countRecords(await snaps.load('2026-10-05')), 3, '內容是當天打開時的資料');
});

test('超過保留份數時刪除最舊的', async () => {
  const snaps = localSnapshots(fakeStorage());
  for (const d of ['01', '02', '03', '04']) {
    await autoBackup(snaps, sample(1), 3, `2026-10-${d}`);
    await new Promise((r) => setTimeout(r, 2));
  }
  assert.deepEqual((await snaps.list()).map((s) => s.id), ['2026-10-04', '2026-10-03', '2026-10-02']);
});

test('瀏覽器空間不夠時只刪最舊的備份，不會整個清掉', async () => {
  const storage = fakeStorage(Infinity);
  const snaps = localSnapshots(storage);
  await snaps.save('2026-10-01', sample(200), 'a');
  await new Promise((r) => setTimeout(r, 2));
  await snaps.save('2026-10-02', sample(200), 'b');
  const size = storage.getItem('xc30-snapshots').length;
  // 空間只夠放兩份：存第三份時刪掉最舊的
  const tight = fakeStorage(Math.ceil(size * 1.05));
  tight.setItem('xc30-snapshots', storage.getItem('xc30-snapshots'));
  const s2 = localSnapshots(tight);
  await new Promise((r) => setTimeout(r, 2));
  await s2.save('2026-10-03', sample(200), 'c');
  assert.deepEqual((await s2.list()).map((s) => s.id), ['2026-10-03', '2026-10-02']);
  // 一份都放不下：丟出錯誤，原本的備份保持不變
  const tiny = fakeStorage(10);
  const s3 = localSnapshots(tiny);
  await assert.rejects(() => s3.save('2026-10-04', sample(5), 'd'));
  assert.equal(tiny.getItem('xc30-snapshots'), null);
});

test('新版預設計畫：不再有美業主題，並加入觸及練習', () => {
  const tasks = generateMonthPlan({ start: '2026-10-05', length: 31, monthIndex: 1 });
  assert.ok(!tasks.some((t) => /美業|霧唇/.test(`${t.title}${t.goal}${t.description}`)));
  assert.ok(tasks.some((t) => t.title.startsWith('發布 Reels（減脂料理）')));
  assert.ok(tasks.some((t) => t.title.startsWith('發布 Reels（生活日常）')));
  assert.ok(tasks.some((t) => t.title.startsWith('觸及檢查')));
});

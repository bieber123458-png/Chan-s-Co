// 自動備份：每天第一次打開時，把「打開當下」的全部資料存一份快照
// - Claude 雲端：存在使用者自己的私人區，保留最近 20 份
// - 本機（瀏覽器）：存在這個瀏覽器，保留最近 5 份（空間有限，最多用 1.5MB）
import { COLLECTIONS } from './collections.js';
import { toDateStr } from './plan.js';

export const KEEP = { cloud: 20, local: 5 };

export const countRecords = (data) => COLLECTIONS.reduce((n, c) => n + ((data && data[c]) || []).length, 0);

export const snapshotPayload = (data) => ({ app: 'xiaochen-30-day-system', version: 1, exportedAt: new Date().toISOString(), data });

// 只保留最近 keep 份（依建立時間），其他刪除
export async function prune(snapshots, keep) {
  const list = await snapshots.list();
  for (const s of list.slice(keep)) await snapshots.remove(s.id);
}

// 今天還沒有自動備份、而且有資料時，存一份；回傳是否有存
export async function autoBackup(snapshots, data, keep, today = toDateStr()) {
  if (!snapshots || countRecords(data) === 0) return false;
  const list = await snapshots.list();
  if (list.some((s) => s.id === today)) return false;
  await snapshots.save(today, data, '每日自動備份');
  await prune(snapshots, keep);
  return true;
}

// 本機版：存在 localStorage。瀏覽器空間有限（約 5MB），備份最多用 1.5MB，
// 避免擠掉真正的資料；空間不夠時只刪最舊的備份，不會動到其他資料
const LOCAL_SNAP_KEY = 'xc30-snapshots';
const LOCAL_SNAP_BUDGET = 1500000;
export function localSnapshots(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  const read = () => {
    try { return JSON.parse(storage?.getItem(LOCAL_SNAP_KEY) || '[]'); } catch { return []; }
  };
  const tryWrite = (list) => {
    const text = JSON.stringify(list);
    if (text.length > LOCAL_SNAP_BUDGET) return false;
    try { storage.setItem(LOCAL_SNAP_KEY, text); return true; } catch { return false; }
  };
  const sorted = (list) => [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    async list() { return sorted(read()).map(({ data, ...meta }) => meta); }, // eslint-disable-line no-unused-vars
    async save(id, data, label) {
      const rec = { id, date: id.slice(0, 10), label, createdAt: new Date().toISOString(), count: countRecords(data), data };
      let old = sorted(read().filter((s) => s.id !== id));
      while (!tryWrite([rec, ...old])) {
        if (!old.length) throw new Error('這個瀏覽器的空間不夠存自動備份，請定期手動下載 JSON 備份');
        old = old.slice(0, -1);
      }
    },
    async load(id) {
      const s = read().find((x) => x.id === id);
      if (!s) throw new Error('找不到這份備份');
      return s.data;
    },
    async remove(id) { tryWrite(read().filter((s) => s.id !== id)); },
  };
}

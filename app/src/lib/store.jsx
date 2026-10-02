// 全域資料狀態：載入、儲存、刪除都經過這裡，並統一處理錯誤提示
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { remote, local, newId, emptyData } from './api.js';
import { DEFAULT_SETTINGS } from './stats.js';
import { dateOfDay } from './plan.js';
import { build, toPlainPrompt } from './prompts.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ mode, status, initialData, user, onLogout, toast, cloud, noCloud = false, leftover = null, children }) {
  const [data, setData] = useState(() => ({ ...emptyData(), ...initialData }));
  const [pending, setPending] = useState(0);
  const rawBackend = mode === 'remote' ? remote : mode === 'cloud' ? cloud : local;
  // 計算正在儲存的筆數，讓畫面顯示「儲存中…／已自動存到雲端」
  const backend = useMemo(() => {
    const track = (fn) => async (...args) => {
      setPending((n) => n + 1);
      try { return await fn(...args); } finally { setPending((n) => n - 1); }
    };
    return { ...rawBackend, put: track(rawBackend.put), batch: track(rawBackend.batch), del: track(rawBackend.del), delMany: track(rawBackend.delMany) };
  }, [rawBackend]);
  const dataRef = useRef(data);
  dataRef.current = data;

  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...(data.settings.find((s) => s.id === 'main') || {}) }),
    [data.settings],
  );

  const replaceIn = (col, rec) => setData((d) => {
    const list = d[col] || [];
    const i = list.findIndex((x) => x.id === rec.id);
    const next = i >= 0 ? list.map((x, j) => (j === i ? rec : x)) : [...list, rec];
    return { ...d, [col]: next };
  });

  // 儲存單筆（新增或更新）。先更新畫面，失敗時還原並提示。
  const save = useCallback(async (col, rec, { silent = false } = {}) => {
    const record = { ...rec, id: rec.id ?? newId() };
    const prev = dataRef.current[col];
    replaceIn(col, { ...record, updatedAt: new Date().toISOString() });
    try {
      const saved = await backend.put(col, record);
      replaceIn(col, saved);
      if (!silent) toast('已儲存', 'success');
      return saved;
    } catch (e) {
      setData((d) => ({ ...d, [col]: prev }));
      toast(`儲存失敗：${e.message}`, 'error');
      if (e.status === 401) onLogout();
      return null;
    }
  }, [backend, toast, onLogout]);

  const saveMany = useCallback(async (col, records) => {
    try {
      const saved = await backend.batch(col, records.map((r) => ({ ...r, id: r.id ?? newId() })));
      setData((d) => {
        const map = new Map((d[col] || []).map((x) => [x.id, x]));
        saved.forEach((r) => map.set(r.id, r));
        return { ...d, [col]: [...map.values()] };
      });
      return saved;
    } catch (e) {
      toast(`儲存失敗：${e.message}`, 'error');
      return null;
    }
  }, [backend, toast]);

  const remove = useCallback(async (col, id, { silent = false } = {}) => {
    const prev = dataRef.current[col];
    setData((d) => ({ ...d, [col]: d[col].filter((x) => x.id !== id) }));
    try {
      await backend.del(col, id);
      if (!silent) toast('已刪除', 'success');
      return true;
    } catch (e) {
      setData((d) => ({ ...d, [col]: prev }));
      toast(`刪除失敗：${e.message}`, 'error');
      return false;
    }
  }, [backend, toast]);

  const removeMany = useCallback(async (col, ids) => {
    try {
      await backend.delMany(col, ids);
      const set = new Set(ids);
      setData((d) => ({ ...d, [col]: d[col].filter((x) => !set.has(x.id)) }));
      return true;
    } catch (e) {
      toast(`刪除失敗：${e.message}`, 'error');
      return false;
    }
  }, [backend, toast]);

  const saveSettings = useCallback((patch, opts) => save('settings', { ...settings, ...patch, id: 'main' }, opts), [save, settings]);

  const importAll = useCallback(async (payload) => {
    const next = await backend.importAll(payload);
    setData({ ...emptyData(), ...next });
  }, [backend]);

  // 呼叫 AI。成功後把紀錄加入 AI 歷史並回傳；失敗時丟出錯誤讓元件顯示
  const ai = useCallback(async (kind, body) => {
    const rec = await backend.ai(kind, body, dataRef.current, settings);
    replaceIn('aiHistory', rec);
    return rec;
  }, [backend, settings]);

  // 沒有連接 AI 時：組出要貼給 Claude 的完整指令，以及把 Claude 的回覆存回系統
  const promptFor = useCallback((kind, body) => {
    const spec = build(kind, body, dataRef.current, settings);
    if (!spec) throw new Error('不支援的 AI 功能');
    return { label: spec.label, text: toPlainPrompt(spec) };
  }, [settings]);

  const saveManualAi = useCallback((kind, body, label, output) => save('aiHistory', {
    kind,
    label,
    mode: body.mode || null,
    refId: body.refId || null,
    input: String(body.input || '') || body.summary || label,
    output: output.trim(),
    model: 'Claude（手動貼上）',
  }), [save]);

  // 下載檔案：Claude 雲端模式透過平台的下載確認視窗，其他模式用瀏覽器下載
  const downloadFile = useCallback(async (filename, text, type) => {
    if (mode === 'cloud') {
      try { await cloud.download(filename, text); toast('已下載', 'success'); } catch (e) { if (e.code !== 'declined') toast(e.message, 'error'); }
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已下載', 'success');
  }, [mode, cloud, toast]);

  // 舊版（30 天計畫）的任務只有「第幾天」，一次性換算成實際日期
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current || !settings.startDate) return;
    const legacy = data.tasks.filter((t) => !t.date && t.day);
    if (!legacy.length) return;
    migrated.current = true;
    saveMany('tasks', legacy.map((t) => ({ ...t, date: dateOfDay(settings.startDate, t.day) })));
  }, [data.tasks, settings.startDate, saveMany]);

  const value = {
    noCloud, leftover, saving: pending > 0,
    mode, status, user, data, settings, save, saveMany, remove, removeMany, saveSettings, importAll, ai, toast, downloadFile, promptFor, saveManualAi, logout: onLogout,
    aiReady: mode === 'cloud' || (mode === 'remote' && !!status?.aiConfigured),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

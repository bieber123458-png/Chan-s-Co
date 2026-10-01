// 全域資料狀態：載入、儲存、刪除都經過這裡，並統一處理錯誤提示
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { remote, local, newId, emptyData } from './api.js';
import { DEFAULT_SETTINGS } from './stats.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ mode, status, initialData, user, onLogout, toast, children }) {
  const [data, setData] = useState(() => ({ ...emptyData(), ...initialData }));
  const backend = mode === 'remote' ? remote : local;
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

  const saveSettings = useCallback((patch, opts) => save('settings', { ...settings, ...patch, id: 'main' }, opts), [save, settings]);

  const importAll = useCallback(async (payload) => {
    const next = await backend.importAll(payload);
    setData({ ...emptyData(), ...next });
  }, [backend]);

  // 呼叫 AI。成功後把紀錄加入 AI 歷史並回傳；失敗時丟出錯誤讓元件顯示
  const ai = useCallback(async (kind, body) => {
    const rec = await backend.ai(kind, body);
    replaceIn('aiHistory', rec);
    return rec;
  }, [backend]);

  const value = {
    mode, status, user, data, settings, save, saveMany, remove, saveSettings, importAll, ai, toast, logout: onLogout,
    aiReady: mode === 'remote' && !!status?.aiConfigured,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

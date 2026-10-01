// AI 建議面板：按鈕、載入、錯誤、結果與歷史紀錄
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Markdown } from '../lib/markdown.jsx';
import { fmtDateTime } from '../lib/format.js';

export function AiNotice() {
  const { mode, status } = useStore();
  if (mode === 'cloud') return null;
  if (mode !== 'remote') {
    return <div className="notice warn">目前是<strong>本機模式</strong>（沒有連到後端伺服器），AI 功能無法使用，資料只存在這個瀏覽器。請依 README 啟動伺服器。</div>;
  }
  if (!status?.aiConfigured) {
    return <div className="notice warn"><strong>AI 尚未設定。</strong>請在伺服器的環境變數設定 <code>ANTHROPIC_API_KEY</code> 後重新啟動，AI 建議才會真正運作。其他功能可以正常使用。</div>;
  }
  return null;
}

export function AiResult({ record, onDelete }) {
  if (!record) return null;
  return (
    <div className="ai-box">
      <div className="ai-head">
        <span>✦ {record.label || 'AI 建議'}・{fmtDateTime(record.createdAt)}</span>
        {onDelete && <button className="icon-btn tiny" onClick={() => onDelete(record)} aria-label="刪除這則 AI 建議">刪除</button>}
      </div>
      <Markdown text={record.output} />
    </div>
  );
}

// kind：AI 功能種類；buildBody：送出時組成內容；refId：關聯的紀錄（只顯示該紀錄的歷史）
// beforeRun：送出前要做的事（例如先儲存草稿），回傳 false 則中止
export function AiPanel({ kind, buildBody, refId, label = '請 AI 給我建議', showHistory = true, inputPlaceholder, validate, beforeRun }) {
  const { ai, aiReady, data, remove } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extra, setExtra] = useState('');
  const [showAll, setShowAll] = useState(false);
  const history = refId
    ? data.aiHistory.filter((h) => h.refId === refId && h.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const run = async () => {
    const problem = validate?.();
    if (problem) { setError(problem); return; }
    setLoading(true);
    setError('');
    try {
      if (beforeRun && (await beforeRun()) === false) return;
      await ai(kind, { ...buildBody(extra), refId });
      setExtra('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt">
      {inputPlaceholder !== undefined && (
        <textarea className="input" rows={2} placeholder={inputPlaceholder} value={extra} onChange={(e) => setExtra(e.target.value)} />
      )}
      <div className="row mt">
        <button className="btn gold sm" onClick={run} disabled={loading || !aiReady} title={aiReady ? '' : 'AI 尚未設定'}>
          {loading ? <><span className="spinner" /> AI 思考中…</> : `✦ ${label}`}
        </button>
        {!aiReady && <span className="tiny muted">AI 尚未設定，無法使用</span>}
      </div>
      {error && <div className="notice err mt">{error}</div>}
      {showHistory && history.slice(0, showAll ? undefined : 1).map((h) => (
        <AiResult key={h.id} record={h} onDelete={(r) => remove('aiHistory', r.id)} />
      ))}
      {showHistory && history.length > 1 && (
        <button className="btn ghost sm mt" onClick={() => setShowAll((s) => !s)}>
          {showAll ? '只看最新一則' : `查看過去 ${history.length - 1} 則建議`}
        </button>
      )}
    </div>
  );
}

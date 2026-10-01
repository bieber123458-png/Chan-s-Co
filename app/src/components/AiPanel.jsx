// AI 建議面板：按鈕、載入、錯誤、結果與歷史紀錄
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Markdown } from '../lib/markdown.jsx';
import { fmtDateTime } from '../lib/format.js';

// 可使用 AI 與雲端同步的 Claude 版網址
export const CLAUDE_VERSION_URL = 'https://claude.ai/artifact/F2PQFSr8zmMLUrR6tYB7SS';

const CLAUDE_APP_URL = 'https://claude.ai/new';

// 沒有連接 AI 時的做法：複製整理好的指令 → 貼到 Claude → 把回覆貼回來儲存
// getBody：回傳送給 AI 的內容（與自動 AI 相同）；beforeRun：複製前要做的事（例如先存草稿）
export function ManualClaude({ kind, getBody, label = '複製給 Claude', beforeRun, validate, onSaved, compact }) {
  const { promptFor, saveManualAi, toast } = useStore();
  const [step, setStep] = useState(null); // null | { body, label, text, copied }
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const copy = async () => {
    const problem = validate?.();
    if (problem) { setError(problem); return; }
    setError('');
    try {
      if (beforeRun && (await beforeRun()) === false) return;
      const body = getBody();
      const p = promptFor(kind, body);
      let copied = false;
      try { await navigator.clipboard.writeText(p.text); copied = true; } catch { copied = false; }
      setStep({ body, label: p.label, text: p.text, copied });
      if (copied) toast('已複製，請貼到 Claude', 'success');
    } catch (e) {
      setError(e.message);
    }
  };

  const saveReply = async () => {
    if (reply.trim().length < 5) { setError('請先把 Claude 的回覆貼上來'); return; }
    setSaving(true);
    const ok = await saveManualAi(kind, step.body, step.label, reply);
    setSaving(false);
    if (ok) { setReply(''); setStep(null); setError(''); onSaved?.(ok); }
  };

  return (
    <div className={compact ? '' : 'mt'}>
      <div className="row">
        <button type="button" className="btn gold sm" onClick={copy}>📋 {label}</button>
        {!step && <span className="tiny muted">複製整理好的指令，貼到 Claude 就能得到建議</span>}
      </div>
      {error && <div className="notice err mt">{error}</div>}
      {step && (
        <div className="ai-box">
          <div className="small">
            {step.copied ? <strong>✓ 已複製指令。</strong> : <strong>這個瀏覽器不允許自動複製，請長按下面的文字全選後複製。</strong>}
            <ol style={{ margin: '6px 0', paddingLeft: 20 }}>
              <li>打開 <a href={CLAUDE_APP_URL} target="_blank" rel="noreferrer">Claude</a>（或 Claude App），開一個新對話。</li>
              <li>貼上指令送出，等 Claude 回覆。</li>
              <li>複製 Claude 的回覆，貼到下面的框框，按「儲存回覆」。</li>
            </ol>
          </div>
          {!step.copied && <textarea className="input" rows={6} readOnly value={step.text} onFocus={(e) => e.target.select()} />}
          <textarea className="input mt" rows={5} placeholder="把 Claude 的回覆貼在這裡" value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="row mt">
            <button type="button" className="btn sm" disabled={saving} onClick={saveReply}>{saving ? <span className="spinner" /> : null}儲存回覆</button>
            <button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(step.text); toast('已再次複製', 'success'); } catch { toast('無法自動複製', 'error'); } }}>再複製一次</button>
            <button type="button" className="btn ghost sm" onClick={() => { setStep(null); setReply(''); }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AiNotice() {
  const { mode, status } = useStore();
  if (mode === 'cloud') return null;
  if (mode !== 'remote') {
    return (
      <div className="notice warn">
        目前是<strong>網頁版</strong>：AI 按鈕會變成「📋 複製給 Claude」，把整理好的指令貼到 Claude 就能得到建議，再把回覆貼回來儲存。資料只存在這個瀏覽器，請定期在「設定與備份」下載備份。
      </div>
    );
  }
  if (!status?.aiConfigured) {
    return <div className="notice warn"><strong>AI 尚未設定。</strong>請在主機（Cloudflare 或伺服器）設定 <code>ANTHROPIC_API_KEY</code>，AI 建議才會運作。其他功能可以正常使用。</div>;
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
      {aiReady ? (
        <div className="row mt">
          <button className="btn gold sm" onClick={run} disabled={loading}>
            {loading ? <><span className="spinner" /> AI 思考中…</> : `✦ ${label}`}
          </button>
        </div>
      ) : (
        <ManualClaude kind={kind} validate={validate} beforeRun={beforeRun}
          getBody={() => ({ ...buildBody(extra), refId })} onSaved={() => setExtra('')} />
      )}
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

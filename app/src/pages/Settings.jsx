import { useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Field, Confirm } from '../components/ui.jsx';
import { COLLECTIONS } from '../lib/collections.js';
import { toDateStr } from '../lib/plan.js';
import { cleanIgHandle } from '../lib/stats.js';

const CSV_SETS = {
  transactions: ['收支紀錄', ['date', 'type', 'category', 'amount', 'note']],
  debts: ['負債清單', ['name', 'startBalance', 'apr', 'minPayment', 'dueDay', 'plannedPayment', 'note']],
  debtPayments: ['還款紀錄', ['date', 'debtId', 'total', 'principal', 'interest', 'extra', 'note']],
  savingsGoals: ['存錢目標', ['name', 'purpose', 'target', 'targetDate', 'monthlyAmount', 'isEmergency']],
  deposits: ['存款紀錄', ['date', 'goalId', 'kind', 'amount', 'account', 'note']],
  posts: ['IG 內容數據', ['date', 'format', 'topic', 'title', 'views', 'reach', 'shares', 'saves', 'comments', 'follows', 'leads', 'notes']],
  orders: ['零售訂單', ['date', 'customer', 'product', 'qty', 'revenue', 'cost', 'note']],
  stories: ['限動紀錄', ['date', 'slot', 'type', 'status', 'frameCount', 'hook', 'sticker', 'firstViews', 'lastViews', 'interactions', 'replies', 'shares', 'linkClicks', 'notes']],
  igSnapshots: ['粉絲數紀錄', ['date', 'followers', 'views30', 'newFollowers30', 'shared30', 'note']],
  teamSnapshots: ['團隊紀錄', ['date', 'total', 'active', 'newMembers', 'trainings', 'note']],
  tasks: ['任務', ['day', 'category', 'title', 'priority', 'points', 'done', 'minutes', 'result', 'reflection']],
  habits: ['習慣', ['id', 'exercise', 'water', 'sleep', 'reading', 'mood', 'food']],
  journals: ['日記', ['date', 'text']],
};

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function Settings() {
  const { data, settings, saveSettings, importAll, mode, status, user, toast } = useStore();
  const [f, setF] = useState({ displayName: settings.displayName, goals: settings.goals, emergencyMonths: settings.emergencyMonths, igHandle: settings.igHandle, igPositioning: settings.igPositioning });
  const [pending, setPending] = useState(null);
  const fileRef = useRef(null);

  const saveProfile = () => {
    const em = Number(f.emergencyMonths);
    if (!Number.isFinite(em) || em < 0 || em > 24) { toast('緊急預備金月數請輸入 0～24', 'error'); return; }
    const ig = cleanIgHandle(f.igHandle);
    if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) { toast('IG 帳號格式不正確（只能有英文、數字、底線與句點）', 'error'); return; }
    setF({ ...f, igHandle: ig });
    saveSettings({ displayName: f.displayName.trim() || '小陳', goals: f.goals, emergencyMonths: em, igHandle: ig, igPositioning: f.igPositioning });
  };

  const exportJson = () => {
    const payload = { app: 'xiaochen-30-day-system', version: 1, exportedAt: new Date().toISOString(), data };
    download(`30天經營系統備份-${toDateStr()}.json`, JSON.stringify(payload, null, 2), 'application/json');
    toast('已下載 JSON 備份', 'success');
  };

  const exportCsv = (key) => {
    const [name, cols] = CSV_SETS[key];
    const rows = [cols.join(','), ...data[key].map((r) => cols.map((c) => csvCell(r[c])).join(','))];
    // 加上 BOM，Excel 開啟中文才不會亂碼
    download(`${name}-${toDateStr()}.csv`, '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const payload = json.data || json;
      if (typeof payload !== 'object' || !COLLECTIONS.some((c) => Array.isArray(payload[c]))) throw new Error('不是這個系統的備份檔');
      setPending(payload);
    } catch (err) {
      toast(`無法讀取備份：${err.message}`, 'error');
    }
  };

  const count = COLLECTIONS.reduce((n, c) => n + data[c].length, 0);

  return (
    <>
      <PageHead eyebrow="SETTINGS" title="設定與備份" />
      <Card title="個人設定">
        <div className="form-grid">
          <Field label="稱呼"><input className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
          <Field label="緊急預備金目標（幾個月必要生活費）"><input className="input" type="number" min="0" max="24" value={f.emergencyMonths} onChange={(e) => setF({ ...f, emergencyMonths: e.target.value })} /></Field>
          <Field label="Instagram 帳號" hint="可貼網址或 @帳號，系統只保留帳號名稱"><input className="input" value={f.igHandle} onChange={(e) => setF({ ...f, igHandle: e.target.value })} placeholder="chan1201_" /></Field>
          <Field label="帳號定位（AI 分析內容時會參考）" full hint="例如：美業經營教學，幫美業新手做出有預約的 IG；主要受眾是剛開店 1～3 年的美睫美甲師"><textarea className="input" rows={2} value={f.igPositioning} onChange={(e) => setF({ ...f, igPositioning: e.target.value })} /></Field>
          <Field label="個人目標（AI 每次都會參考）" full><textarea className="input" rows={4} value={f.goals} onChange={(e) => setF({ ...f, goals: e.target.value })} /></Field>
        </div>
        <button className="btn" onClick={saveProfile}>儲存設定</button>
      </Card>

      <Card title="資料儲存與 AI 狀態">
        {mode === 'remote' ? (
          <div className="notice ok small">資料儲存在伺服器的 SQLite 資料庫（帳號：{user?.username}）。換裝置、換瀏覽器登入同一個帳號都能看到相同資料。</div>
        ) : (
          <div className="notice warn small"><strong>本機模式：</strong>資料只存在這台裝置的這個瀏覽器（localStorage）。清除瀏覽器資料、使用無痕模式或換裝置都會看不到，也無法跨裝置同步。請定期匯出 JSON 備份。</div>
        )}
        <div className="small">
          <div>AI 狀態：{mode !== 'remote' ? '無法使用（沒有後端）' : status?.aiConfigured ? `已設定（模型 ${status.aiModel}）` : '尚未設定 ANTHROPIC_API_KEY'}</div>
          <div>Instagram：{settings.igHandle ? <>@{settings.igHandle}（<a href={`https://www.instagram.com/${settings.igHandle}/`} target="_blank" rel="noreferrer">開啟帳號</a>）・</> : null}未連接後台，社群數據需手動輸入。</div>
          <div>目前共有 {count} 筆資料。</div>
        </div>
      </Card>

      <Card title="匯出備份">
        <p className="small muted mb">JSON 是完整備份，可以用來還原；CSV 方便用 Excel 或 Google 試算表查看。</p>
        <button className="btn" onClick={exportJson}>下載完整 JSON 備份</button>
        <div className="chips mt">
          {Object.entries(CSV_SETS).map(([k, [name]]) => (
            <button key={k} className="chip" onClick={() => exportCsv(k)} disabled={!data[k].length}>{name} CSV（{data[k].length}）</button>
          ))}
        </div>
      </Card>

      <Card title="從備份還原">
        <p className="small muted mb">匯入 JSON 備份會<strong>取代目前所有資料</strong>。建議先下載一份目前的備份。</p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: 'none' }} />
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>選擇備份檔…</button>
      </Card>

      {pending && (
        <Confirm title="確定要還原備份嗎？" confirmText="確定取代" strong onClose={() => setPending(null)}
          message={`備份內共有 ${COLLECTIONS.reduce((n, c) => n + (pending[c]?.length || 0), 0)} 筆資料，會取代目前的 ${count} 筆資料。`}
          onConfirm={async () => {
            try { await importAll(pending); toast('已還原備份', 'success'); } catch (e) { toast(`還原失敗：${e.message}`, 'error'); }
          }} />
      )}
    </>
  );
}

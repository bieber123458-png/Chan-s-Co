import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Field, Confirm } from '../components/ui.jsx';
import { COLLECTIONS } from '../lib/collections.js';
import { toDateStr } from '../lib/plan.js';
import { cleanIgHandle } from '../lib/stats.js';
import { detectBackend, getApiBase, setApiBase } from '../lib/api.js';

// 連接 Cloudflare 後端：讓 GitHub 網頁版也能登入、同步資料、使用 AI
function ConnectBackend() {
  const { mode, toast } = useStore();
  const base = getApiBase();
  const [url, setUrl] = useState(base || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const connect = async () => {
    const clean = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s]+$/.test(clean)) { setErr('請貼上完整網址，例如 https://xiaochen-system.你的帳號.workers.dev'); return; }
    setBusy(true); setErr('');
    const status = await detectBackend(clean);
    setBusy(false);
    if (!status) { setErr('連不到這個網址。請確認網址正確、後端已部署完成，並且 ALLOWED_ORIGINS 有包含這個網站。'); return; }
    setApiBase(clean);
    toast('已連接，請登入', 'success');
    setTimeout(() => window.location.reload(), 600);
  };

  if (mode === 'cloud') return null;
  if (mode === 'remote' && !base) return null;
  return (
    <Card title="連接 AI 主機（Cloudflare）">
      {mode === 'remote' ? (
        <>
          <p className="small">已連接：<code>{base}</code>。資料存在雲端，手機和電腦登入同一個帳號都看得到。</p>
          <button className="btn ghost sm mt" onClick={() => { setApiBase(null); window.location.reload(); }}>中斷連接，改用本機模式</button>
        </>
      ) : (
        <>
          <p className="small muted mb">部署好 Cloudflare 後端後，把它的網址貼在這裡，這個網頁就能使用 AI 教練，資料也會存到雲端。連接後要登入；目前這個瀏覽器裡的資料不會自動搬過去，請先下載 JSON 備份，登入後再從備份還原。</p>
          <Field label="後端網址" error={err}><input id="api-base" className="input" placeholder="https://xiaochen-system.你的帳號.workers.dev" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
          <button className="btn" disabled={busy} onClick={connect}>{busy ? <span className="spinner" /> : null}測試並連接</button>
        </>
      )}
    </Card>
  );
}

// 自動備份清單：每天第一次打開時自動存一份，可以下載或還原
function AutoBackups() {
  const { snapshots, backupNow, backupTick, keepBackups, importAll, downloadFile, toast, mode } = useStore();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);
  useEffect(() => {
    if (!snapshots) return undefined;
    let alive = true;
    snapshots.list().then((l) => { if (alive) setList(l); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [snapshots, backupTick]);
  if (!snapshots) return null;

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast(e.message || '操作失敗', 'error'); }
    setBusy('');
  };
  const download = (s) => run(`dl-${s.id}`, async () => {
    const d = await snapshots.load(s.id);
    downloadFile(`xiaochen-backup-${s.id}.json`, JSON.stringify({ app: 'xiaochen-30-day-system', version: 1, exportedAt: s.createdAt, data: d }, null, 2), 'application/json');
  });
  const restore = (s) => run(`rs-${s.id}`, async () => {
    const d = await snapshots.load(s.id);
    await importAll(d);
    toast(`已還原 ${s.id} 的備份（還原前的資料也另外存了一份）`, 'success');
  });

  return (
    <Card title="自動備份" action={<button className="btn ghost sm" disabled={!!busy} onClick={() => run('now', async () => { await backupNow(); toast('已備份', 'success'); })}>{busy === 'now' ? <span className="spinner" /> : null}立即備份</button>}>
      <p className="small muted mb">每天第一次打開系統時，會自動把所有資料存一份{mode === 'cloud' ? '到你的 Claude 私人雲端' : '在這個瀏覽器'}，保留最近 {keepBackups} 份。不小心刪錯或改錯，都可以從這裡下載或還原。{mode !== 'cloud' && '瀏覽器的空間有限，重要的資料請另外下載 JSON 備份。'}</p>
      {list === null ? <p className="small muted"><span className="spinner" /> 讀取中…</p> : list.length === 0 ? <p className="small muted">還沒有備份。明天第一次打開時會自動備份，也可以按「立即備份」。</p> : (
        list.map((s) => (
          <div key={s.id} className="list-item row between">
            <div><strong>{s.date}</strong> <span className="tiny muted">{s.id.length > 10 ? s.id.slice(11).replace(/^(\d\d)(\d\d)(\d\d)$/, '$1:$2') : ''}</span>
              <div className="tiny muted">{s.label || '自動備份'}・{s.count} 筆資料</div></div>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn ghost sm" disabled={!!busy} onClick={() => download(s)}>{busy === `dl-${s.id}` ? <span className="spinner" /> : null}下載</button>
              <button className="btn ghost sm" disabled={!!busy} onClick={() => setConfirm(s)}>{busy === `rs-${s.id}` ? <span className="spinner" /> : null}還原</button>
            </div>
          </div>
        ))
      )}
      {confirm && <Confirm title="還原這份備份？" confirmText="確定還原" strong onClose={() => setConfirm(null)}
        message={`會用 ${confirm.id} 的 ${confirm.count} 筆資料取代目前的資料。還原前，系統會先把目前的資料另外存一份，萬一選錯還能救回來。`}
        onConfirm={() => restore(confirm)} />}
    </Card>
  );
}

const CSV_SETS = {
  transactions: ['收支紀錄', ['date', 'type', 'owner', 'expenseKind', 'category', 'amount', 'payMethod', 'accountId', 'note']],
  accounts: ['帳戶', ['id', 'name', 'kind', 'initialBalance', 'closingDay', 'dueDay']],
  transfers: ['繳卡費紀錄', ['date', 'from', 'to', 'amount', 'note']],
  wishlist: ['願望清單', ['name', 'price', 'status', 'coolUntil', 'decidedAt', 'reason']],
  notes: ['財務筆記', ['date', 'text']],
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
  todos: ['每日待辦', ['date', 'text', 'done']],
  weights: ['體重紀錄', ['date', 'weight', 'bodyFat', 'waist', 'note']],
};

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function Settings() {
  const { data, settings, saveSettings, importAll, mode, status, user, toast, downloadFile } = useStore();
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
    downloadFile(`xiaochen-backup-${toDateStr()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  };

  const exportCsv = (key) => {
    const [, cols] = CSV_SETS[key];
    const rows = [cols.join(','), ...data[key].map((r) => cols.map((c) => csvCell(r[c])).join(','))];
    // 加上 BOM，Excel 開啟中文才不會亂碼
    downloadFile(`xiaochen-${key}-${toDateStr()}.csv`, '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
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
          <Field label="帳號定位（AI 分析內容時會參考）" full hint="例如：分享每天吃什麼、開箱好物和生活日常，走真實有個性的風格；主要受眾是 25～40 歲想把自己照顧好的女生"><textarea className="input" rows={2} value={f.igPositioning} onChange={(e) => setF({ ...f, igPositioning: e.target.value })} /></Field>
          <Field label="個人目標（AI 每次都會參考）" full><textarea className="input" rows={4} value={f.goals} onChange={(e) => setF({ ...f, goals: e.target.value })} /></Field>
        </div>
        <button className="btn" onClick={saveProfile}>儲存設定</button>
      </Card>

      <ConnectBackend />

      <Card title="資料儲存與 AI 狀態">
        {mode === 'remote' ? (
          <div className="notice ok small">資料儲存在{status?.storage === 'cloudflare' ? ' Cloudflare 雲端' : '伺服器的 SQLite 資料庫'}（帳號：{user?.username}）。換裝置、換瀏覽器登入同一個帳號都能看到相同資料。</div>
        ) : mode === 'cloud' ? (
          <div className="notice ok small"><strong>Claude 雲端模式：</strong>資料存在這個頁面的 Claude 雲端，放在只有你看得到的私人區。用同一個 Claude 帳號在手機或電腦打開這個連結，都會看到相同資料。就算把連結分享給別人，對方也看不到你的資料。</div>
        ) : (
          <div className="notice warn small"><strong>本機模式：</strong>資料只存在這台裝置的這個瀏覽器（localStorage）。清除瀏覽器資料、使用無痕模式或換裝置都會看不到，也無法跨裝置同步。請定期匯出 JSON 備份。</div>
        )}
        <div className="small">
          <div>AI 狀態：{mode === 'cloud' ? '使用你的 Claude 帳號（第一次使用會詢問是否允許，用量算在你的 Claude 方案內）' : mode !== 'remote' ? '無法使用（沒有後端）' : status?.aiConfigured ? `已設定（模型 ${status.aiModel}）` : '尚未設定 ANTHROPIC_API_KEY'}</div>
          <div>Instagram：{settings.igHandle ? <>@{settings.igHandle}（<a href={`https://www.instagram.com/${settings.igHandle}/`} target="_blank" rel="noreferrer">開啟帳號</a>）・</> : null}未連接後台，社群數據需手動輸入。</div>
          <div>目前共有 {count} 筆資料。</div>
        </div>
      </Card>

      <AutoBackups />

      <Card title="匯出備份">
        <p className="small muted mb">JSON 是完整備份，可以用來還原；CSV 方便用 Excel 或 Google 試算表查看。<br />想請 Claude 分析整體狀況：把 JSON 備份檔上傳到任何一個 Claude 新對話，請它「分析我這個月的經營狀況並給下個月建議」。</p>
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

// 存錢與負債的「更多」功能：記帳明細、月度檢視、信用卡、帳戶管理、願望清單、筆記
import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Card, Empty, Confirm, Chips, Field } from './ui.jsx';
import RecordForm, { blankFrom } from './RecordForm.jsx';
import { fmtMoney, fmtShortDate, fmtDate } from '../lib/format.js';
import { toDateStr } from '../lib/plan.js';
import {
  ACCOUNT_KINDS, SCOPES, TX_TYPES, WISH_STATUS, accountBalance, cardStatement, monthOf, txOwner, round, sum,
} from '../lib/finance.js';

export const MORE_ITEMS = [
  ['ledger', '📋', '記帳明細'], ['calendar', '📅', '月度檢視'], ['cards', '💳', '信用卡'], ['accounts', '🏦', '帳戶管理'],
  ['savings', '🎯', '目標追蹤'], ['wishlist', '♡', '願望清單'], ['debts', '＄', '負債追蹤'], ['notes', '✎', '筆記'],
  ['strategy', '⚖', '還款策略'], ['ai', '✦', 'AI 財務建議'],
];

export function MoreGrid({ go }) {
  return (
    <Card title="更多功能">
      <div className="icon-grid">
        {MORE_ITEMS.map(([k, icon, label]) => (
          <button key={k} type="button" className="icon-tile" onClick={() => go(k)}><span className="ico">{icon}</span><span>{label}</span></button>
        ))}
      </div>
    </Card>
  );
}

// ---------------- 帳戶管理 ----------------
const ACCOUNT_FIELDS = (banks) => [
  { key: 'name', label: '帳戶名稱', type: 'text', required: true, placeholder: '例如：郵局活存、國泰信用卡' },
  { key: 'kind', label: '類型', type: 'select', options: Object.entries(ACCOUNT_KINDS) },
  { key: 'initialBalance', label: '目前金額（信用卡填目前欠款）', type: 'money', default: 0, hint: '從今天開始記帳時的金額' },
  { key: 'closingDay', label: '信用卡結帳日（每月幾號）', type: 'number', min: 1, max: 31, hint: '只有信用卡要填' },
  { key: 'dueDay', label: '信用卡繳款截止日（每月幾號）', type: 'number', min: 1, max: 31 },
  { key: 'payFrom', label: '卡費從哪個帳戶扣', type: 'select', options: [['', '未設定'], ...banks.map((b) => [b.id, b.name])] },
];

export function AccountsView() {
  const { data, save, remove } = useStore();
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const banks = data.accounts.filter((a) => a.kind === 'bank' || a.kind === 'cash');
  const assets = round(sum(data.accounts.filter((a) => a.kind !== 'credit'), (a) => accountBalance(a, data)));
  const owed = round(sum(data.accounts.filter((a) => a.kind === 'credit'), (a) => accountBalance(a, data)));
  return (
    <Card title="帳戶管理" action={<button className="btn sm" onClick={() => setForm(blankFrom(ACCOUNT_FIELDS(banks), { kind: 'bank' }))}>＋ 新增帳戶</button>}>
      <p className="small muted mb">記帳時選擇從哪個帳戶付款，餘額會自動計算。現金與活存合計 <strong>{fmtMoney(assets)}</strong>，信用卡欠款 <strong>{fmtMoney(owed)}</strong>。</p>
      {data.accounts.length === 0 && <Empty title="還沒有帳戶">先新增「現金」和你常用的活存、信用卡。</Empty>}
      {Object.entries(ACCOUNT_KINDS).map(([k, label]) => {
        const list = data.accounts.filter((a) => a.kind === k);
        if (!list.length) return null;
        return (
          <div key={k} className="mb">
            <div className="small muted">{label}</div>
            {list.map((a) => (
              <div key={a.id} className="list-item row between">
                <div><strong>{a.name}</strong>{a.kind === 'credit' && <div className="tiny muted">結帳日 {a.closingDay || '?'} 日・繳款日 {a.dueDay || '?'} 日</div>}</div>
                <div className="row" style={{ gap: 4 }}>
                  <strong style={{ color: a.kind === 'credit' ? 'var(--err)' : 'var(--ink)' }}>{a.kind === 'credit' ? '欠 ' : ''}{fmtMoney(accountBalance(a, data))}</strong>
                  <button className="icon-btn" onClick={() => setForm(a)}>編輯</button>
                  <button className="icon-btn" onClick={() => setConfirm(a)}>刪除</button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {form && <RecordForm title={form.id ? '編輯帳戶' : '新增帳戶'} fields={ACCOUNT_FIELDS(banks.filter((b) => b.id !== form.id))} initial={{ payFrom: '', closingDay: '', dueDay: '', ...form }}
        check={(v) => (v.kind === 'credit' && (!v.closingDay || !v.dueDay) ? { closingDay: '信用卡請填結帳日與繳款日' } : {})}
        onSave={(v) => save('accounts', v)} onClose={() => setForm(null)} />}
      {confirm && <Confirm strong onClose={() => setConfirm(null)} onConfirm={() => remove('accounts', confirm.id)} message={`刪除帳戶「${confirm.name}」？已記錄的收支不會刪除，但不再計入這個帳戶。`} />}
    </Card>
  );
}

// ---------------- 信用卡 ----------------
export function CardsView({ go }) {
  const { data, save, remove } = useStore();
  const [pay, setPay] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const today = toDateStr();
  const cards = data.accounts.filter((a) => a.kind === 'credit');
  // 扣款帳戶：活存優先，其次簽帳卡、現金
  const banks = data.accounts.filter((a) => a.kind !== 'credit').sort((x, y) => ['bank', 'debit', 'cash'].indexOf(x.kind) - ['bank', 'debit', 'cash'].indexOf(y.kind));
  const payFields = [
    { key: 'date', label: '繳款日期', type: 'date', required: true },
    { key: 'from', label: '從哪個帳戶扣款', type: 'select', options: banks.length ? banks.map((b) => [b.id, b.name]) : [['', '（請先新增活存或現金帳戶）']] },
    { key: 'amount', label: '繳款金額（元）', type: 'money', required: true, positive: true },
    { key: 'note', label: '備註', type: 'text' },
  ];
  return (
    <>
      <Card title="信用卡" action={<button className="btn ghost sm" onClick={() => go('accounts')}>管理帳戶</button>}>
        <p className="small muted mb">刷卡的支出在刷卡當天就算進支出；繳卡費是「從活存轉到信用卡」，不會再算一次支出。</p>
        {cards.length === 0 && <Empty title="還沒有信用卡">到「帳戶管理」新增信用卡，填好結帳日與繳款日。</Empty>}
        {cards.map((c) => {
          const st = cardStatement(c, data, today);
          return (
            <div key={c.id} className="card soft">
              <div className="row between"><strong>{c.name}</strong><span className="tiny muted">目前總欠款 {fmtMoney(accountBalance(c, data))}</span></div>
              {st ? (
                <div className="grid grid-3 mt">
                  <div className="stat"><div className="stat-label">本期應繳</div><div className="stat-value" style={{ color: st.due ? 'var(--err)' : 'var(--ok)' }}>{fmtMoney(st.due)}</div><div className="stat-sub">截止 {st.dueDate ? fmtShortDate(st.dueDate) : '—'}</div></div>
                  <div className="stat"><div className="stat-label">未出帳</div><div className="stat-value">{fmtMoney(st.unbilled)}</div><div className="stat-sub">{fmtShortDate(st.lastClose)} 結帳後刷的</div></div>
                  <div className="stat"><div className="stat-label">本期已繳</div><div className="stat-value">{fmtMoney(st.paidSince)}</div><div className="stat-sub">帳單金額 {fmtMoney(st.billed)}</div></div>
                </div>
              ) : <p className="small muted mt">請到帳戶管理填結帳日，才能計算帳單。</p>}
              <button className="btn sm mt" onClick={() => setPay({ date: today, from: c.payFrom || banks[0]?.id || '', amount: st?.due || '', note: '', to: c.id })}>繳卡費</button>
            </div>
          );
        })}
      </Card>
      <Card title="繳卡費紀錄">
        {data.transfers.length === 0 ? <Empty title="還沒有繳款紀錄" /> : [...data.transfers].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
          <div key={t.id} className="list-item row between">
            <span>{fmtShortDate(t.date)}｜{data.accounts.find((a) => a.id === t.from)?.name || '?'} → {data.accounts.find((a) => a.id === t.to)?.name || '?'}</span>
            <span className="row" style={{ gap: 4 }}><strong>{fmtMoney(t.amount)}</strong><button className="icon-btn" onClick={() => setConfirm(t)}>刪除</button></span>
          </div>
        ))}
      </Card>
      {pay && <RecordForm title="繳卡費" fields={payFields} initial={pay} check={(v) => (!v.from ? { from: '請先新增扣款帳戶' } : {})}
        onSave={(v) => save('transfers', { ...v, kind: 'card-payment' })} onClose={() => setPay(null)} />}
      {confirm && <Confirm strong onClose={() => setConfirm(null)} onConfirm={() => remove('transfers', confirm.id)} message="刪除這筆繳款紀錄？帳戶餘額會重新計算。" />}
    </>
  );
}

// ---------------- 記帳明細 ----------------
export function LedgerView({ scope, onEdit }) {
  const { data, remove } = useStore();
  const [month, setMonth] = useState(toDateStr().slice(0, 7));
  const [type, setType] = useState('all');
  const [acct, setAcct] = useState('all');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(null);
  const list = data.transactions
    .filter((t) => txOwner(t) === scope && monthOf(t.date) === month)
    .filter((t) => type === 'all' || t.type === type)
    .filter((t) => acct === 'all' || t.accountId === acct)
    .filter((t) => !q || `${t.category} ${t.note}`.includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const byDate = list.reduce((m, t) => ((m[t.date] ||= []).push(t), m), {});
  const income = sum(list.filter((t) => t.type === 'income'), (t) => t.amount);
  const spend = sum(list.filter((t) => t.type !== 'income'), (t) => t.amount);
  return (
    <Card title={`記帳明細・${SCOPES[scope]}`}>
      <div className="form-grid">
        <Field label="月份"><input className="input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field>
        <Field label="搜尋分類或備註"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="例如：外食" /></Field>
        <Field label="類型"><select className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="all">全部</option>{Object.entries(TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="帳戶"><select className="input" value={acct} onChange={(e) => setAcct(e.target.value)}><option value="all">全部</option>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      </div>
      <p className="small mb">收入 <strong style={{ color: 'var(--ok)' }}>{fmtMoney(income)}</strong>・支出 <strong>{fmtMoney(spend)}</strong>・共 {list.length} 筆</p>
      {list.length === 0 && <Empty title="沒有符合的紀錄">按下方「＋」記一筆。</Empty>}
      {Object.entries(byDate).map(([d, items]) => (
        <div key={d} className="mb">
          <div className="row between tiny muted"><span>{fmtDate(d)}</span><span>支出 {fmtMoney(sum(items.filter((t) => t.type !== 'income'), (t) => t.amount))}</span></div>
          {items.map((t) => (
            <div key={t.id} className="list-item row between" style={{ padding: '8px 0' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div>{t.category || TX_TYPES[t.type]}{t.impulse && <span className="tag err" style={{ marginLeft: 6 }}>衝動</span>}{t.installment && <span className="tag" style={{ marginLeft: 6 }}>分期 {t.installment.index}/{t.installment.count}</span>}</div>
                <div className="tiny muted">{TX_TYPES[t.type]}{t.accountId ? `・${data.accounts.find((a) => a.id === t.accountId)?.name || ''}` : t.payMethod ? `・${t.payMethod}` : ''}{t.note ? `・${t.note}` : ''}</div>
              </div>
              <div className="row" style={{ gap: 2 }}>
                <strong style={{ color: t.type === 'income' ? 'var(--ok)' : 'var(--ink)' }}>{t.type === 'income' ? '+' : '-'}{fmtMoney(t.amount)}</strong>
                <button className="icon-btn" onClick={() => onEdit(t)}>編輯</button>
                <button className="icon-btn" onClick={() => setConfirm(t)}>刪除</button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {confirm && <Confirm strong onClose={() => setConfirm(null)} onConfirm={() => remove('transactions', confirm.id)} message={`刪除 ${confirm.date} ${confirm.category || ''} ${fmtMoney(confirm.amount)}？${confirm.installment ? '（只刪除這一期，其他期數不受影響）' : ''}`} />}
    </Card>
  );
}

// ---------------- 月度檢視（月曆） ----------------
export function CalendarView({ scope }) {
  const { data } = useStore();
  const [month, setMonth] = useState(toDateStr().slice(0, 7));
  const [sel, setSel] = useState(null);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const tx = data.transactions.filter((t) => txOwner(t) === scope && monthOf(t.date) === month);
  const byDay = useMemo(() => {
    const out = {};
    for (const t of tx) {
      const d = Number(t.date.slice(8));
      out[d] ||= { spend: 0, income: 0, list: [] };
      if (t.type === 'income') out[d].income += Number(t.amount); else out[d].spend += Number(t.amount);
      out[d].list.push(t);
    }
    return out;
  }, [tx]);
  const max = Math.max(1, ...Object.values(byDay).map((v) => v.spend));
  const shift = (n) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setSel(null); };
  return (
    <Card title={`月度檢視・${SCOPES[scope]}`} action={<><button className="btn ghost sm" onClick={() => shift(-1)}>‹</button><strong>{y} 年 {m} 月</strong><button className="btn ghost sm" onClick={() => shift(1)}>›</button></>}>
      <div className="cal">
        {['日', '一', '二', '三', '四', '五', '六'].map((w) => <div key={w} className="cal-head">{w}</div>)}
        {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const v = byDay[d];
          return (
            <button key={d} type="button" className={`cal-day ${sel === d ? 'sel' : ''}`} onClick={() => setSel(d)} style={v?.spend ? { background: `rgba(139,107,79,${0.08 + (v.spend / max) * 0.35})` } : undefined}>
              <span className="n">{d}</span>
              {v?.spend ? <span className="amt">{Math.round(v.spend).toLocaleString('zh-TW')}</span> : null}
              {v?.income ? <span className="inc">●</span> : null}
            </button>
          );
        })}
      </div>
      <p className="tiny muted mt">格子裡是當天支出，顏色越深花越多；綠點表示有收入。本月支出 {fmtMoney(sum(tx.filter((t) => t.type !== 'income'), (t) => t.amount))}。</p>
      {sel && (
        <div className="mt">
          <strong>{m}/{sel}</strong>
          {(byDay[sel]?.list || []).length === 0 ? <p className="small muted">這天沒有紀錄</p> : byDay[sel].list.map((t) => (
            <div key={t.id} className="list-item row between small"><span>{t.category || TX_TYPES[t.type]}{t.note ? `・${t.note}` : ''}</span><strong>{t.type === 'income' ? '+' : '-'}{fmtMoney(t.amount)}</strong></div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------- 願望清單 ----------------
const WISH_FIELDS = [
  { key: 'name', label: '想買什麼', type: 'text', required: true },
  { key: 'price', label: '價格（元）', type: 'money', required: true, positive: true },
  { key: 'reason', label: '為什麼想買', type: 'textarea', rows: 2 },
  { key: 'coolDays', label: '冷靜期（天）', type: 'number', min: 0, max: 90, default: 2, hint: '過了冷靜期還想要再決定' },
];

export function WishlistView() {
  const { data, save, remove } = useStore();
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [tab, setTab] = useState('thinking');
  const today = toDateStr();
  const list = data.wishlist.filter((w) => (tab === 'thinking' ? (w.status || 'thinking') === 'thinking' : (w.status || 'thinking') !== 'thinking'))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const avoided = sum(data.wishlist.filter((w) => w.status === 'delayed' || w.status === 'cancelled'), (w) => w.price);
  const decide = (w, status) => save('wishlist', { ...w, status, decidedAt: today }, { silent: true });
  return (
    <Card title="願望清單" action={<button className="btn sm" onClick={() => setForm(blankFrom(WISH_FIELDS))}>＋ 想買的東西</button>}>
      <p className="small muted mb">想買的東西先放這裡，過了冷靜期再決定。目前已延後或取消 <strong>{fmtMoney(avoided)}</strong> 的購買。</p>
      <div className="mb"><Chips value={tab} onChange={setTab} options={[['thinking', '考慮中'], ['done', '已決定']]} /></div>
      {list.length === 0 && <Empty title={tab === 'thinking' ? '目前沒有考慮中的東西' : '還沒有決定過的項目'} />}
      {list.map((w) => {
        const ready = !w.coolUntil || today >= w.coolUntil;
        return (
          <div key={w.id} className="list-item">
            <div className="row between"><strong>{w.name}</strong><strong>{fmtMoney(w.price)}</strong></div>
            {w.reason && <div className="small muted">{w.reason}</div>}
            {(w.status || 'thinking') === 'thinking' ? (
              <>
                <div className="tiny" style={{ color: ready ? 'var(--ok)' : 'var(--warn)' }}>{ready ? '冷靜期已過，可以決定了' : `冷靜期到 ${fmtShortDate(w.coolUntil)}`}</div>
                <div className="row mt" style={{ gap: 6 }}>
                  <button className="btn ghost sm" onClick={() => decide(w, 'delayed')}>延後</button>
                  <button className="btn ghost sm" onClick={() => decide(w, 'cancelled')}>不買了</button>
                  <button className="btn sm" disabled={!ready} onClick={() => decide(w, 'bought')}>決定買</button>
                  <button className="icon-btn" onClick={() => setConfirm(w)}>刪除</button>
                </div>
              </>
            ) : (
              <div className="row between tiny muted"><span>{WISH_STATUS[w.status]}・{fmtShortDate(w.decidedAt)}</span><span><button className="icon-btn" onClick={() => save('wishlist', { ...w, status: 'thinking', decidedAt: '' }, { silent: true })}>改回考慮中</button><button className="icon-btn" onClick={() => setConfirm(w)}>刪除</button></span></div>
            )}
          </div>
        );
      })}
      {form && <RecordForm title="想買的東西" fields={WISH_FIELDS} initial={form}
        onSave={(v) => { const d = new Date(); d.setDate(d.getDate() + (Number(v.coolDays) || 0)); return save('wishlist', { ...v, status: 'thinking', coolUntil: toDateStr(d) }); }}
        onClose={() => setForm(null)} />}
      {confirm && <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('wishlist', confirm.id)} message={`刪除「${confirm.name}」？`} />}
    </Card>
  );
}

// ---------------- 筆記 ----------------
export function NotesView() {
  const { data, save, remove, toast } = useStore();
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(null);
  const list = [...data.notes].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return (
    <Card title="財務筆記">
      <textarea className="input" rows={3} placeholder="例如：保險 3 月要繳年費 14,400；下個月要換手機" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn sm mt" onClick={async () => { if (!text.trim()) return toast('請先寫點內容', 'error'); if (await save('notes', { date: toDateStr(), text: text.trim() })) setText(''); }}>儲存筆記</button>
      <div className="mt">
        {list.length === 0 && <Empty title="還沒有筆記" />}
        {list.map((n) => (
          <div key={n.id} className="list-item">
            <div className="row between tiny muted"><span>{fmtDate(n.date)}</span><button className="icon-btn" onClick={() => setConfirm(n)}>刪除</button></div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{n.text}</p>
          </div>
        ))}
      </div>
      {confirm && <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('notes', confirm.id)} message="刪除這則筆記？" />}
    </Card>
  );
}

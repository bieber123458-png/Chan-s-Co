// 快速記帳：任何頁面按「＋」就能記一筆，會依上次紀錄自動帶入常用選項
import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Modal, Field, Chips } from './ui.jsx';
import { BUDGET_GROUPS, budgetFor, monthOf } from '../lib/finance.js';
import { toDateStr } from '../lib/plan.js';

const DEFAULT_CATS = {
  expense: ['飲食-外食', '飲食-食材', '交通', '購物', '娛樂', '房租', '水電瓦斯', '保險'],
  business: ['婕樂纖進貨', '廣告費', '包材運費', '器材', '課程學習'],
  income: ['零售收入', '團隊獎金', '美業服務/課程', '其他收入'],
};
const PAY = ['現金', '轉帳／活存', '信用卡', '行動支付'];
const MOODS = ['', '開心', '普通', '壓力大', '無聊', '難過', '累'];

export default function QuickAdd({ onClose }) {
  const { data, save } = useStore();
  // 以最近一筆支出當預設（類別、固定／變動、需要／想要、付款方式）
  const last = useMemo(() => [...data.transactions].filter((t) => t.type !== 'income')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0], [data.transactions]);
  const [dir, setDir] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(last?.category || '');
  const [group, setGroup] = useState(last?.group || 'variable');
  const [owner, setOwner] = useState(last?.type === 'business' ? 'business' : 'personal');
  const [want, setWant] = useState(last?.type === 'nonessential' ? 'want' : 'need');
  const [pay, setPay] = useState(last?.payMethod || '現金');
  const [budgetItem, setBudgetItem] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toDateStr());
  const [advanced, setAdvanced] = useState(false);
  const [impulse, setImpulse] = useState(false);
  const [temporary, setTemporary] = useState(false);
  const [mood, setMood] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const prefilled = !!last && dir === 'expense';

  const catKey = dir === 'income' ? 'income' : owner === 'business' ? 'business' : 'expense';
  const cats = useMemo(() => {
    const used = [...data.transactions]
      .filter((t) => (dir === 'income' ? t.type === 'income' : owner === 'business' ? t.type === 'business' : ['essential', 'nonessential'].includes(t.type)) && t.category)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((t) => t.category);
    return [...new Set([...used, ...DEFAULT_CATS[catKey]])].slice(0, 10);
  }, [data.transactions, dir, owner, catKey]);
  const items = dir === 'income' ? [] : (budgetFor(data, monthOf(date))?.items || []);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { setErr('請輸入大於 0 的金額'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('請選擇日期'); return; }
    setBusy(true);
    const item = items.find((i) => i.id === budgetItem);
    const type = dir === 'income' ? 'income' : owner === 'business' ? 'business' : want === 'want' ? 'nonessential' : 'essential';
    const rec = {
      date, type, amount: n, category: category.trim() || item?.name || '', note: note.trim(),
      ...(dir === 'expense' ? {
        group: owner === 'business' ? 'business' : group, payMethod: pay, budgetItem: item ? item.id : '',
        impulse, temporary, mood,
      } : {}),
    };
    const ok = await save('transactions', rec, { silent: true });
    setBusy(false);
    if (ok) onClose(true);
  };

  return (
    <Modal title="快速記帳" onClose={() => onClose(false)}
      actions={<><button className="btn ghost" onClick={() => onClose(false)}>取消</button><button className="btn" style={{ minWidth: 120 }} disabled={busy} onClick={submit}>{busy ? <span className="spinner" /> : null}記帳！</button></>}>
      <div className="seg mb">
        {[['expense', '支出'], ['income', '收入']].map(([k, l]) => <button key={k} type="button" className={dir === k ? 'on' : ''} onClick={() => { setDir(k); setCategory(k === 'income' ? '' : last?.category || ''); }}>{l}</button>)}
      </div>
      <div className="amount-box">
        <span className="tiny muted">金額</span>
        <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
          <span className="cur">$</span>
          <input id="qa-amount" className="amount-input" type="number" inputMode="numeric" min="0" autoFocus placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="金額" />
        </div>
        {err && <div className="err-text">{err}</div>}
      </div>

      {dir === 'expense' && (
        <Field label="帳目歸屬"><div className="seg">{[['personal', '個人'], ['business', '事業']].map(([k, l]) => <button key={k} type="button" className={owner === k ? 'on' : ''} onClick={() => setOwner(k)}>{l}</button>)}</div></Field>
      )}
      <Field label="類別">
        <div className="chips scroll-chips">{cats.map((c) => <button key={c} type="button" className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <input id="qa-cat" className="input mt" placeholder="或自己輸入" value={category} onChange={(e) => setCategory(e.target.value)} />
        {prefilled && <span className="hint" style={{ color: 'var(--tea)' }}>＊已依上次紀錄帶入，可自行修改</span>}
      </Field>

      {dir === 'expense' && owner === 'personal' && (
        <div className="form-grid">
          <Field label="支出類型"><div className="seg">{[['variable', '變動'], ['fixed', '固定']].map(([k, l]) => <button key={k} type="button" className={group === k ? 'on' : ''} onClick={() => setGroup(k)}>{l}</button>)}</div></Field>
          <Field label="需要／想要"><div className="seg">{[['need', '需要'], ['want', '想要']].map(([k, l]) => <button key={k} type="button" className={want === k ? 'on' : ''} onClick={() => setWant(k)}>{l}</button>)}</div></Field>
        </div>
      )}
      {dir === 'expense' && (
        <Field label="付款方式" hint={pay === '信用卡' ? '刷卡的支出記在刷卡當天；之後繳卡費時不要再記一次支出，以免重複計算。' : ''}>
          <div className="chips scroll-chips">{PAY.map((p) => <button key={p} type="button" className={`chip ${pay === p ? 'active' : ''}`} onClick={() => setPay(p)}>{p}</button>)}</div>
        </Field>
      )}
      {items.length > 0 && (
        <Field label="算在哪個預算項目（選填）">
          <select id="qa-budget" className="input" value={budgetItem} onChange={(e) => setBudgetItem(e.target.value)}>
            <option value="">不指定（依支出類型自動歸類）</option>
            {items.map((i) => <option key={i.id} value={i.id}>{BUDGET_GROUPS[i.group]?.name}｜{i.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="備註（選填）"><input id="qa-note" className="input" placeholder="輸入備註…" value={note} onChange={(e) => setNote(e.target.value)} /></Field>

      {dir === 'expense' && (
        advanced ? (
          <div className="card soft" style={{ padding: 14 }}>
            <div className="row" style={{ gap: 16 }}>
              <label className="check"><input type="checkbox" checked={impulse} onChange={(e) => setImpulse(e.target.checked)} />衝動消費</label>
              <label className="check"><input type="checkbox" checked={temporary} onChange={(e) => setTemporary(e.target.checked)} />臨時性支出</label>
            </div>
            <Field label="當下情緒">
              <select id="qa-mood" className="input" value={mood} onChange={(e) => setMood(e.target.value)}>{MOODS.map((m) => <option key={m} value={m}>{m || '不記錄'}</option>)}</select>
            </Field>
          </div>
        ) : <button type="button" className="btn ghost block mb" onClick={() => setAdvanced(true)}>＋ 進階記錄（情緒／衝動消費／臨時性支出）</button>
      )}
      <Field label="日期"><input id="qa-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} /></Field>
    </Modal>
  );
}

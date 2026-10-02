// 快速記帳：任何頁面按「＋」就能記一筆收入或支出
import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Modal, Field, Chips } from './ui.jsx';
import { TX_TYPES, BUDGET_GROUPS, budgetFor, monthOf } from '../lib/finance.js';
import { toDateStr } from '../lib/plan.js';

const DEFAULT_CATS = {
  essential: ['餐費', '交通', '房租', '水電瓦斯', '電話網路'],
  nonessential: ['購物', '外食聚餐', '娛樂', '訂閱服務'],
  business: ['婕樂纖進貨', '廣告費', '包材運費', '器材'],
  income: ['零售收入', '團隊獎金', '美業服務/課程', '其他收入'],
};

export default function QuickAdd({ onClose }) {
  const { data, save } = useStore();
  const [type, setType] = useState('essential');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(toDateStr());
  const [note, setNote] = useState('');
  const [budgetItem, setBudgetItem] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // 常用分類：最近用過的排前面，再補預設
  const cats = useMemo(() => {
    const used = [...data.transactions].filter((t) => t.type === type && t.category)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((t) => t.category);
    return [...new Set([...used, ...DEFAULT_CATS[type]])].slice(0, 8);
  }, [data.transactions, type]);
  const budget = budgetFor(data, monthOf(date));
  const items = type === 'income' ? [] : (budget?.items || []);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { setErr('請輸入大於 0 的金額'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('請選擇日期'); return; }
    setBusy(true);
    const item = items.find((i) => i.id === budgetItem);
    const ok = await save('transactions', { date, type, amount: n, category: category.trim() || item?.name || '', note: note.trim(), budgetItem: item ? item.id : '' }, { silent: true });
    setBusy(false);
    if (ok) onClose(true);
  };

  return (
    <Modal title="快速記帳" onClose={() => onClose(false)}
      actions={<><button className="btn ghost" onClick={() => onClose(false)}>取消</button><button className="btn" disabled={busy} onClick={submit}>{busy ? <span className="spinner" /> : null}記一筆</button></>}>
      <div className="mb"><Chips value={type} onChange={(t) => { setType(t); setCategory(''); setBudgetItem(''); }} options={Object.entries(TX_TYPES).map(([k, v]) => [k, v.replace('支出', '')])} /></div>
      <Field label="金額（元）" error={err}>
        <input id="qa-amount" className="input" style={{ fontSize: 28, fontWeight: 700, minHeight: 56 }} type="number" inputMode="numeric" min="0" autoFocus placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="分類">
        <div className="chips" style={{ marginBottom: 6 }}>{cats.map((c) => <button key={c} type="button" className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <input id="qa-cat" className="input" placeholder="或自己輸入" value={category} onChange={(e) => setCategory(e.target.value)} />
      </Field>
      {items.length > 0 && (
        <Field label="算在哪個預算項目（選填）">
          <select id="qa-budget" className="input" value={budgetItem} onChange={(e) => setBudgetItem(e.target.value)}>
            <option value="">不指定（依類型自動歸類）</option>
            {items.map((i) => <option key={i.id} value={i.id}>{BUDGET_GROUPS[i.group]?.name}｜{i.name}</option>)}
          </select>
        </Field>
      )}
      <div className="form-grid">
        <Field label="日期"><input id="qa-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="備註"><input id="qa-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <p className="tiny muted">卡費、貸款的還款請到「存錢與負債 → 負債」記錄，系統會自動拆成本金與利息，避免重複計算。</p>
    </Modal>
  );
}

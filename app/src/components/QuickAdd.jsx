// 快速記帳：任何頁面按「＋」就能記一筆，會依上次紀錄自動帶入常用選項
// 支出類型：變動／固定／儲蓄／預存／時效。儲蓄與預存是把錢存進存錢目標，不算支出。
import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Modal, Field } from './ui.jsx';
import { ACCOUNT_KINDS, BUDGET_GROUPS, SCOPES, budgetFor, monthOf, scopedBudgetId, splitInstallments, round } from '../lib/finance.js';
import { toDateStr } from '../lib/plan.js';
import { newId } from '../lib/api.js';
import { fmtMoney } from '../lib/format.js';

const DEFAULT_CATS = {
  personal: ['飲食-外食', '飲食-食材', '交通', '購物', '娛樂', '房租', '水電瓦斯', '保險'],
  family: ['家用', '孝親費', '房租', '水電瓦斯', '日用品', '小孩'],
  business: ['婕樂纖進貨', '廣告費', '包材運費', '器材', '課程學習'],
  income: ['零售收入', '團隊獎金', '服務／課程收入', '其他收入'],
};
const PAY = ['現金', '轉帳／活存', '信用卡', '行動支付'];
const MOODS = ['', '開心', '普通', '壓力大', '無聊', '難過', '累'];
const KINDS = [['variable', '變動'], ['fixed', '固定'], ['saving', '儲蓄'], ['sinking', '預存'], ['timed', '時效']];
const KIND_HINT = {
  variable: '每個月金額會變的：餐費、交通、購物。',
  fixed: '每個月差不多的：房租、電話費、保險月繳。',
  saving: '把錢存進存錢目標，不算支出。',
  sinking: '為之後的大筆支出先存，例如保險年繳、年費、旅遊。不算支出。',
  timed: '一次付清、但用很多個月的：年費、課程、訂閱年繳。會顯示每月平均。',
};
const INSTALLMENTS = [1, 3, 6, 12, 24];

export default function QuickAdd({ onClose }) {
  const { data, save, saveMany, toast } = useStore();
  // 以最近一筆支出當預設（類別、類型、需要／想要、帳戶）
  const last = useMemo(() => [...data.transactions].filter((t) => t.type !== 'income')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0], [data.transactions]);
  const accounts = data.accounts || [];
  const [dir, setDir] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(last?.category || '');
  const [kind, setKind] = useState(last?.expenseKind === 'timed' ? 'timed' : last?.group === 'fixed' ? 'fixed' : 'variable');
  const [owner, setOwner] = useState(last?.owner || (last?.type === 'business' ? 'business' : 'personal'));
  const [want, setWant] = useState(last?.type === 'nonessential' ? 'want' : 'need');
  const [pay, setPay] = useState(last?.payMethod || '現金');
  const [accountId, setAccountId] = useState(accounts.some((a) => a.id === last?.accountId) ? last.accountId : accounts[0]?.id || '');
  const [installments, setInstallments] = useState(1);
  const [validMonths, setValidMonths] = useState(12);
  const [goalId, setGoalId] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [budgetItem, setBudgetItem] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toDateStr());
  const [advanced, setAdvanced] = useState(false);
  const [impulse, setImpulse] = useState(false);
  const [temporary, setTemporary] = useState(false);
  const [mood, setMood] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isDeposit = dir === 'expense' && (kind === 'saving' || kind === 'sinking');
  const prefilled = !!last && dir === 'expense' && !isDeposit;
  const account = accounts.find((a) => a.id === accountId);
  const isCredit = accounts.length ? account?.kind === 'credit' : pay === '信用卡';
  const goals = (data.savingsGoals || []).filter((g) => (kind === 'sinking' ? g.isSinking : !g.isSinking));

  const catKey = dir === 'income' ? 'income' : owner;
  const cats = useMemo(() => {
    const used = [...data.transactions]
      .filter((t) => (dir === 'income' ? t.type === 'income' : t.type !== 'income' && (t.owner || (t.type === 'business' ? 'business' : 'personal')) === owner) && t.category)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((t) => t.category);
    return [...new Set([...used, ...DEFAULT_CATS[catKey]])].slice(0, 10);
  }, [data.transactions, dir, owner, catKey]);
  const budget = dir === 'income' ? null : (data.budgets || []).find((b) => b.id === scopedBudgetId(monthOf(date), owner)) || (owner === 'personal' ? budgetFor(data, monthOf(date)) : null);
  const items = budget?.items || [];

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { setErr('請輸入大於 0 的金額'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('請選擇日期'); return; }
    setErr('');

    // 儲蓄／預存：存進存錢目標
    if (isDeposit) {
      let gid = goalId || goals[0]?.id;
      if (!gid) {
        if (!newGoal.trim()) { setErr(`請輸入${kind === 'sinking' ? '預存' : '儲蓄'}目標名稱`); return; }
        setBusy(true);
        const g = await save('savingsGoals', { name: newGoal.trim(), purpose: '', target: n, targetDate: '', monthlyAmount: n, isEmergency: false, isSinking: kind === 'sinking' }, { silent: true });
        if (!g) { setBusy(false); return; }
        gid = g.id;
      }
      setBusy(true);
      const ok = await save('deposits', { date, goalId: gid, kind: 'deposit', amount: n, account: account?.name || pay, note: note.trim() }, { silent: true });
      setBusy(false);
      if (ok) { toast(`已存入 ${fmtMoney(n)}`, 'success'); onClose(true); }
      return;
    }

    setBusy(true);
    const item = items.find((i) => i.id === budgetItem);
    const type = dir === 'income' ? 'income' : owner === 'business' ? 'business' : want === 'want' ? 'nonessential' : 'essential';
    const rec = {
      date, type, owner, amount: n, category: category.trim() || item?.name || '', note: note.trim(),
      accountId: accounts.length ? accountId : '', payMethod: accounts.length ? (ACCOUNT_KINDS[account?.kind] || '') : pay,
      ...(dir === 'expense' ? {
        group: owner === 'business' ? 'business' : kind === 'timed' ? 'fixed' : kind,
        expenseKind: kind, ...(kind === 'timed' ? { validMonths: Number(validMonths) || 1 } : {}),
        budgetItem: item ? item.id : '', impulse, temporary, mood,
      } : {}),
    };
    let ok;
    if (dir === 'expense' && isCredit && installments > 1) {
      ok = await saveMany('transactions', splitInstallments({ ...rec, id: newId() }, installments));
      if (ok) toast(`已拆成 ${installments} 期，每期約 ${fmtMoney(round(n / installments))}`, 'success');
    } else ok = await save('transactions', rec, { silent: true });
    setBusy(false);
    if (ok) onClose(true);
  };

  const segment = (value, set, opts) => <div className="seg">{opts.map(([k, l]) => <button key={k} type="button" className={value === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}</div>;

  return (
    <Modal title="快速記帳" onClose={() => onClose(false)}
      actions={<><button className="btn ghost" onClick={() => onClose(false)}>取消</button><button className="btn" style={{ minWidth: 120 }} disabled={busy} onClick={submit}>{busy ? <span className="spinner" /> : null}{isDeposit ? '存入！' : '記帳！'}</button></>}>
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
        <Field label="支出類型" hint={KIND_HINT[kind]}>
          <div className="seg kinds">{KINDS.map(([k, l]) => <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
        </Field>
      )}

      {isDeposit ? (
        <Field label={kind === 'sinking' ? '存進哪個預存目標' : '存進哪個儲蓄目標'}>
          {goals.length ? (
            <select id="qa-goal" className="input" value={goalId || goals[0].id} onChange={(e) => setGoalId(e.target.value)}>{goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          ) : (
            <input id="qa-goal-name" className="input" placeholder={kind === 'sinking' ? '例如：保險年繳、旅遊基金' : '例如：緊急預備金'} value={newGoal} onChange={(e) => setNewGoal(e.target.value)} />
          )}
          {!goals.length && <span className="hint">還沒有{kind === 'sinking' ? '預存' : '儲蓄'}目標，輸入名稱會自動建立。</span>}
        </Field>
      ) : (
        <>
          <Field label="帳目歸屬">{segment(owner, setOwner, Object.entries(SCOPES))}</Field>
          <Field label="類別">
            <div className="chips scroll-chips">{cats.map((c) => <button key={c} type="button" className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div>
            <input id="qa-cat" className="input mt" placeholder="或自己輸入" value={category} onChange={(e) => setCategory(e.target.value)} />
            {prefilled && <span className="hint" style={{ color: 'var(--tea)' }}>＊已依上次紀錄帶入，可自行修改</span>}
          </Field>
          {dir === 'expense' && owner !== 'business' && <Field label="需要／想要">{segment(want, setWant, [['need', '需要'], ['want', '想要']])}</Field>}
          {dir === 'expense' && kind === 'timed' && (
            <Field label="有效幾個月" hint={Number(amount) > 0 ? `平均每月 ${fmtMoney(round(Number(amount) / (Number(validMonths) || 1)))}` : ''}>
              <input id="qa-valid" className="input" type="number" min="1" max="60" value={validMonths} onChange={(e) => setValidMonths(e.target.value)} style={{ maxWidth: 140 }} />
            </Field>
          )}
        </>
      )}

      <Field label={dir === 'income' ? '入帳帳戶' : isDeposit ? '從哪個帳戶存' : '付款方式'}
        hint={!accounts.length ? '到「更多 → 帳戶管理」新增現金、活存、信用卡，就能自動算每個帳戶的餘額。' : isCredit && dir === 'expense' && !isDeposit ? '刷卡記在刷卡當天；之後繳卡費到「信用卡」按「繳卡費」，不會重複算支出。' : ''}>
        {accounts.length ? (
          <div className="chips scroll-chips">{accounts.map((a) => <button key={a.id} type="button" className={`chip ${accountId === a.id ? 'active' : ''}`} onClick={() => setAccountId(a.id)}>{a.name}</button>)}</div>
        ) : (
          <div className="chips scroll-chips">{PAY.map((p) => <button key={p} type="button" className={`chip ${pay === p ? 'active' : ''}`} onClick={() => setPay(p)}>{p}</button>)}</div>
        )}
      </Field>
      {dir === 'expense' && !isDeposit && isCredit && (
        <Field label="信用卡分期" hint={installments > 1 && Number(amount) > 0 ? `會從刷卡月份開始，每月記一筆約 ${fmtMoney(round(Number(amount) / installments))}` : ''}>
          <select id="qa-inst" className="input" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} style={{ maxWidth: 200 }}>
            {INSTALLMENTS.map((k) => <option key={k} value={k}>{k === 1 ? '不分期（一次付清）' : `分 ${k} 期`}</option>)}
          </select>
        </Field>
      )}
      {!isDeposit && items.length > 0 && (
        <Field label="算在哪個預算項目（選填）">
          <select id="qa-budget" className="input" value={budgetItem} onChange={(e) => setBudgetItem(e.target.value)}>
            <option value="">不指定（依支出類型自動歸類）</option>
            {items.map((i) => <option key={i.id} value={i.id}>{BUDGET_GROUPS[i.group]?.name}｜{i.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="備註（選填）"><input id="qa-note" className="input" placeholder="輸入備註…" value={note} onChange={(e) => setNote(e.target.value)} /></Field>

      {dir === 'expense' && !isDeposit && (
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

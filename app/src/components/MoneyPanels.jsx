// 存錢與負債：可用餘額、提醒中心、設定清單、本月概況、每月預算（四步驟）
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Card, Field, Progress } from './ui.jsx';
import { newId } from '../lib/api.js';
import { fmtMoney } from '../lib/format.js';
import { toDateStr } from '../lib/plan.js';
import {
  BUDGET_GROUPS, availableBalance, budgetActuals, budgetFor, budgetId, budgetSuggestion, budgetTotals,
  financeReminders, monthlySummary, prevMonth, round, sum, goalProgress,
} from '../lib/finance.js';

const monthLabel = (m) => `${Number(m.slice(5, 7))} 月`;

// ---------- 本月可用餘額 ----------
export function BalanceHero({ month, go }) {
  const { data } = useStore();
  const a = availableBalance(data, month);
  return (
    <>
      <div className="hero-money">
        <div className="stat-label">{monthLabel(month)}可用餘額</div>
        <div className={`hero-amount ${a.afterDue < 0 ? 'neg' : ''}`}>{fmtMoney(a.afterDue)}</div>
        <div className="tiny muted">收入 {fmtMoney(a.income)} − 支出 {fmtMoney(a.expenses)} − 已還款 {fmtMoney(a.debtPaid)} − 已存入 {fmtMoney(a.saved)}{a.unpaidDue ? ` − 待繳 ${fmtMoney(a.unpaidDue)}` : ''}</div>
        {a.spendRatio !== null && (
          <div className="mt">
            <div className="row between small"><span>支出佔收入（含待繳）</span><span>{a.spendRatio}%</span></div>
            <Progress value={a.spendRatio} />
          </div>
        )}
        {!a.hasData && <p className="small muted mt">{monthLabel(month)}還沒有任何紀錄，按下方「＋」記第一筆。</p>}
      </div>
      {a.unpaidDue > 0 && (
        <button type="button" className="due-banner" onClick={() => go('debts')}>
          <div><strong>本月待繳 {fmtMoney(a.unpaidDue)} 已納入可用餘額計算</strong><div className="tiny">卡費、貸款的最低應繳；繳完記得到「負債」記錄</div></div>
          <span>查看 ›</span>
        </button>
      )}
      {a.afterDue < 0 && <div className="notice err">可用餘額是負數：這個月的支出、還款、存入和待繳加起來超過收入。先確保生活費和最低應繳，存錢或額外還款可以暫緩。</div>}
    </>
  );
}

// ---------- 提醒中心 ----------
export function ReminderCenter({ go }) {
  const { data } = useStore();
  const list = financeReminders(data, toDateStr());
  return (
    <Card title={<div className="row"><h2>提醒中心</h2>{list.some((x) => x.level !== 'info') && <span className="tag err">需要注意</span>}</div>}>
      {list.length === 0 ? <p className="small muted">目前沒有需要注意的事。</p> : list.map((r, i) => (
        <button key={i} type="button" className={`reminder ${r.level}`} onClick={() => go(r.tab)}>
          <div><strong>{r.title}</strong><div className="tiny">{r.detail}</div></div><span>›</span>
        </button>
      ))}
    </Card>
  );
}

// ---------- 開始的設定清單 ----------
export function SetupChecklist({ go }) {
  const { data } = useStore();
  const month = toDateStr().slice(0, 7);
  const steps = [
    ['記一筆收入', data.transactions.some((t) => t.type === 'income'), 'tx'],
    [`編列${monthLabel(month)}預算`, !!budgetFor(data, month)?.done, 'budget'],
    ['設定負債（選填）', data.debts.length > 0, 'debts'],
    ['設定存錢目標（選填）', data.savingsGoals.length > 0, 'savings'],
  ];
  if (steps.every((s) => s[1])) return null;
  return (
    <Card title="🎯 完成設定，開始管理這個月">
      {steps.map(([label, done, tab]) => (
        <button key={label} type="button" className={`check-row ${done ? 'done' : ''}`} onClick={() => !done && go(tab)}>
          <span className="dot">{done ? '✓' : ''}</span><span className="label">{label}</span>{!done && <span className="go">前往 ›</span>}
        </button>
      ))}
    </Card>
  );
}

// ---------- 本月概況（預算 vs 實際） ----------
export function MonthSummary({ month }) {
  const { data } = useStore();
  const [open, setOpen] = useState(true);
  const m = monthlySummary(data, month);
  const b = budgetFor(data, month);
  const t = budgetTotals(b);
  const act = budgetActuals(data, month, b);
  const savingTarget = b?.saving || sum(data.savingsGoals, (g) => g.monthlyAmount) || 0;
  const tile = (label, value, sub, cls = '') => (
    <div className="stat"><div className="stat-label">{label}</div><div className={`stat-value ${cls}`}>{value}</div><div className="stat-sub">{sub}</div></div>
  );
  const vs = (actual, budget) => (budget ? <>預算 {fmtMoney(budget)}{actual > budget ? <span style={{ color: 'var(--err)' }}>・超出 {fmtMoney(actual - budget)}</span> : ''}</> : '尚未編預算');
  return (
    <Card title="本月概況" action={<button className="btn ghost sm" onClick={() => setOpen(!open)}>{open ? '收合 ▲' : '展開 ▼'}</button>}>
      {open && (
        <div className="grid grid-3">
          {tile('收入', fmtMoney(m.income), b?.income ? `預計 ${fmtMoney(b.income)}` : '已入帳', 'pos')}
          {tile('固定支出', fmtMoney(act.fixed), vs(act.fixed, t.fixed), act.fixed > t.fixed && t.fixed ? 'neg' : '')}
          {tile('變動支出', fmtMoney(act.variable), vs(act.variable, t.variable), act.variable > t.variable && t.variable ? 'neg' : '')}
          {tile('事業成本', fmtMoney(act.business), vs(act.business, t.business))}
          {tile('儲蓄', fmtMoney(m.saved), savingTarget ? `目標 ${fmtMoney(savingTarget)}` : '尚未設定目標', 'pos')}
          {tile('還款', fmtMoney(m.debtPaid), `最低應繳合計 ${fmtMoney(m.minDue)}`)}
        </div>
      )}
    </Card>
  );
}

// ---------- 每月預算（四步驟） ----------
export function BudgetPlanner() {
  const { data, save, toast } = useStore();
  const [month, setMonth] = useState(toDateStr().slice(0, 7));
  const existing = budgetFor(data, month);
  const prev = budgetFor(data, prevMonth(month));
  const prevSummary = monthlySummary(data, prevMonth(month));
  const prevAct = budgetActuals(data, prevMonth(month), prev);
  return <BudgetEditor key={month} month={month} setMonth={setMonth} existing={existing} prev={prev} prevSummary={prevSummary} prevAct={prevAct} save={save} toast={toast} data={data} />;
}

function BudgetEditor({ month, setMonth, existing, prev, prevSummary, prevAct, save, toast, data }) {
  const m = monthlySummary(data, month);
  const [b, setB] = useState(() => existing || {
    id: budgetId(month), month, income: prevSummary.income || m.income || '', saving: '', items: [], done: false,
  });
  const [step, setStep] = useState(existing?.done ? 4 : existing?.items?.length ? 3 : 1);
  const [form, setForm] = useState({ name: '', group: 'fixed', amount: '' });
  const [err, setErr] = useState('');
  const t = budgetTotals(b);
  const income = Number(b.income) || 0;
  const minDue = m.minDue;
  const variableEst = t.variable || prevAct.variable;
  const sug = budgetSuggestion({ income, fixed: t.fixed || prevAct.fixed, minDue, variable: variableEst });
  const saving = Number(b.saving) || 0;
  const left = round(income - saving - minDue - t.all);
  const emergency = data.savingsGoals.find((g) => g.isEmergency);
  const emergencyP = emergency ? goalProgress(emergency, data.deposits) : null;

  const persist = async (patch, silent = true) => {
    const next = { ...b, ...patch };
    setB(next);
    return save('budgets', next, { silent });
  };
  const copyPrev = () => {
    if (!prev?.items?.length) { toast('上個月沒有預算可以沿用', 'error'); return; }
    const items = prev.items.map((i) => ({ ...i, id: newId() }));
    persist({ items, saving: b.saving || prev.saving || '' });
    toast(`已沿用上個月 ${items.length} 個項目`, 'success');
  };
  const addItem = () => {
    const n = Number(form.amount);
    if (!form.name.trim()) { setErr('請輸入項目名稱'); return; }
    if (!Number.isFinite(n) || n < 0) { setErr('金額請輸入 0 以上的數字'); return; }
    setErr('');
    persist({ items: [...b.items, { id: newId(), name: form.name.trim(), group: form.group, amount: n }] });
    setForm({ name: '', group: form.group, amount: '' });
  };
  const setItem = (id, patch) => persist({ items: b.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const removeItem = (id) => persist({ items: b.items.filter((i) => i.id !== id) });
  const lastActual = (name) => {
    const it = prev?.items?.find((i) => i.name === name);
    return it ? prevAct.byItem[it.id] || 0 : null;
  };
  const finish = async () => {
    if (left < 0) { toast('分配超過收入，請調整金額', 'error'); return; }
    if (await persist({ done: true }, false)) setStep(4);
  };

  const steps = [
    ['收入', income ? fmtMoney(income) : '待填', income > 0],
    ['看建議', `可存 ${fmtMoney(sug.suggested)}`, step > 2],
    ['分配', fmtMoney(t.all + saving + minDue), b.items.length > 0],
    ['完成', b.done ? '已完成' : `待分配 ${fmtMoney(left)}`, b.done],
  ];

  return (
    <>
      <div className="row mb">
        <Field label="預算月份"><input className="input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field>
      </div>
      <div className="stepper">
        {steps.map(([name, sub, done], i) => (
          <button key={name} type="button" className={`step ${done ? 'done' : ''} ${step === i + 1 ? 'current' : ''}`} onClick={() => setStep(i + 1)}>
            <span className="num">{done ? '✓' : i + 1}</span><span className="name">{name}</span><span className="tiny muted">{sub}</span>
          </button>
        ))}
      </div>

      <Card title={<h3>步驟 1｜盤點收入</h3>} action={<span className="small"><strong>{fmtMoney(income)}</strong></span>}>
        {step === 1 && (
          <>
            <Field label={`${monthLabel(month)}預計收入（元）`} hint={prevSummary.income ? `上個月實際收入 ${fmtMoney(prevSummary.income)}` : '收入不固定的話，先用保守的金額估'}>
              <input id="budget-income" className="input" type="number" min="0" inputMode="numeric" value={b.income} onChange={(e) => setB({ ...b, income: e.target.value })} />
            </Field>
            <button className="btn sm" onClick={async () => { if (!(Number(b.income) > 0)) { toast('請輸入收入', 'error'); return; } await persist({ income: Number(b.income) }); setStep(2); }}>下一步</button>
          </>
        )}
      </Card>

      <Card title={<h3>步驟 2｜看分配建議</h3>} action={<span className="small">可存 <strong>{fmtMoney(sug.suggested)}</strong></span>}>
        {step === 2 && (
          <>
            <div className="small">
              <div>收入 {fmtMoney(income)}</div>
              <div>− 固定支出 {fmtMoney(t.fixed || prevAct.fixed)}{!t.fixed && prevAct.fixed ? '（上個月實際）' : ''}</div>
              <div>− 卡費／貸款最低應繳 {fmtMoney(minDue)}</div>
              <div>− 變動支出估計 {fmtMoney(variableEst)}{!t.variable && prevAct.variable ? '（上個月實際）' : ''}</div>
              {sug.estimated && <div><strong>＝ 最多可存 {fmtMoney(sug.maxSave)}</strong></div>}
            </div>
            <div className="notice info small mt">
              {sug.estimated
                ? <>建議先存 <strong>{fmtMoney(sug.suggested)}</strong>（最多可存的六成），保留一些彈性給突發支出。</>
                : <>還沒有支出紀錄可以估算，先用保守的方式：扣掉最低應繳後存兩成，建議 <strong>{fmtMoney(sug.suggested)}</strong>。分配完支出後，回來看看要不要調整。</>}
              {emergency ? ` 緊急預備金「${emergency.name}」目前 ${Math.round(emergencyP.pct)}%。` : ' 還沒有緊急預備金目標，建議先建立一個。'}
              {!prevSummary.hasData && ' 上個月沒有紀錄，以上估計僅供參考。'}
            </div>
            <Field label="這個月打算存（元）"><input id="budget-saving" className="input" type="number" min="0" inputMode="numeric" value={b.saving} placeholder={String(sug.suggested)} onChange={(e) => setB({ ...b, saving: e.target.value })} /></Field>
            <button className="btn sm" onClick={async () => { await persist({ saving: b.saving === '' ? sug.suggested : Number(b.saving) }); setStep(3); }}>下一步</button>
          </>
        )}
      </Card>

      <Card title={<h3>步驟 3｜你想怎麼分配</h3>} action={<span className="small"><strong>{fmtMoney(t.all)}</strong></span>}>
        {step === 3 && (
          <>
            <div className="row between mb">
              <button className="btn sm" style={{ background: 'var(--ink)', borderColor: 'var(--ink)' }} onClick={copyPrev}>↻ 沿用上個月</button>
              <span className="tiny muted">卡費／貸款最低應繳 {fmtMoney(minDue)} 已自動算入</span>
            </div>
            {Object.entries(BUDGET_GROUPS).map(([g, info]) => {
              const list = b.items.filter((i) => i.group === g);
              return (
                <div key={g} className="budget-group">
                  <div className="row between"><div><strong className="group-name">{info.name}</strong> <span className="tiny muted">（{info.hint}）</span></div><strong className="group-name">{fmtMoney(t[g])}</strong></div>
                  {list.length === 0 && <p className="tiny muted">還沒有項目</p>}
                  {list.map((i) => {
                    const last = lastActual(i.name);
                    return (
                      <div key={i.id} className="budget-item">
                        <span className="tag">{info.name}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>{i.name}{last !== null && <div className="tiny" style={{ color: 'var(--tea)' }}>上月實際 {fmtMoney(last)}</div>}</span>
                        <input className="input" style={{ width: 110, minHeight: 36 }} type="number" min="0" inputMode="numeric" defaultValue={i.amount}
                          onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0 && n !== i.amount) setItem(i.id, { amount: n }); }} aria-label={`${i.name} 金額`} />
                        <button className="icon-btn" onClick={() => removeItem(i.id)} aria-label={`刪除 ${i.name}`}>✕</button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="form-grid mt">
              <Field label="新增項目"><input id="budget-item-name" className="input" placeholder="例如：房租、餐費、婕樂纖進貨" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="組別"><select id="budget-item-group" className="input" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>{Object.entries(BUDGET_GROUPS).map(([k, v]) => <option key={k} value={k}>{v.name}（{v.hint}）</option>)}</select></Field>
              <Field label="金額（元）" error={err}><input id="budget-item-amount" className="input" type="number" min="0" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <div className="field" style={{ justifyContent: 'flex-end' }}><button className="btn ghost" onClick={addItem}>＋ 加入</button></div>
            </div>
          </>
        )}
      </Card>

      <Card title={<h3>步驟 4｜完成</h3>}>
        {b.done ? (
          <div className="small">
            ✓ {monthLabel(month)}預算已完成：收入 {fmtMoney(income)}、存 {fmtMoney(saving)}、最低應繳 {fmtMoney(minDue)}、支出預算 {fmtMoney(t.all)}，保留 {fmtMoney(left)}。
            <div className="mt"><button className="btn ghost sm" onClick={() => { persist({ done: false }); setStep(3); }}>修改預算</button></div>
          </div>
        ) : <p className="small muted">分配好之後按下方「完成本月預算」。記帳時可以選擇算在哪個預算項目，本月概況就會顯示預算和實際的差距。</p>}
      </Card>

      {!b.done && (
        <div className="sticky-left">
          <div><div className="tiny muted">待分配</div><div className="hero-amount" style={{ fontSize: 26, color: left < 0 ? 'var(--err)' : 'var(--gold)' }}>{fmtMoney(left)}</div></div>
          <button className="btn" disabled={!income || left < 0} onClick={finish}>完成本月預算</button>
        </div>
      )}
    </>
  );
}

// 存錢與負債：可用餘額、提醒中心、設定清單、本月概況、每月預算（四步驟）
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Card, Field, Progress, Chips } from './ui.jsx';
import { newId } from '../lib/api.js';
import { fmtMoney } from '../lib/format.js';
import { toDateStr } from '../lib/plan.js';
import {
  BUDGET_GROUPS, availableBalance, budgetActuals, budgetFor, budgetId, budgetSuggestion, budgetTotals,
  financeReminders, monthlySummary, prevMonth, round, sum, goalProgress, diagnoseMonth,
  SCOPES, scoped, scopedBudgetId, savingSplit, wishSummary, categoryBreakdown, moodBreakdown, cardsDue, monthOf,
} from '../lib/finance.js';

const monthLabel = (m) => `${Number(m.slice(5, 7))} 月`;

// ---------- 本月可用餘額 ----------
export function BalanceHero({ month, go, scope = 'personal' }) {
  const { data: raw } = useStore();
  const data = scoped(raw, scope);
  const a = availableBalance(data, month);
  const sp = savingSplit(data, month);
  const cards = scope === 'personal' && month === toDateStr().slice(0, 7) ? cardsDue(raw, toDateStr()) : [];
  const cardTotal = sum(cards, (c) => c.st.due);
  return (
    <>
      <div className="hero-money">
        <div className="stat-label">{monthLabel(month)}可用餘額{scope !== 'personal' ? `・${SCOPES[scope]}` : ''}</div>
        <div className={`hero-amount ${a.afterDue < 0 ? 'neg' : ''}`}>{fmtMoney(a.afterDue)}</div>
        <div className="tiny muted">收入 {fmtMoney(a.income)} − 支出 {fmtMoney(a.expenses)} − 已還款 {fmtMoney(a.debtPaid)} − 已存入 {fmtMoney(a.saved)}{sp.sinking ? `（含預存 ${fmtMoney(sp.sinking)}）` : ''}{a.unpaidDue ? ` − 待繳 ${fmtMoney(a.unpaidDue)}` : ''}</div>
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
      {cardTotal > 0 && (
        <button type="button" className="due-banner" onClick={() => go('cards')}>
          <div><strong>信用卡本期應繳 {fmtMoney(cardTotal)}</strong><div className="tiny">{cards.map((c) => `${c.card.name} ${fmtMoney(c.st.due)}${c.st.dueDate ? `（${Number(c.st.dueDate.slice(5, 7))}/${Number(c.st.dueDate.slice(8))} 前）` : ''}`).join('、')}。刷卡已算進支出，繳卡費不會重複扣。</div></div>
          <span>卡費安排 ›</span>
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
export function MonthSummary({ month, scope = 'personal' }) {
  const { data: raw } = useStore();
  const data = scoped(raw, scope);
  const sp = savingSplit(data, month);
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
          {tile('儲蓄', fmtMoney(sp.saving), savingTarget ? `目標 ${fmtMoney(savingTarget)}` : '尚未設定目標', 'pos')}
          {sp.sinking ? tile('預存', fmtMoney(sp.sinking), '為之後大筆支出先存', 'pos') : null}
          {tile('還款', fmtMoney(m.debtPaid), `最低應繳合計 ${fmtMoney(m.minDue)}`)}
        </div>
      )}
    </Card>
  );
}

// ---------- 每月預算（四步驟） ----------
export function BudgetPlanner({ initialMonth, scope = 'personal' }) {
  const { data: raw, save: rawSave, toast } = useStore();
  const data = scoped(raw, scope);
  // 預算存檔時換成帳目歸屬專用的 id（個人 b-YYYY-MM，事業 b-business-YYYY-MM）
  const save = (col, rec, opts) => rawSave(col, col === 'budgets' ? { ...rec, id: scopedBudgetId(rec.month, scope), scope } : rec, opts);
  const [month, setMonth] = useState(initialMonth || toDateStr().slice(0, 7));
  const existing = budgetFor(data, month);
  const prev = budgetFor(data, prevMonth(month));
  const prevSummary = monthlySummary(data, prevMonth(month));
  const prevAct = budgetActuals(data, prevMonth(month), prev);
  return <BudgetEditor key={`${scope}-${month}`} month={month} setMonth={setMonth} existing={existing} prev={prev} prevSummary={prevSummary} prevAct={prevAct} save={save} toast={toast} data={data} />;
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

const nextMonthOf = (m) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ---------- 每月財務診斷 ----------
const DIAG_TABS = [['focus', '本月重點'], ['next', '下月計畫'], ['full', '完整診斷'], ['data', '數據明細']];

function monthStatus(month) {
  const today = toDateStr();
  const cur = today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  if (month < cur) return { label: '已過完', tag: 'ok', past: true };
  if (month > cur) return { label: '尚未開始', tag: '', past: false };
  const d = Number(today.slice(8));
  return { label: `進行中・第 ${d}／${days} 天`, tag: 'warn', past: false, current: true, left: days - d };
}

export function Diagnosis({ goBudget, scope = 'personal' }) {
  const { data: raw, save, toast, settings, saveSettings } = useStore();
  const data = scoped(raw, scope);
  const [month, setMonth] = useState(() => {
    // 每月前 5 天預設看上個月（剛過完、適合整理），其他時間看本月
    const t = toDateStr();
    return Number(t.slice(8)) <= 5 ? prevMonth(t.slice(0, 7)) : t.slice(0, 7);
  });
  const [tab, setTab] = useState('focus');
  const d = diagnoseMonth(data, month);
  const next = nextMonthOf(month);
  const nextBudget = budgetFor(data, next);
  const st = monthStatus(month);
  const key = `${scope}:${month}`;
  const closedList = Array.isArray(settings.closedMonths) ? settings.closedMonths : [];
  const closed = closedList.includes(key);
  const closedCount = closedList.filter((k) => k.startsWith(`${scope}:`)).length;
  const cats = categoryBreakdown(data, month, prevMonth(month));
  const moods = moodBreakdown(data, month);
  const wish = scope === 'personal' ? wishSummary(raw.wishlist, month) : { saved: 0, bought: 0 };
  const sp = savingSplit(data, month);
  const impulseList = data.transactions.filter((t) => monthOf(t.date) === month && t.impulse).sort((a, b) => b.amount - a.amount);
  const timed = data.transactions.filter((t) => monthOf(t.date) === month && t.expenseKind === 'timed');
  const good = [...d.good, ...(wish.saved > 0 ? [`願望清單幫你延後／取消了 ${fmtMoney(wish.saved)} 的購買。`] : [])];

  const planNext = async () => {
    if (nextBudget) { goBudget(next); return; }
    const ok = await save('budgets', {
      id: scopedBudgetId(next, scope), scope, month: next,
      income: d.a.income || Number(budgetFor(data, month)?.income) || '',
      saving: d.savingTarget || '',
      items: d.nextItems.map(({ adjusted, ...i }) => ({ ...i, id: newId() })), // eslint-disable-line no-unused-vars
      done: false,
    }, { silent: true });
    if (ok) { toast(`已建立 ${monthLabel(next)}預算草稿，超支的項目已調整`, 'success'); goBudget(next); }
  };
  const setClosed = async (v) => {
    const list = v ? [...new Set([...closedList, key])] : closedList.filter((k) => k !== key);
    if (await saveSettings({ closedMonths: list }, { silent: true })) {
      toast(v ? `完成第 ${list.filter((k) => k.startsWith(`${scope}:`)).length} 個月的財務整理 🎉` : '已重新開啟本月，可以繼續修改紀錄', 'success');
    }
  };

  return (
    <>
      <div className="row mb" style={{ alignItems: 'flex-end' }}>
        <Field label="診斷月份"><input className="input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field>
      </div>
      <div className="month-status">
        <div>
          <div className="tiny muted">{monthLabel(month)}狀態{scope !== 'personal' ? `・${SCOPES[scope]}` : ''}</div>
          <strong>{closed ? '✓ 已完成整理' : st.label}</strong>
          {closedCount > 0 && <div className="tiny" style={{ color: 'var(--tea)' }}>已完成 {closedCount} 個月的財務整理</div>}
        </div>
        {closed
          ? <button className="btn ghost sm" onClick={() => setClosed(false)}>重新開啟本月</button>
          : st.past ? <button className="btn sm" onClick={() => setClosed(true)}>完成第 {closedCount + 1} 個月的財務整理</button>
            : st.current ? <span className="tiny muted">月底過完再來完成整理</span> : null}
      </div>
      <div className="mb"><Chips value={tab} onChange={setTab} options={DIAG_TABS} /></div>
      {d.missing.length > 0 && <div className="notice warn small"><strong>資料不足：</strong>{d.missing.join('、')}。以下只根據已記錄的資料。</div>}

      {tab === 'focus' && (
        <>
          <div className="diag-card">
            <div className="eyebrow">{st.current ? '目前為止' : '本月最後結果'}</div>
            <h2 className="diag-headline">{d.headline}</h2>
            {d.detail.length > 0 && <p className="small muted mt">{d.detail.join('；')}。</p>}
            {d.attention.length > 0 && (
              <>
                <hr className="divider" />
                <div className="eyebrow">最值得注意</div>
                {d.attention.map((x) => (
                  <div key={x.title} className="list-item"><strong>{x.title}</strong><div className="small muted">{x.detail}</div></div>
                ))}
              </>
            )}
          </div>
          {good.length > 0 && (
            <div className="diag-card good">
              <h3>本月做得好的地方</h3>
              {good.map((g) => <div key={g} className="small mt">✓ {g}</div>)}
            </div>
          )}
        </>
      )}

      {tab === 'next' && (
        <div className="diag-card">
          <div className="eyebrow">下一步</div>
          <h3 style={{ marginTop: 4 }}>把本月重點帶進{monthLabel(next)}安排</h3>
          {d.attention.length > 0 && (
            <ul className="small mt" style={{ paddingLeft: 18 }}>
              {d.attention.slice(0, 3).map((x) => <li key={x.title}>{x.title}</li>)}
            </ul>
          )}
          {d.hasBudget ? (
            <>
              {d.nextItems.some((i) => i.adjusted)
                ? <p className="small muted mt">超支的項目會改成本月實際金額：{d.nextItems.filter((i) => i.adjusted).map((i) => `${i.name} ${fmtMoney(i.amount)}`).join('、')}</p>
                : <p className="small muted mt">本月沒有超支的項目，下月預算會沿用本月的安排。</p>}
              {d.savingTarget > 0 && <p className="small muted">儲蓄目標沿用 {fmtMoney(d.savingTarget)}。</p>}
              <button className="btn block mt" onClick={planNext}>{nextBudget ? `查看 ${monthLabel(next)}預算` : `建立 ${monthLabel(next)}預算`}</button>
            </>
          ) : <button className="btn block mt" onClick={() => goBudget(month)}>先編 {monthLabel(month)}預算</button>}
        </div>
      )}

      {tab === 'full' && (
        <>
          <Card title="支出分類：本月 vs 上月">
            {cats.length === 0 ? <p className="small muted">沒有支出紀錄</p> : (
              <div className="table-wrap"><table>
                <thead><tr><th>分類</th><th className="num">本月</th><th className="num">上月</th><th className="num">差異</th></tr></thead>
                <tbody>{cats.slice(0, 12).map((c) => (
                  <tr key={c.category}><td>{c.category}</td><td className="num">{fmtMoney(c.amount)}</td><td className="num">{fmtMoney(c.last)}</td>
                    <td className="num" style={{ color: c.diff > 0 ? 'var(--err)' : c.diff < 0 ? 'var(--ok)' : undefined }}>{c.diff > 0 ? '+' : ''}{fmtMoney(c.diff)}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
          <Card title="消費習慣">
            <div className="grid grid-3">
              <div className="stat"><div className="stat-label">想要類支出</div><div className="stat-value">{fmtMoney(d.wants)}</div><div className="stat-sub">{d.a.expenses ? `佔支出 ${Math.round((d.wants / d.a.expenses) * 100)}%` : '—'}</div></div>
              <div className="stat"><div className="stat-label">衝動消費</div><div className="stat-value">{fmtMoney(d.impulse)}</div><div className="stat-sub">{impulseList.length} 筆</div></div>
              <div className="stat"><div className="stat-label">臨時性支出</div><div className="stat-value">{fmtMoney(d.temporary)}</div><div className="stat-sub">不含衝動消費</div></div>
            </div>
            {impulseList.length > 0 && (
              <div className="mt">
                <div className="small muted">衝動消費明細</div>
                {impulseList.slice(0, 5).map((t) => <div key={t.id} className="list-item row between small"><span>{t.date.slice(5)}｜{t.category || '—'}{t.mood ? `・${t.mood}` : ''}</span><strong>{fmtMoney(t.amount)}</strong></div>)}
              </div>
            )}
            {moods.length > 0 && (
              <div className="mt">
                <div className="small muted">情緒與消費（有記錄情緒的支出）</div>
                {moods.map(([mood, amt]) => <div key={mood} className="list-item row between small"><span>{mood}</span><strong>{fmtMoney(amt)}</strong></div>)}
              </div>
            )}
            {timed.length > 0 && (
              <div className="mt">
                <div className="small muted">時效支出（一次付、用很多個月）</div>
                {timed.map((t) => <div key={t.id} className="list-item row between small"><span>{t.category || '—'}・有效 {t.validMonths || 1} 個月</span><strong>{fmtMoney(t.amount)}（每月約 {fmtMoney(round(t.amount / (t.validMonths || 1)))}）</strong></div>)}
              </div>
            )}
          </Card>
          {scope === 'personal' && (
            <Card title="存錢與願望清單">
              <div className="grid grid-3">
                <div className="stat"><div className="stat-label">儲蓄</div><div className="stat-value pos">{fmtMoney(sp.saving)}</div><div className="stat-sub">目標 {fmtMoney(d.savingTarget)}</div></div>
                <div className="stat"><div className="stat-label">預存</div><div className="stat-value pos">{fmtMoney(sp.sinking)}</div><div className="stat-sub">為之後的大筆支出</div></div>
                <div className="stat"><div className="stat-label">願望清單省下</div><div className="stat-value">{fmtMoney(wish.saved)}</div><div className="stat-sub">決定購買 {fmtMoney(wish.bought)}</div></div>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === 'data' && (
        <Card title="本月數據明細">
          <div className="table-wrap"><table>
            <tbody>
              <tr><td>收入</td><td className="num">{fmtMoney(d.a.income)}</td></tr>
              <tr><td>固定支出（預算）</td><td className="num">{fmtMoney(d.act.fixed)}（{fmtMoney(d.t.fixed)}）</td></tr>
              <tr><td>變動支出（預算）</td><td className="num">{fmtMoney(d.act.variable)}（{fmtMoney(d.t.variable)}）</td></tr>
              <tr><td>事業成本（預算）</td><td className="num">{fmtMoney(d.act.business)}（{fmtMoney(d.t.business)}）</td></tr>
              <tr><td>想要類支出</td><td className="num">{fmtMoney(d.wants)}</td></tr>
              <tr><td>衝動消費／臨時性支出</td><td className="num">{fmtMoney(d.impulse)}／{fmtMoney(d.temporary)}</td></tr>
              <tr><td>儲蓄＋預存（目標）</td><td className="num">{fmtMoney(d.a.saved)}（{fmtMoney(d.savingTarget)}）</td></tr>
              <tr><td>還款／待繳</td><td className="num">{fmtMoney(d.a.debtPaid)}／{fmtMoney(d.a.unpaidDue)}</td></tr>
              <tr><td>可用餘額</td><td className="num">{fmtMoney(d.a.afterDue)}</td></tr>
              <tr><td>記帳筆數</td><td className="num">{data.transactions.filter((t) => monthOf(t.date) === month).length}</td></tr>
            </tbody>
          </table></div>
        </Card>
      )}
      <p className="tiny muted" style={{ textAlign: 'center' }}>診斷依你輸入的資料自動整理，僅供參考，不構成專業財務建議。想要更深入的分析，可以到「更多 → AI 財務建議」。</p>
    </>
  );
}

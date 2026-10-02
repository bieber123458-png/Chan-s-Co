import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Empty, Chips, Confirm, Stat, Progress, Field } from '../components/ui.jsx';
import RecordForm, { blankFrom } from '../components/RecordForm.jsx';
import { AiNotice, AiPanel } from '../components/AiPanel.jsx';
import { BalanceHero, ReminderCenter, SetupChecklist, MonthSummary, BudgetPlanner, Diagnosis } from '../components/MoneyPanels.jsx';
import { MoreGrid, MORE_ITEMS, AccountsView, CardsView, LedgerView, CalendarView, WishlistView, NotesView } from '../components/MoneyMore.jsx';
import { fmtMoney, fmtShortDate } from '../lib/format.js';
import {
  TX_TYPES, INCOME_CATEGORIES, BUDGET_GROUPS, budgetFor, STRATEGIES, monthlySummary, debtStatus, splitPayment, payoffMonths, goalProgress, avgEssential, monthOf, round, sum,
  SCOPES, scoped, txOwner, prevMonth, availableBalance,
} from '../lib/finance.js';
import { toDateStr } from '../lib/plan.js';

const EXPENSE_SUGGEST = {
  essential: ['房租', '水電瓦斯', '餐費', '交通', '電話網路', '保險', '家用'],
  nonessential: ['購物', '娛樂', '外食聚餐', '訂閱服務', '旅遊'],
  business: ['婕樂纖進貨', '廣告費', '拍攝器材', '課程學習', '包材運費', '平台手續費'],
  income: INCOME_CATEGORIES,
};

const ALL_SUGGEST = [...new Set(Object.values(EXPENSE_SUGGEST).flat())];
const txFields = (items, accounts = []) => [...TX_FIELDS,
  { key: 'owner', label: '帳目歸屬', type: 'select', options: Object.entries(SCOPES) },
  ...(accounts.length ? [{ key: 'accountId', label: '帳戶', type: 'select', options: [['', '未指定'], ...accounts.map((a) => [a.id, a.name])] }] : []),
  ...(items.length ? [{ key: 'budgetItem', label: '算在哪個預算項目（選填）', type: 'select', options: [['', '不指定（依類型自動歸類）'], ...items.map((i) => [i.id, `${BUDGET_GROUPS[i.group]?.name}｜${i.name}`])] }] : [])];
const TX_FIELDS = [
  { key: 'date', label: '日期', type: 'date', required: true },
  { key: 'type', label: '類型', type: 'select', options: Object.entries(TX_TYPES) },
  { key: 'amount', label: '金額（元）', type: 'money', required: true, positive: true },
  { key: 'category', label: '分類', type: 'text', suggestions: ALL_SUGGEST, placeholder: '可直接輸入或從建議選擇' },
  { key: 'note', label: '備註', type: 'text', full: true },
];

const DEBT_FIELDS = [
  { key: 'name', label: '債務名稱', type: 'text', required: true, placeholder: '例如：信用卡、信貸、分期' },
  { key: 'startBalance', label: '目前剩餘本金（元）', type: 'money', required: true, hint: '建立時的剩餘本金，之後依還款紀錄自動扣除' },
  { key: 'apr', label: '年利率（%）', type: 'number', required: true, max: 100, hint: '信用卡循環通常約 10～15%' },
  { key: 'minPayment', label: '每月最低應繳（元）', type: 'money', required: true },
  { key: 'dueDay', label: '每月繳款日', type: 'number', min: 1, max: 31, required: true },
  { key: 'plannedPayment', label: '每月實際打算還多少（元）', type: 'money', hint: '可大於最低應繳' },
  { key: 'note', label: '備註', type: 'text', full: true },
];

const GOAL_FIELDS = [
  { key: 'name', label: '目標名稱', type: 'text', required: true, placeholder: '例如：緊急預備金' },
  { key: 'purpose', label: '存錢用途', type: 'text', placeholder: '例如：半年生活費、進修、旅遊' },
  { key: 'target', label: '目標金額（元）', type: 'money', required: true, positive: true },
  { key: 'targetDate', label: '目標日期', type: 'date', default: '' },
  { key: 'monthlyAmount', label: '每月預計存入（元）', type: 'money' },
  { key: 'isEmergency', label: '緊急預備金', type: 'checkbox', checkLabel: '這是緊急預備金' },
  { key: 'isSinking', label: '預存', type: 'checkbox', checkLabel: '這是預存（為之後的大筆支出先存，例如保險年繳、年費）' },
];

const depositFields = (goals) => [
  { key: 'goalId', label: '存錢目標', type: 'select', options: goals.map((g) => [g.id, g.name]) },
  { key: 'kind', label: '類型', type: 'select', options: [['deposit', '存入'], ['withdraw', '提領']] },
  { key: 'date', label: '日期', type: 'date', required: true },
  { key: 'amount', label: '金額（元）', type: 'money', required: true, positive: true },
  { key: 'account', label: '帳戶', type: 'text', placeholder: '例如：郵局、數位帳戶' },
  { key: 'note', label: '備註', type: 'text' },
];

// ---------------- 快訊（首頁） ----------------
const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? '夜深了' : h < 11 ? '早安' : h < 14 ? '午安' : h < 18 ? '下午好' : '晚安';
};
const SHORTCUTS = ['ledger', 'calendar', 'cards', 'savings', 'wishlist'];

function Home({ go, scope, goBudget }) {
  const { data: raw, settings, saveSettings } = useStore();
  const data = scoped(raw, scope);
  const [month, setMonth] = useState(toDateStr().slice(0, 7));
  const cur = toDateStr().slice(0, 7);
  const last = prevMonth(cur);
  const lastCount = data.transactions.filter((t) => monthOf(t.date) === last).length;
  const lastA = availableBalance(data, last);
  const hasBudget = !!budgetFor(data, cur);
  const tipKey = `${scope}:${cur}`;
  const showTip = lastCount > 0 && settings.tipDismissed !== tipKey;
  const m = monthlySummary(data, month);
  const goalsSaved = sum(raw.savingsGoals, (g) => goalProgress(g, raw.deposits).saved);
  const goalsTarget = sum(raw.savingsGoals, (g) => g.target);
  return (
    <>
      <div className="greet">
        <div className="eyebrow">{Number(cur.slice(5))} 月・{SCOPES[scope]}帳</div>
        <h2>{greeting()}，{settings.displayName || '小陳'}</h2>
      </div>
      {showTip && (
        <div className="tip-card">
          <button type="button" className="icon-btn close" aria-label="關閉提示" onClick={() => saveSettings({ tipDismissed: tipKey }, { silent: true })}>✕</button>
          <div className="small">上個月你記了 <strong>{lastCount}</strong> 筆帳，{lastA.saved > 0 ? <>存了 <strong>{fmtMoney(lastA.saved)}</strong></> : <>收支結餘 <strong>{fmtMoney(round(lastA.income - lastA.expenses))}</strong></>}。這個月繼續？</div>
          {hasBudget
            ? <button className="btn sm mt" onClick={() => go('diag')}>看上個月診斷</button>
            : <button className="btn sm mt" onClick={() => goBudget(cur)}>設定 {Number(cur.slice(5))} 月預算</button>}
        </div>
      )}
      <div className="row mb"><Field label="查看月份"><input className="input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field></div>
      <BalanceHero month={month} go={go} scope={scope} />
      <div className="icon-grid shortcuts mb">
        {MORE_ITEMS.filter(([k2]) => SHORTCUTS.includes(k2)).map(([k2, icon, label]) => (
          <button key={k2} type="button" className="icon-tile" onClick={() => go(k2)}><span className="ico">{icon}</span><span>{label}</span></button>
        ))}
      </div>
      {scope === 'personal' && month === cur && <SetupChecklist go={go} />}
      {scope === 'personal' && month === cur && <ReminderCenter go={go} />}
      <MonthSummary month={month} scope={scope} />
      {scope === 'personal' ? (
        <div className="grid grid-3 mb">
          <Stat label="剩餘債務" value={fmtMoney(m.remainingDebt)} sub={`本金（利息另計）・本月還本金 ${fmtMoney(m.debtPrincipal)}`} />
          <Stat label="存錢進度" value={goalsTarget ? `${Math.round((goalsSaved / goalsTarget) * 100)}%` : '—'} sub={goalsTarget ? `${fmtMoney(goalsSaved)}／${fmtMoney(goalsTarget)}` : '尚未設定存錢目標'} />
          <Stat label="事業淨收入" value={fmtMoney(monthlySummary(raw, month).businessNet)} sub="收入－事業成本（不是利潤全貌）" />
        </div>
      ) : (
        <p className="tiny muted mb">{SCOPES[scope]}帳只看歸屬「{SCOPES[scope]}」的收支與預算；負債與存錢目標放在個人帳。</p>
      )}
    </>
  );
}

function AiView() {
  return (
    <Card title="AI 財務建議">
      <p className="small muted">AI 只會看你已記錄的收支、負債與存錢資料，優先考慮必要生活費、最低應繳與緊急預備金。</p>
      <AiPanel kind="finance" refId="finance" label="根據我的收支給建議" buildBody={(x) => ({ input: x, summary: '財務建議' })}
        inputPlaceholder="（選填）想問的問題，例如：這個月多出 5,000 元，要先還卡債還是存起來？" />
    </Card>
  );
}

// ---------------- 還款策略 ----------------
function StrategyView() {
  const { data, settings, saveSettings } = useStore();
  const month = toDateStr().slice(0, 7);
  const [customExtra, setCustomExtra] = useState('');
  const m = monthlySummary(data, month);
  const ess = avgEssential(data);
  const emergencyTarget = ess ? ess * (settings.emergencyMonths || 3) : null;
  const emergencySaved = sum(data.savingsGoals.filter((g) => g.isEmergency), (g) => goalProgress(g, data.deposits).saved);
  const strategy = STRATEGIES[settings.strategy] ? settings.strategy : 'balanced';
  const extra = Number(settings.extraDebtPayment) || 0;

  // 依策略決定優先還款的債務：高利率優先（其他策略也用利率排序作為參考）
  const activeDebts = data.debts
    .map((d) => ({ ...d, st: debtStatus(d, data.debtPayments) }))
    .filter((d) => !d.st.paidOff)
    .sort((a, b) => b.apr - a.apr);
  const focus = activeDebts[0];
  const simMin = focus ? payoffMonths(focus.st.remaining, focus.apr, focus.minPayment) : null;
  const planBase = focus ? Math.max(Number(focus.plannedPayment) || 0, Number(focus.minPayment) || 0) : 0;
  const simPlan = focus ? payoffMonths(focus.st.remaining, focus.apr, planBase + extra) : null;

  const months = (r) => (r.months === Infinity ? '無法還清（月付不足以支付利息）' : `${r.months} 個月，總利息約 ${fmtMoney(r.interest)}`);

  return (
    <>
      <Card title="還款與存錢策略">
        <Chips value={strategy} onChange={(k) => saveSettings({ strategy: k })} options={Object.entries(STRATEGIES).map(([k, s]) => [k, s.name])} />
        <div className="grid grid-3 mt">
          <div className="stat"><div className="stat-label">優點</div><p className="small">{STRATEGIES[strategy].pros}</p></div>
          <div className="stat"><div className="stat-label">缺點</div><p className="small">{STRATEGIES[strategy].cons}</p></div>
          <div className="stat"><div className="stat-label">適合情況</div><p className="small">{STRATEGIES[strategy].fit}</p></div>
        </div>
        <hr className="divider" />
        <div className="small mb"><strong>緊急預備金：</strong>
          {emergencyTarget
            ? <>以近期必要支出月平均 {fmtMoney(ess)} × {settings.emergencyMonths} 個月 = {fmtMoney(emergencyTarget)}；已存 {fmtMoney(emergencySaved)}（勾選為緊急預備金的存錢目標）。</>
            : '還沒有必要生活支出紀錄，無法估算緊急預備金目標。'}
        </div>
        {emergencyTarget ? <Progress value={(emergencySaved / emergencyTarget) * 100} /> : null}
        <hr className="divider" />
        <div className="small mb"><strong>每月額外還款金額</strong>（在最低應繳之外，自己決定）</div>
        <div className="row">
          <Chips value={String(extra)} onChange={(k) => saveSettings({ extraDebtPayment: Number(k) })} options={[['0', '不額外還'], ['2000', '2,000'], ['3000', '3,000']]} />
          <input className="input" style={{ width: 140 }} type="number" min="0" inputMode="numeric" placeholder="自行輸入" value={customExtra} onChange={(e) => setCustomExtra(e.target.value)} />
          <button className="btn ghost sm" onClick={() => { const n = Number(customExtra); if (customExtra !== '' && n >= 0) { saveSettings({ extraDebtPayment: n }); setCustomExtra(''); } }}>套用</button>
        </div>
        <p className="tiny muted mt">目前設定：每月額外還款 {fmtMoney(extra)}。{ess && m.income ? `建議先確認：收入 − 必要支出 − 最低應繳 = ${fmtMoney(m.income - m.essential - m.minDue)}，額外還款不要超過這個數字。` : ''}</p>
        {focus && (
          <div className="notice info mt small">
            以利率最高的「{focus.name}」（剩餘 {fmtMoney(focus.st.remaining)}，年利率 {focus.apr}%）試算：<br />
            只繳最低 {fmtMoney(focus.minPayment)}：{months(simMin)}<br />
            {planBase + extra > focus.minPayment && <>依你的計畫每月還 {fmtMoney(planBase + extra)}{extra ? `（含額外 ${fmtMoney(extra)}）` : ''}：{months(simPlan)}<br /></>}
            {strategy === 'emergency' && <span className="tiny">你選擇先建立緊急預備金：這段期間建議先只繳最低應繳，多出來的錢優先存入預備金。</span>}
            <div className="tiny muted">試算假設利率固定、不再新增借款，實際以銀行帳單為準。</div>
          </div>
        )}
      </Card>

    </>
  );
}


// ---------------- 記帳明細（含編輯） ----------------
function Ledger({ scope }) {
  const { data, save } = useStore();
  const [form, setForm] = useState(null);
  return (
    <>
      <div className="notice info small">債務還款請到「負債追蹤」記錄，繳卡費請到「信用卡」按「繳卡費」；這裡不要重複記，以免支出被算兩次。</div>
      <div className="row mb"><button className="btn sm" onClick={() => setForm(blankFrom(TX_FIELDS, { type: 'essential', owner: scope, accountId: '' }))}>＋ 用表單新增</button></div>
      <LedgerView scope={scope} onEdit={setForm} />
      {form && <RecordForm title={form.id ? '編輯收支' : '新增收支'} fields={txFields(budgetFor(scoped(data, form.owner || txOwner(form)), monthOf(form.date || toDateStr()))?.items || [], data.accounts)}
        initial={{ budgetItem: '', accountId: '', ...form, owner: form.owner || txOwner(form) }}
        onSave={(v) => save('transactions', v)} onClose={() => setForm(null)} />}
    </>
  );
}

// ---------------- 負債 ----------------
function PaymentForm({ debt, remaining, initial, onSave, onClose }) {
  const suggest = (total) => splitPayment({ total, remaining, apr: debt.apr, minPayment: debt.minPayment }).interest;
  const fields = [
    { key: 'date', label: '還款日期', type: 'date', required: true },
    { key: 'total', label: '這次實際還款金額（元）', type: 'money', required: true, positive: true },
    { key: 'interest', label: '其中利息（元）', type: 'money', required: true, hint: '已依剩餘本金與年利率預估，請以帳單為準修改' },
    { key: 'note', label: '備註', type: 'text' },
  ];
  return (
    <RecordForm title={`${initial.id ? '編輯' : '記錄'}還款：${debt.name}`} fields={fields} initial={initial}
      onChange={(v, k) => (k === 'total' ? { ...v, interest: v.total === '' ? '' : suggest(v.total) } : v)}
      check={(v) => (v.interest > v.total ? { interest: '利息不能大於還款金額' } : {})}
      onSave={(v) => {
        const principal = Math.min(remaining, round(v.total - v.interest));
        return onSave({ ...v, debtId: debt.id, principal, extra: Math.max(0, round(v.total - (Number(debt.minPayment) || 0))) });
      }}
      onClose={onClose}>
      {(v) => {
        const t = Number(v.total) || 0;
        const i = Number(v.interest) || 0;
        const p = Math.min(remaining, Math.max(0, t - i));
        return (
          <div className="notice info small">
            本金 {fmtMoney(p)}・利息 {fmtMoney(i)}・最低應繳 {fmtMoney(debt.minPayment)}・
            {t >= debt.minPayment ? `額外還款 ${fmtMoney(t - debt.minPayment)}` : <strong>低於最低應繳 {fmtMoney(debt.minPayment - t)}</strong>}
            {t - i > remaining && <div>還款金額超過剩餘本金，多出的 {fmtMoney(t - i - remaining)} 不會計入本金。</div>}
          </div>
        );
      }}
    </RecordForm>
  );
}

function Debts() {
  const { data, save, remove } = useStore();
  const [form, setForm] = useState(null);
  const [pay, setPay] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [open, setOpen] = useState(null);
  const totalRemaining = sum(data.debts, (d) => debtStatus(d, data.debtPayments).remaining);

  const removeDebt = async (d) => {
    for (const p of data.debtPayments.filter((x) => x.debtId === d.id)) await remove('debtPayments', p.id, { silent: true });
    await remove('debts', d.id);
  };

  return (
    <>
      <Card title="負債清單" action={<button className="btn sm" onClick={() => setForm(blankFrom(DEBT_FIELDS))}>＋ 新增負債</button>}>
        <p className="small muted mb">剩餘債務合計 <strong>{fmtMoney(totalRemaining)}</strong>。每筆還款會拆成本金與利息，只有本金會減少剩餘債務。</p>
        {data.debts.length === 0 && <Empty title="沒有負債紀錄">如果有信用卡、信貸或分期，新增後就能追蹤還款進度。</Empty>}
        {[...data.debts].sort((a, b) => b.apr - a.apr).map((d) => {
          const st = debtStatus(d, data.debtPayments);
          const pays = data.debtPayments.filter((p) => p.debtId === d.id).sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={d.id} className="card soft">
              <div className="row between">
                <div><strong>{d.name}</strong> {st.paidOff && <span className="tag ok">已還清</span>}
                  <div className="tiny muted">年利率 {d.apr}%・最低應繳 {fmtMoney(d.minPayment)}・每月 {d.dueDay} 日繳款{d.plannedPayment ? `・計畫每月還 ${fmtMoney(d.plannedPayment)}` : ''}</div></div>
                <div className="right"><div className="stat-value" style={{ fontSize: 20 }}>{fmtMoney(st.remaining)}</div><div className="tiny muted">剩餘本金</div></div>
              </div>
              <div className="mt"><Progress value={d.startBalance ? (st.principalPaid / d.startBalance) * 100 : 0} /></div>
              <div className="tiny muted mt">已還本金 {fmtMoney(st.principalPaid)}・已付利息 {fmtMoney(st.interestPaid)}・還款合計 {fmtMoney(st.totalPaid)}</div>
              <div className="row mt">
                {!st.paidOff && <button className="btn sm" onClick={() => setPay({ debt: d, remaining: st.remaining, initial: { date: toDateStr(), total: d.plannedPayment || d.minPayment, interest: splitPayment({ total: d.plannedPayment || d.minPayment, remaining: st.remaining, apr: d.apr, minPayment: d.minPayment }).interest, note: '' } })}>記錄還款</button>}
                <button className="btn ghost sm" onClick={() => setOpen(open === d.id ? null : d.id)}>還款紀錄（{pays.length}）</button>
                <button className="btn ghost sm" onClick={() => setForm(d)}>編輯</button>
                <button className="btn danger sm" onClick={() => setConfirm({ type: 'debt', item: d })}>刪除</button>
              </div>
              {open === d.id && (
                <div className="table-wrap mt">
                  {pays.length === 0 ? <p className="small muted">還沒有還款紀錄</p> : (
                    <table><thead><tr><th>日期</th><th className="num">還款</th><th className="num">本金</th><th className="num">利息</th><th className="num">額外</th><th></th></tr></thead>
                      <tbody>{pays.map((p) => (
                        <tr key={p.id}><td>{fmtShortDate(p.date)}</td><td className="num">{fmtMoney(p.total)}</td><td className="num">{fmtMoney(p.principal)}</td><td className="num">{fmtMoney(p.interest)}</td><td className="num">{fmtMoney(p.extra)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}><button className="icon-btn" onClick={() => setPay({ debt: d, remaining: round(st.remaining + (Number(p.principal) || 0)), initial: p })}>編輯</button><button className="icon-btn" onClick={() => setConfirm({ type: 'pay', item: p })}>刪除</button></td></tr>))}
                      </tbody></table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>
      {form && <RecordForm title={form.id ? '編輯負債' : '新增負債'} fields={DEBT_FIELDS} initial={form} onSave={(v) => save('debts', v)} onClose={() => setForm(null)}>
        {form.id && <p className="tiny muted">修改「剩餘本金」代表重設起始金額，已記錄的還款本金仍會從這個數字扣除。</p>}
      </RecordForm>}
      {pay && <PaymentForm {...pay} onSave={(v) => save('debtPayments', v)} onClose={() => setPay(null)} />}
      {confirm?.type === 'debt' && <Confirm strong onClose={() => setConfirm(null)} onConfirm={() => removeDebt(confirm.item)} message={`刪除「${confirm.item.name}」？它的所有還款紀錄也會一起刪除。`} />}
      {confirm?.type === 'pay' && <Confirm strong onClose={() => setConfirm(null)} onConfirm={() => remove('debtPayments', confirm.item.id)} message={`刪除 ${confirm.item.date} 還款 ${fmtMoney(confirm.item.total)}？剩餘本金會加回 ${fmtMoney(confirm.item.principal)}。`} />}
    </>
  );
}

// ---------------- 存錢 ----------------
function Savings() {
  const { data, save, remove } = useStore();
  const [goalForm, setGoalForm] = useState(null);
  const [depForm, setDepForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const goals = data.savingsGoals;
  const deposits = useMemo(() => [...data.deposits].sort((a, b) => b.date.localeCompare(a.date)), [data.deposits]);

  const removeGoal = async (g) => {
    for (const d of data.deposits.filter((x) => x.goalId === g.id)) await remove('deposits', d.id, { silent: true });
    await remove('savingsGoals', g.id);
  };

  return (
    <>
      <Card title="目標追蹤" action={<button className="btn sm" onClick={() => setGoalForm(blankFrom(GOAL_FIELDS))}>＋ 新增目標</button>}>
        {goals.length === 0 && <Empty title="還沒有存錢目標">建議第一個目標是「緊急預備金」，金額約 3 個月必要生活費。</Empty>}
        <div className="grid grid-2">
          {goals.map((g) => {
            const p = goalProgress(g, data.deposits);
            return (
              <div key={g.id} className="card soft" style={{ marginBottom: 0 }}>
                <div className="row between"><strong>{g.name}</strong>{g.isEmergency && <span className="tag gold">緊急預備金</span>}{g.isSinking && <span className="tag">預存</span>}</div>
                {g.purpose && <div className="tiny muted">用途：{g.purpose}</div>}
                <div className="stat-value mt" style={{ fontSize: 20 }}>{fmtMoney(p.saved)} <span className="small muted">／ {fmtMoney(p.target)}</span></div>
                <Progress value={p.pct} />
                <div className="tiny muted mt">
                  {Math.round(p.pct)}%
                  {g.targetDate && `・目標日 ${g.targetDate}・還有 ${p.monthsLeft} 個月`}
                  {p.neededPerMonth !== null && p.saved < p.target && `・每月需存約 ${fmtMoney(p.neededPerMonth)}`}
                  {g.monthlyAmount ? `・計畫每月 ${fmtMoney(g.monthlyAmount)}` : ''}
                </div>
                {p.neededPerMonth !== null && g.monthlyAmount && p.neededPerMonth > g.monthlyAmount && p.saved < p.target && (
                  <div className="tiny" style={{ color: 'var(--warn)' }}>依目前計畫可能無法在目標日前達成，可以延後目標日或調整金額，不必勉強。</div>
                )}
                <div className="row mt">
                  <button className="btn sm" onClick={() => setDepForm(blankFrom(depositFields(goals), { goalId: g.id, kind: 'deposit', amount: g.monthlyAmount || '' }))}>存入／提領</button>
                  <button className="btn ghost sm" onClick={() => setGoalForm(g)}>編輯</button>
                  <button className="btn danger sm" onClick={() => setConfirm({ type: 'goal', item: g })}>刪除</button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="存款紀錄">
        {deposits.length === 0 ? <Empty title="還沒有存款紀錄" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>日期</th><th>目標</th><th>帳戶／備註</th><th className="num">金額</th><th></th></tr></thead>
            <tbody>{deposits.map((d) => (
              <tr key={d.id}><td>{fmtShortDate(d.date)}</td><td>{goals.find((g) => g.id === d.goalId)?.name || '（目標已刪除）'}</td>
                <td>{d.account || '—'}{d.note && <div className="tiny muted">{d.note}</div>}</td>
                <td className="num" style={{ color: d.kind === 'withdraw' ? 'var(--err)' : 'var(--ok)' }}>{d.kind === 'withdraw' ? '-' : '+'}{fmtMoney(d.amount)}</td>
                <td style={{ whiteSpace: 'nowrap' }}><button className="icon-btn" onClick={() => setDepForm(d)}>編輯</button><button className="icon-btn" onClick={() => setConfirm({ type: 'dep', item: d })}>刪除</button></td></tr>))}
            </tbody></table></div>
        )}
      </Card>
      {goalForm && <RecordForm title={goalForm.id ? '編輯存錢目標' : '新增存錢目標'} fields={GOAL_FIELDS} initial={goalForm} onSave={(v) => save('savingsGoals', v)} onClose={() => setGoalForm(null)} />}
      {depForm && <RecordForm title={depForm.id ? '編輯存款紀錄' : '存入／提領'} fields={depositFields(goals)} initial={depForm} onSave={(v) => save('deposits', v)} onClose={() => setDepForm(null)} />}
      {confirm?.type === 'goal' && <Confirm strong onClose={() => setConfirm(null)} onConfirm={() => removeGoal(confirm.item)} message={`刪除存錢目標「${confirm.item.name}」？它的存款紀錄也會一起刪除（實際帳戶裡的錢不受影響）。`} />}
      {confirm?.type === 'dep' && <Confirm strong onClose={() => setConfirm(null)} onConfirm={() => remove('deposits', confirm.item.id)} message={`刪除 ${confirm.item.date} 的${confirm.item.kind === 'withdraw' ? '提領' : '存入'} ${fmtMoney(confirm.item.amount)}？`} />}
    </>
  );
}

const NAV = [['home', '快訊'], ['budget', '預算'], ['diag', '診斷'], ['more', '更多']];
const SCOPED_VIEWS = ['home', 'budget', 'diag', 'ledger', 'calendar'];
const ALIAS = { tx: 'ledger', overview: 'home' };

export default function Finance() {
  const [view, setView] = useState('home');
  const [scope, setScope] = useState('personal');
  const [budgetMonth, setBudgetMonth] = useState(null);
  const go = (t) => { setView(ALIAS[t] || t); window.scrollTo(0, 0); };
  const goBudget = (m) => { setBudgetMonth(m); go('budget'); };
  const isMore = !NAV.some(([k]) => k === view);
  const title = isMore ? MORE_ITEMS.find(([k]) => k === view)?.[2] : null;
  return (
    <>
      <PageHead eyebrow="MONEY" title="存錢與負債管理" desc="先照顧好生活費與最低應繳，再一步一步存錢、還債。" />
      <AiNotice />
      <div className="seg money-nav mb">
        {NAV.map(([k, l]) => <button key={k} type="button" className={view === k || (k === 'more' && isMore) ? 'on' : ''} onClick={() => go(k)}>{l}</button>)}
      </div>
      {SCOPED_VIEWS.includes(view) && (
        <div className="scope-bar mb">
          <span className="tiny muted">帳本</span>
          <Chips value={scope} onChange={setScope} options={Object.entries(SCOPES)} />
        </div>
      )}
      {isMore && <button type="button" className="btn ghost sm mb" onClick={() => go('more')}>‹ 更多{title ? `／${title}` : ''}</button>}
      {view === 'home' && <Home go={go} scope={scope} goBudget={goBudget} />}
      {view === 'budget' && <BudgetPlanner key={`${scope}-${budgetMonth || 'now'}`} initialMonth={budgetMonth} scope={scope} />}
      {view === 'diag' && <Diagnosis key={scope} goBudget={goBudget} scope={scope} />}
      {view === 'more' && <MoreGrid go={go} />}
      {view === 'ledger' && <Ledger scope={scope} />}
      {view === 'calendar' && <CalendarView scope={scope} />}
      {view === 'cards' && <CardsView go={go} />}
      {view === 'accounts' && <AccountsView />}
      {view === 'savings' && <Savings />}
      {view === 'wishlist' && <WishlistView />}
      {view === 'debts' && <Debts />}
      {view === 'notes' && <NotesView />}
      {view === 'strategy' && <StrategyView />}
      {view === 'ai' && <AiView />}
    </>
  );
}

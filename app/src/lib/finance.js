// 財務計算（前後端共用，純函式，可單元測試）
// 原則：
// 1. 收支紀錄（transactions）不包含債務還款；債務還款只記在 debtPayments，避免重複計算。
// 2. 每筆還款拆成「利息」「本金」，另外標示超過最低應繳的「額外還款」。
// 3. 存錢（deposits）是把錢移到存款，計入「儲蓄」，不算支出。

export const TX_TYPES = {
  income: '收入',
  essential: '必要生活支出',
  nonessential: '非必要支出',
  business: '事業成本',
};

export const INCOME_CATEGORIES = ['零售收入', '團隊獎金', '美業服務/課程', '其他收入'];

export const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const monthOf = (date) => String(date || '').slice(0, 7);

// 依剩餘本金估算當月利息（年利率 %），並拆分一筆還款
export function splitPayment({ total, remaining, apr, minPayment }) {
  const t = Math.max(0, Number(total) || 0);
  const rem = Math.max(0, Number(remaining) || 0);
  const estInterest = Math.round((rem * (Number(apr) || 0)) / 100 / 12);
  const interest = Math.min(t, estInterest);
  const principal = Math.min(rem, t - interest);
  const extra = Math.max(0, t - (Number(minPayment) || 0));
  return { interest, principal, extra, overpay: round(t - interest - principal) };
}

// 單一負債目前狀態
export function debtStatus(debt, payments) {
  const mine = payments.filter((p) => p.debtId === debt.id);
  const principalPaid = sum(mine, (p) => p.principal);
  const interestPaid = sum(mine, (p) => p.interest);
  const remaining = Math.max(0, round((Number(debt.startBalance) || 0) - principalPaid));
  return {
    remaining,
    principalPaid: round(principalPaid),
    interestPaid: round(interestPaid),
    totalPaid: round(sum(mine, (p) => p.total)),
    paidOff: remaining <= 0,
  };
}

// 以固定月付金額模擬還清月數；月付不足以支付利息時回傳 Infinity
export function payoffMonths(balance, apr, monthly) {
  let b = Number(balance) || 0;
  const r = (Number(apr) || 0) / 100 / 12;
  const m = Number(monthly) || 0;
  if (b <= 0) return { months: 0, interest: 0 };
  if (m <= b * r || m <= 0) return { months: Infinity, interest: Infinity };
  let months = 0;
  let interest = 0;
  while (b > 0 && months < 600) {
    const i = b * r;
    interest += i;
    b = b + i - m;
    months += 1;
  }
  return { months, interest: Math.round(interest) };
}

// 存錢目標進度
export function goalProgress(goal, deposits, today = new Date()) {
  const mine = deposits.filter((d) => d.goalId === goal.id);
  const saved = round(sum(mine, (d) => (d.kind === 'withdraw' ? -d.amount : d.amount)));
  const target = Number(goal.target) || 0;
  const pct = target > 0 ? Math.min(100, Math.max(0, (saved / target) * 100)) : 0;
  let monthsLeft = null;
  let neededPerMonth = null;
  if (goal.targetDate) {
    const end = new Date(goal.targetDate);
    monthsLeft = Math.max(0, (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth()));
    const gap = Math.max(0, target - saved);
    neededPerMonth = monthsLeft > 0 ? Math.ceil(gap / monthsLeft) : gap;
  }
  return { saved, target, pct, monthsLeft, neededPerMonth };
}

// 某月份財務總覽
export function monthlySummary(data, month) {
  const tx = (data.transactions || []).filter((t) => monthOf(t.date) === month);
  const by = (type) => round(sum(tx.filter((t) => t.type === type), (t) => t.amount));
  const income = by('income');
  const essential = by('essential');
  const nonessential = by('nonessential');
  const business = by('business');
  const expenses = round(essential + nonessential + business);

  const pays = (data.debtPayments || []).filter((p) => monthOf(p.date) === month);
  const debtPaid = round(sum(pays, (p) => p.total));
  const debtInterest = round(sum(pays, (p) => p.interest));
  const debtPrincipal = round(sum(pays, (p) => p.principal));
  const debtExtra = round(sum(pays, (p) => p.extra));

  const deps = (data.deposits || []).filter((d) => monthOf(d.date) === month);
  const saved = round(sum(deps, (d) => (d.kind === 'withdraw' ? -d.amount : d.amount)));

  const debts = data.debts || [];
  const allPays = data.debtPayments || [];
  const activeDebts = debts.filter((d) => !debtStatus(d, allPays).paidOff);
  const minDue = round(sum(activeDebts, (d) => d.minPayment));
  const remainingDebt = round(sum(debts, (d) => debtStatus(d, allPays).remaining));

  const incomeByCategory = {};
  for (const t of tx.filter((t) => t.type === 'income')) {
    const c = t.category || '其他收入';
    incomeByCategory[c] = round((incomeByCategory[c] || 0) + Number(t.amount || 0));
  }

  return {
    month,
    hasData: tx.length + pays.length + deps.length > 0,
    income, essential, nonessential, business, expenses,
    debtPaid, debtInterest, debtPrincipal, debtExtra,
    saved, minDue, remainingDebt,
    // 事業淨收入 = 收入 − 事業成本（不是個人可支配金額）
    businessNet: round(income - business),
    // 可用餘額 = 收入 − 所有支出 − 本月債務還款 − 本月存入
    available: round(income - expenses - debtPaid - saved),
    incomeByCategory,
  };
}

// 必要支出月平均（近 3 個有紀錄的月份），作為緊急預備金的基準；資料不足回傳 null
export function avgEssential(data) {
  const months = {};
  for (const t of data.transactions || []) {
    if (t.type !== 'essential') continue;
    const m = monthOf(t.date);
    months[m] = (months[m] || 0) + Number(t.amount || 0);
  }
  const keys = Object.keys(months).sort().slice(-3);
  if (!keys.length) return null;
  return Math.round(sum(keys, (k) => months[k]) / keys.length);
}

export const STRATEGIES = {
  emergency: {
    name: '先建立緊急預備金',
    pros: '遇到突發支出（生病、機車維修、收入不穩）時不必再刷卡或借錢，避免債務越滾越大。',
    cons: '這段期間高利率債務的利息會繼續累積，總利息可能較多。',
    fit: '收入不固定、手邊現金少於 1 個月必要生活費時最適合。',
  },
  avalanche: {
    name: '優先還高利率債務',
    pros: '數學上總利息最少，越早還清高利率債務（例如信用卡循環），省下的錢越多。',
    cons: '若沒有預備金，一有突發支出可能又要借錢；高利率債務若金額大，成就感來得慢。',
    fit: '已有基本預備金、收入相對穩定、有信用卡循環或高利率貸款時最適合。',
  },
  balanced: {
    name: '存錢與還款並行',
    pros: '同時累積安全感與降低負債，心理壓力較平均，比較容易長期維持。',
    cons: '兩邊進度都比專注單一目標慢，總利息介於兩者之間。',
    fit: '已能穩定繳最低應繳、想兼顧存錢目標時最適合。',
  },
};

// ---------------- 每月預算 ----------------
// 預算項目分三組：固定（本月一定要付的）、變動（生活、娛樂）、事業成本
export const BUDGET_GROUPS = {
  fixed: { name: '固定', hint: '本月一定要支付的' },
  variable: { name: '變動', hint: '生活、飲食、娛樂' },
  business: { name: '事業', hint: '進貨、廣告、器材' },
};

export const budgetId = (month) => `b-${month}`;
export const prevMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const budgetFor = (data, month) => (data.budgets || []).find((b) => b.id === budgetId(month)) || null;

// 這筆支出算在哪一組：有指定預算項目就用項目的組別，否則依收支類型
export function txGroup(tx, budget) {
  const item = budget?.items?.find((i) => i.id === tx.budgetItem);
  if (item) return item.group;
  return { essential: 'fixed', nonessential: 'variable', business: 'business' }[tx.type] || null;
}

// 預算 vs 實際：每組與每個項目的實際支出
export function budgetActuals(data, month, budget = budgetFor(data, month)) {
  const out = { fixed: 0, variable: 0, business: 0, byItem: {} };
  for (const t of data.transactions || []) {
    if (monthOf(t.date) !== month || t.type === 'income') continue;
    const g = txGroup(t, budget);
    if (g) out[g] = round(out[g] + Number(t.amount || 0));
    if (t.budgetItem) out.byItem[t.budgetItem] = round((out.byItem[t.budgetItem] || 0) + Number(t.amount || 0));
  }
  return out;
}

export function budgetTotals(budget) {
  const items = budget?.items || [];
  const by = (g) => round(sum(items.filter((i) => i.group === g), (i) => i.amount));
  return { fixed: by('fixed'), variable: by('variable'), business: by('business'), all: round(sum(items, (i) => i.amount)) };
}

// 本月還沒有還款紀錄的負債最低應繳（卡費、貸款）
export function unpaidDues(data, month) {
  const pays = data.debtPayments || [];
  return (data.debts || [])
    .filter((d) => !debtStatus(d, pays).paidOff)
    .filter((d) => !pays.some((p) => p.debtId === d.id && monthOf(p.date) === month))
    .map((d) => ({ debt: d, amount: Number(d.minPayment) || 0 }));
}

// 本月可用餘額：收入 − 支出 − 已還款 − 已存入 − 還沒繳的最低應繳
export function availableBalance(data, month) {
  const m = monthlySummary(data, month);
  const due = round(sum(unpaidDues(data, month), (x) => x.amount));
  const spent = round(m.expenses + m.debtPaid);
  return {
    ...m,
    unpaidDue: due,
    afterDue: round(m.available - due),
    spendRatio: m.income > 0 ? Math.round(((spent + due) / m.income) * 100) : null,
  };
}

// 預算建議：收入扣掉固定支出、最低應繳、變動支出估計後，最多可存多少；建議先存其中六成，保留彈性
// 沒有任何支出資料可以估時，不假設支出是 0，改用收入的兩成當保守建議
export function budgetSuggestion({ income, fixed, minDue, variable }) {
  const inc = Number(income) || 0;
  const known = (Number(fixed) || 0) + (Number(variable) || 0);
  if (!known) {
    const s = Math.floor((Math.max(0, inc - (Number(minDue) || 0)) * 0.2) / 100) * 100;
    return { maxSave: null, suggested: s, estimated: false };
  }
  const room = Math.max(0, inc - known - (Number(minDue) || 0));
  return { maxSave: Math.round(room), suggested: Math.floor((room * 0.6) / 100) * 100, estimated: true };
}

// 提醒中心
export function financeReminders(data, today) {
  const month = monthOf(today);
  const day = Number(today.slice(8, 10));
  const list = [];
  for (const { debt, amount } of unpaidDues(data, month)) {
    const due = Number(debt.dueDay) || 0;
    if (!due) continue;
    if (day > due) list.push({ level: 'err', title: `${debt.name} 本月還沒記錄還款`, detail: `繳款日 ${due} 日已過，最低應繳 ${Math.round(amount).toLocaleString('zh-TW')} 元。如果已經繳了，記得到「負債」記錄。`, tab: 'debts' });
    else if (due - day <= 7) list.push({ level: 'warn', title: `${debt.name} ${due - day === 0 ? '今天' : `${due - day} 天後`}到期`, detail: `最低應繳 ${Math.round(amount).toLocaleString('zh-TW')} 元，繳款日 ${due} 日。`, tab: 'debts' });
  }
  if (!budgetFor(data, month)?.done) list.push({ level: 'info', title: '這個月的預算還沒編好', detail: '先決定收入怎麼分配，比較不會月底才發現超支。', tab: 'budget' });
  const deps = (data.deposits || []).filter((d) => monthOf(d.date) === month && d.kind !== 'withdraw');
  for (const g of data.savingsGoals || []) {
    if (Number(g.monthlyAmount) > 0 && day >= 20 && !deps.some((d) => d.goalId === g.id)) {
      list.push({ level: 'info', title: `「${g.name}」這個月還沒存`, detail: `計畫每月存 ${Number(g.monthlyAmount).toLocaleString('zh-TW')} 元。`, tab: 'savings' });
    }
  }
  const recent = (data.transactions || []).some((t) => t.date >= addDaysStr(today, -3));
  if ((data.transactions || []).length && !recent) list.push({ level: 'info', title: '已經 3 天沒有記帳', detail: '按下方的「＋」，30 秒記一筆就好。', tab: 'tx' });
  return list;
}

function addDaysStr(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

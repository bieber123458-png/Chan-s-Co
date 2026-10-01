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

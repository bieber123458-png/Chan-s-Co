import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPayment, debtStatus, monthlySummary, goalProgress, payoffMonths, financeReminders } from '../src/lib/finance.js';
import { generateDefaultPlan, pickEssentialTasks, dayOfDate, dateOfDay } from '../src/lib/plan.js';
import { CARDS } from '../src/lib/cards.js';
import { totalPoints, drawsAvailable, rangeStats } from '../src/lib/stats.js';

test('還款拆分：利息依剩餘本金估算，額外還款＝超過最低應繳部分', () => {
  const r = splitPayment({ total: 5000, remaining: 60000, apr: 15, minPayment: 2000 });
  assert.equal(r.interest, 750);
  assert.equal(r.principal, 4250);
  assert.equal(r.extra, 3000);
});

test('還款不會讓本金變負數', () => {
  const r = splitPayment({ total: 5000, remaining: 1000, apr: 0, minPayment: 500 });
  assert.equal(r.principal, 1000);
  assert.equal(r.overpay, 4000);
});

test('剩餘債務只扣本金，不扣利息', () => {
  const debt = { id: 'd1', startBalance: 50000 };
  const pays = [{ debtId: 'd1', total: 3000, principal: 2400, interest: 600 }, { debtId: 'x', total: 999, principal: 999, interest: 0 }];
  const st = debtStatus(debt, pays);
  assert.equal(st.remaining, 47600);
  assert.equal(st.interestPaid, 600);
});

test('月結：還款不重複算進支出，存入不算支出', () => {
  const data = {
    transactions: [
      { date: '2026-10-02', type: 'income', amount: 40000, category: '零售收入' },
      { date: '2026-10-03', type: 'essential', amount: 15000 },
      { date: '2026-10-04', type: 'business', amount: 5000 },
      { date: '2026-09-30', type: 'income', amount: 99999 },
    ],
    debtPayments: [{ date: '2026-10-05', debtId: 'd1', total: 3000, principal: 2500, interest: 500, extra: 1000 }],
    deposits: [{ date: '2026-10-06', goalId: 'g', amount: 4000 }, { date: '2026-10-07', goalId: 'g', amount: 1000, kind: 'withdraw' }],
    debts: [{ id: 'd1', startBalance: 20000, minPayment: 2000 }],
  };
  const m = monthlySummary(data, '2026-10');
  assert.equal(m.income, 40000);
  assert.equal(m.expenses, 20000);
  assert.equal(m.debtPaid, 3000);
  assert.equal(m.saved, 3000);
  assert.equal(m.available, 40000 - 20000 - 3000 - 3000);
  assert.equal(m.businessNet, 35000);
  assert.equal(m.remainingDebt, 17500);
  assert.equal(m.minDue, 2000);
});

test('存錢進度與每月需存金額', () => {
  const p = goalProgress({ id: 'g', target: 30000, targetDate: '2027-04-01' }, [{ goalId: 'g', amount: 6000 }], new Date(2026, 9, 1));
  assert.equal(p.saved, 6000);
  assert.equal(p.monthsLeft, 6);
  assert.equal(p.neededPerMonth, 4000);
});

test('月付不足以支付利息時判定無法還清', () => {
  assert.equal(payoffMonths(100000, 15, 1000).months, Infinity);
  assert.ok(payoffMonths(100000, 15, 5000).months > 20);
});

test('每月計畫：依月份天數產生，每週 3 支 Reels 與 2 篇輪播，月底有覆盤', async () => {
  const { generateMonthPlan } = await import('../src/lib/plan.js');
  const plan = generateMonthPlan({ start: '2026-10-15', length: 31, monthIndex: 0 });
  assert.ok(plan.every((t) => t.date >= '2026-10-15' && t.date <= '2026-11-14'));
  const week1 = plan.filter((t) => t.date <= '2026-10-21');
  assert.equal(week1.filter((t) => t.title.startsWith('發布 Reels')).length, 3);
  assert.equal(week1.filter((t) => t.title.startsWith('發布輪播')).length, 2);
  assert.ok(plan.some((t) => t.date === '2026-11-14' && t.title.startsWith('本月覆盤')));
  assert.equal(new Set(plan.map((t) => t.id)).size, plan.length);
  const m2 = generateMonthPlan({ start: '2026-11-15', length: 30, monthIndex: 1 });
  assert.ok(!m2.some((t) => t.title.startsWith('簡介補一行')), '第一個月才有的任務不重複');
  assert.notEqual(m2.find((t) => t.title.startsWith('發布 Reels')).title, plan.find((t) => t.title.startsWith('發布 Reels')).title, '主題每月輪替');
  assert.ok(m2.every((t) => !plan.some((p) => p.id === t.id)), '不同月份的任務編號不重複');
});

test('沒動力模式最多 3 個任務，且包含一個最重要的任務', () => {
  const tasks = generateDefaultPlan('2026-10-01').filter((t) => t.day === 1);
  const picked = pickEssentialTasks(tasks);
  assert.ok(picked.length <= 3 && picked.length >= 1);
  assert.equal(picked[0].priority, 'high');
});

test('月份週期：從開始日起算一個月，月底自動調整', async () => {
  const { cycleOf, cycleRange, addMonths } = await import('../src/lib/plan.js');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.deepEqual(cycleRange('2026-10-15', 0), { index: 0, start: '2026-10-15', end: '2026-11-14', length: 31 });
  assert.equal(cycleOf('2026-10-15', '2026-11-14').day, 31);
  assert.equal(cycleOf('2026-10-15', '2026-11-15').index, 1);
  assert.equal(cycleOf('2026-10-15', '2027-03-20').index, 5);
  assert.equal(cycleOf('2026-10-15', '2026-10-01').index, -1);
});

test('日期換算', () => {
  assert.equal(dayOfDate('2026-10-01', '2026-10-01'), 1);
  assert.equal(dayOfDate('2026-10-01', '2026-10-30'), 30);
  assert.equal(dateOfDay('2026-10-01', 30), '2026-10-30');
});

test('鼓勵卡至少 60 張且四類齊全', () => {
  assert.ok(CARDS.length >= 60);
  assert.equal(new Set(CARDS.map((c) => c.type)).size, 4);
});

test('積分只增不扣；抽卡次數依積分計算', () => {
  const tasks = [{ done: true, points: 15 }, { done: true, points: 15 }, { done: false, points: 10 }];
  assert.equal(totalPoints(tasks), 30);
  assert.equal(drawsAvailable(tasks, []), 1);
  assert.equal(drawsAvailable(tasks, [{}]), 0);
});

test('覆盤統計會標示資料不足', () => {
  const s = rangeStats({ tasks: [], posts: [] }, { startDate: '2026-10-01' }, '2026-10-01', '2026-10-07');
  assert.ok(s.missing.includes('沒有收支紀錄'));
  assert.equal(s.tasks.rate, null);
});

test('週覆盤不把未來的任務算成未完成', () => {
  const data = { tasks: [{ day: 1, category: 'ig', done: true, points: 15 }, { day: 5, category: 'ig', done: false, points: 10 }] };
  const s = rangeStats(data, { startDate: '2026-10-01' }, '2026-10-01', '2026-10-07', '2026-10-02');
  assert.equal(s.tasks.total, 1);
  assert.equal(s.tasks.rate, 100);
});

test('IG 帳號會從網址中取出並去掉追蹤參數', async () => {
  const { cleanIgHandle } = await import('../src/lib/stats.js');
  assert.equal(cleanIgHandle('https://www.instagram.com/chan1201_?stkn=abc&utm_source=qr'), 'chan1201_');
  assert.equal(cleanIgHandle('@chan1201_'), 'chan1201_');
});

test('套用新版計畫：保留已完成、有紀錄與過去的任務', async () => {
  const { planUpgrade, cycleRange } = await import('../src/lib/plan.js');
  const cycle = cycleRange('2026-10-01', 0);
  const old = [
    { id: 'a', date: '2026-10-01', title: 'x', done: false },
    { id: 'b', date: '2026-10-05', title: 'y', done: true },
    { id: 'c', date: '2026-10-05', title: 'z', done: false, result: '拍好了' },
    { id: 'd', date: '2026-10-06', title: 'w', done: false },
    { id: 'e', day: 7, title: '舊資料', done: false },
  ];
  const r = planUpgrade(old, '2026-10-05', cycle, '2026-10-01');
  assert.deepEqual(r.removeIds, ['d', 'e']);
  assert.ok(r.add.every((t) => t.date >= '2026-10-05' && t.date <= cycle.end));
  assert.ok(r.add.some((t) => t.title.includes('互動貼紙')));
});

test('套用新版計畫：同一天已完成的發布任務不重複新增', async () => {
  const { planUpgrade, cycleRange } = await import('../src/lib/plan.js');
  const r = planUpgrade([{ id: 'r', date: '2026-10-01', title: '發布 Reels：舊主題', done: true }], '2026-10-01', cycleRange('2026-10-01', 0), '2026-10-01');
  assert.equal(r.add.filter((t) => t.date === '2026-10-01' && t.title.startsWith('發布 Reels')).length, 0);
});

test('輪播結構：頁數限制 5～10，含封面、總結與行動頁', async () => {
  const { buildCarousel } = await import('../src/lib/copy.js');
  const p = buildCarousel(7, 'mistake');
  assert.equal(p.length, 7);
  assert.equal(p[0].role, '封面');
  assert.equal(p[6].role, '行動頁');
  assert.equal(buildCarousel(3, 'teach').length, 5);
  assert.equal(buildCarousel(20, 'teach').length, 10);
});

test('限動成效：完成率、互動率、觸及粉絲比例', async () => {
  const { storyMetrics } = await import('../src/lib/copy.js');
  const m = storyMetrics({ firstViews: 800, lastViews: 600, interactions: 30, replies: 10 }, 8000);
  assert.equal(m.completion, 75);
  assert.equal(m.engagement, 5);
  assert.equal(m.reachRate, 10);
  assert.equal(storyMetrics({ firstViews: 500, lastViews: '' }, null).completion, null);
});

test('可用餘額會先扣掉本月還沒繳的最低應繳', async () => {
  const { availableBalance, financeReminders, budgetActuals, budgetSuggestion } = await import('../src/lib/finance.js');
  const data = {
    transactions: [
      { date: '2026-10-01', type: 'income', amount: 42000 },
      { date: '2026-10-02', type: 'essential', amount: 13000, budgetItem: 'rent' },
      { date: '2026-10-03', type: 'nonessential', amount: 2000 },
    ],
    debts: [{ id: 'c1', name: '信用卡 A', startBalance: 30000, minPayment: 3000, dueDay: 10 }, { id: 'c2', name: '信貸', startBalance: 50000, minPayment: 5000, dueDay: 1 }],
    debtPayments: [{ debtId: 'c2', date: '2026-10-01', total: 5000, principal: 4500, interest: 500 }],
    deposits: [], savingsGoals: [],
    budgets: [{ id: 'b-2026-10', items: [{ id: 'rent', name: '房租', group: 'fixed', amount: 13000 }] }],
  };
  const a = availableBalance(data, '2026-10');
  assert.equal(a.unpaidDue, 3000);
  assert.equal(a.afterDue, 42000 - 15000 - 5000 - 3000);
  const act = budgetActuals(data, '2026-10');
  assert.equal(act.fixed, 13000);
  assert.equal(act.variable, 2000);
  assert.equal(act.byItem.rent, 13000);
  const r = financeReminders(data, '2026-10-05');
  assert.ok(r.some((x) => x.title.includes('信用卡 A') && x.level === 'warn'));
  assert.ok(!r.some((x) => x.title.includes('信貸')));
  assert.ok(financeReminders(data, '2026-10-12').some((x) => x.level === 'err'));
  assert.deepEqual(budgetSuggestion({ income: 42000, fixed: 16800, minDue: 3000, variable: 9600 }), { maxSave: 12600, suggested: 7500, estimated: true });
  assert.equal(budgetSuggestion({ income: 42000, fixed: 0, minDue: 3000, variable: 0 }).suggested, 7800, '沒有支出資料時用保守的兩成');
});

test('財務診斷：找出超支項目、衝動消費，並調整下月預算', async () => {
  const { diagnoseMonth } = await import('../src/lib/finance.js');
  const data = {
    transactions: [
      { date: '2026-08-01', type: 'income', amount: 42000 },
      { date: '2026-08-02', type: 'essential', amount: 4800, budgetItem: 'ins' },
      { date: '2026-08-03', type: 'nonessential', group: 'variable', amount: 3000, impulse: true },
      { date: '2026-08-04', type: 'essential', group: 'variable', amount: 6000 },
    ],
    deposits: [{ date: '2026-08-05', goalId: 'g', amount: 4000 }],
    debts: [], debtPayments: [], savingsGoals: [],
    budgets: [{ id: 'b-2026-08', saving: 8000, items: [{ id: 'ins', name: '保險', group: 'fixed', amount: 1200 }, { id: 'food', name: '餐費', group: 'variable', amount: 7000 }] }],
  };
  const d = diagnoseMonth(data, '2026-08');
  assert.match(d.headline, /沒有全部完成/);
  assert.ok(d.attention.some((x) => x.title.includes('保險') && x.title.includes('3,600')));
  assert.ok(d.attention.some((x) => x.title.includes('衝動消費')));
  assert.ok(d.attention.some((x) => x.title.includes('儲蓄還差 $4,000')));
  assert.ok(d.detail.some((x) => x.includes('低於預算 $1,000')));
  assert.equal(d.nextItems.find((i) => i.name === '保險').amount, 4800);
  assert.equal(d.nextItems.find((i) => i.name === '餐費').amount, 7000);
});

test('帳戶、信用卡帳單、分期與帳目歸屬', async () => {
  const { accountBalance, cardStatement, splitInstallments, scoped, savingSplit } = await import('../src/lib/finance.js');
  const card = { id: 'ca', kind: 'credit', closingDay: 5, dueDay: 20, initialBalance: 0 };
  const bank = { id: 'bk', kind: 'bank', initialBalance: 50000 };
  const data = {
    accounts: [card, bank],
    transactions: [
      { date: '2026-09-28', type: 'essential', amount: 1000, accountId: 'ca' },
      { date: '2026-10-08', type: 'nonessential', amount: 500, accountId: 'ca' },
      { date: '2026-10-01', type: 'income', amount: 30000, accountId: 'bk', owner: 'business' },
    ],
    transfers: [{ date: '2026-10-09', from: 'bk', to: 'ca', amount: 400 }],
    savingsGoals: [{ id: 'g1' }, { id: 'g2', isSinking: true }],
    deposits: [{ date: '2026-10-02', goalId: 'g1', amount: 3000 }, { date: '2026-10-03', goalId: 'g2', amount: 1200 }],
  };
  assert.equal(accountBalance(card, data), 1100);
  assert.equal(accountBalance(bank, data), 50000 + 30000 - 400);
  const st = cardStatement(card, data, '2026-10-12');
  assert.equal(st.lastClose, '2026-10-05');
  assert.equal(st.due, 600);
  assert.equal(st.unbilled, 500);
  assert.equal(st.dueDate, '2026-10-20');
  const parts = splitInstallments({ id: 'x', date: '2026-01-31', amount: 1000, type: 'nonessential' }, 3);
  assert.deepEqual(parts.map((p) => p.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(parts.reduce((a, p) => a + p.amount, 0), 1000);
  assert.equal(scoped(data, 'business').transactions.length, 1);
  assert.equal(scoped(data, 'personal').transactions.length, 2);
  assert.deepEqual(savingSplit(data, '2026-10'), { saving: 3000, sinking: 1200 });
});

test('信用卡卡費到期會出現在提醒中心', () => {
  const data = {
    transactions: [{ id: 't1', date: '2026-09-10', type: 'essential', amount: 3000, accountId: 'c1' }],
    accounts: [{ id: 'c1', name: '國泰卡', kind: 'credit', initialBalance: 0, closingDay: 20, dueDay: 5 }],
    transfers: [], debts: [], debtPayments: [], savingsGoals: [], deposits: [], budgets: [],
  };
  const list = financeReminders(data, '2026-10-02');
  const r = list.find((x) => x.tab === 'cards');
  assert.ok(r, '應該有卡費提醒');
  assert.equal(r.level, 'warn');
  assert.match(r.title, /3 天後/);
  data.transfers.push({ id: 'p1', date: '2026-10-01', from: 'b1', to: 'c1', amount: 3000 });
  assert.ok(!financeReminders(data, '2026-10-02').some((x) => x.tab === 'cards'), '繳完就不提醒');
});

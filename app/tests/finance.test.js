import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPayment, debtStatus, monthlySummary, goalProgress, payoffMonths } from '../src/lib/finance.js';
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

test('預設計畫：30 天、每週 3 支 Reels 與 2 篇輪播', () => {
  const plan = generateDefaultPlan();
  assert.ok(plan.every((t) => t.day >= 1 && t.day <= 30));
  const week1 = plan.filter((t) => t.day <= 7);
  assert.equal(week1.filter((t) => t.title.startsWith('發布 Reels')).length, 3);
  assert.equal(week1.filter((t) => t.title.startsWith('發布輪播')).length, 2);
  assert.equal(new Set(plan.map((t) => t.id)).size, plan.length);
});

test('沒動力模式最多 3 個任務，且包含一個最重要的任務', () => {
  const tasks = generateDefaultPlan().filter((t) => t.day === 1);
  const picked = pickEssentialTasks(tasks);
  assert.ok(picked.length <= 3 && picked.length >= 1);
  assert.equal(picked[0].priority, 'high');
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

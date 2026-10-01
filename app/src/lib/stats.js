// 統計與覆盤（前後端共用）。只使用已記錄的資料，不足時明確列出。
import { CATEGORIES, dateOfDay, toDateStr } from './plan.js';
import { round, sum, debtStatus } from './finance.js';

export const POINTS_PER_DRAW = 30;

// 取出 IG 帳號名稱（可貼網址或 @帳號），去掉網址參數
export const cleanIgHandle = (v) => String(v || '').trim()
  .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0];

export const DEFAULT_SETTINGS = {
  id: 'main',
  displayName: '小陳',
  startDate: '',
  goals: '',
  monthlyIncomeGoal: 150000,
  teamGoal: 150,
  monthlyContentGoal: 20,
  emergencyMonths: 3,
  strategy: 'balanced',
  extraDebtPayment: 0,
  igHandle: 'chan1201_',
  igPositioning: '闆闆小陳：美業霧唇師，分享美業經營方法與工具，也記錄自己 72→57kg 的減脂飲食日常。主要受眾是想把經營變簡單的美業人，以及正在減脂、想吃得開心的女生。',
};

export const taskPoints = (task) => (task.done ? Number(task.points) || 0 : 0);
export const totalPoints = (tasks) => sum(tasks, taskPoints);
export const drawsAvailable = (tasks, draws) =>
  Math.max(0, Math.floor(totalPoints(tasks) / POINTS_PER_DRAW) - draws.length);

const inRange = (date, from, to) => date >= from && date <= to;

export function rangeStats(data, settings, from, to, today = toDateStr()) {
  const start = settings.startDate;
  // 任務完成率只計算「已經到來」的日子，未來的任務不算未完成
  const taskTo = to < today ? to : today;
  const tasks = start
    ? (data.tasks || []).filter((x) => inRange(dateOfDay(start, x.day), from, taskTo))
    : [];
  const done = tasks.filter((x) => x.done);
  const byCategory = {};
  for (const [k, c] of Object.entries(CATEGORIES)) {
    const list = tasks.filter((x) => x.category === k);
    byCategory[k] = { name: c.name, total: list.length, done: list.filter((x) => x.done).length };
  }

  const posts = (data.posts || []).filter((p) => inRange(p.date, from, to));
  const metric = (k) => sum(posts, (p) => p[k]);
  const withViews = posts.filter((p) => p.views !== '' && p.views != null);
  const best = withViews.length ? [...withViews].sort((a, b) => b.views - a.views)[0] : null;

  const tx = (data.transactions || []).filter((x) => inRange(x.date, from, to));
  const txSum = (type) => round(sum(tx.filter((x) => x.type === type), (x) => x.amount));
  const pays = (data.debtPayments || []).filter((x) => inRange(x.date, from, to));
  const deps = (data.deposits || []).filter((x) => inRange(x.date, from, to));

  const orders = (data.orders || []).filter((o) => inRange(o.date, from, to));
  const snaps = [...(data.teamSnapshots || [])].sort((a, b) => a.date.localeCompare(b.date));
  const snapsIn = snaps.filter((s) => inRange(s.date, from, to));
  const before = snaps.filter((s) => s.date < from).pop();
  const lastSnap = snapsIn[snapsIn.length - 1] || null;
  const baseSnap = before || snapsIn[0] || null;
  const followups = (data.teamFollowups || []).filter((f) => inRange(f.date, from, to));
  const habits = (data.habits || []).filter((h) => inRange(h.id, from, to));

  const income = txSum('income');
  const expenses = round(txSum('essential') + txSum('nonessential') + txSum('business'));

  const missing = [];
  if (!start) missing.push('尚未設定計畫開始日期，無法計算任務完成率');
  else if (from > today) missing.push('這段期間還沒開始');
  if (!posts.length) missing.push('這段期間沒有 IG 內容紀錄');
  else if (!withViews.length) missing.push('IG 內容沒有填寫觀看數，無法比較表現');
  if (!tx.length) missing.push('沒有收支紀錄');
  if (!orders.length) missing.push('沒有零售訂單紀錄');
  if (!snapsIn.length) missing.push('沒有團隊人數紀錄');
  if (!habits.length) missing.push('沒有習慣紀錄');

  return {
    from, to, taskTo,
    tasks: {
      total: tasks.length, done: done.length,
      rate: tasks.length ? Math.round((done.length / tasks.length) * 100) : null,
      points: totalPoints(tasks),
      minutes: sum(done, (x) => x.minutes),
      byCategory,
      reflections: done.filter((x) => x.reflection || x.result).map((x) => ({ title: x.title, result: x.result, reflection: x.reflection })),
    },
    content: {
      count: posts.length,
      reels: posts.filter((p) => p.format === 'Reels').length,
      carousel: posts.filter((p) => p.format === '輪播').length,
      views: metric('views'), reach: metric('reach'), shares: metric('shares'),
      saves: metric('saves'), follows: metric('follows'), leads: metric('leads'),
      best: best ? { title: best.title, views: best.views, format: best.format } : null,
    },
    finance: {
      hasData: tx.length + pays.length + deps.length > 0,
      income, expenses,
      business: txSum('business'),
      nonessential: txSum('nonessential'),
      debtPaid: round(sum(pays, (p) => p.total)),
      debtPrincipal: round(sum(pays, (p) => p.principal)),
      debtInterest: round(sum(pays, (p) => p.interest)),
      saved: round(sum(deps, (d) => (d.kind === 'withdraw' ? -d.amount : d.amount))),
      remainingDebt: round(sum(data.debts || [], (d) => debtStatus(d, data.debtPayments || []).remaining)),
    },
    retail: {
      count: orders.length,
      revenue: round(sum(orders, (o) => o.revenue)),
      cost: round(sum(orders, (o) => o.cost)),
      gross: round(sum(orders, (o) => o.revenue) - sum(orders, (o) => o.cost)),
    },
    team: {
      hasData: !!lastSnap,
      total: lastSnap ? Number(lastSnap.total) : null,
      active: lastSnap ? Number(lastSnap.active) : null,
      change: lastSnap && baseSnap && baseSnap !== lastSnap ? Number(lastSnap.total) - Number(baseSnap.total) : null,
      newMembers: sum(snapsIn, (s) => s.newMembers),
      trainings: sum(snapsIn, (s) => s.trainings),
      followups: followups.length,
    },
    habits: {
      days: habits.length,
      exerciseDays: habits.filter((h) => Number(h.exercise) > 0).length,
      avgSleep: habits.filter((h) => h.sleep).length
        ? round(sum(habits, (h) => h.sleep) / habits.filter((h) => h.sleep).length) : null,
    },
    missing,
  };
}

// 不靠 AI，只根據數字整理「做得好的事 / 主要問題」，避免編造
export function ruleBasedReview(s) {
  const good = [];
  const issues = [];
  if (s.tasks.total) {
    if (s.tasks.rate >= 70) good.push(`任務完成率 ${s.tasks.rate}%，節奏穩定。`);
    else if (s.tasks.done > 0) good.push(`完成了 ${s.tasks.done} 個任務，即使不完美也有在前進。`);
    const cats = Object.values(s.tasks.byCategory).filter((c) => c.total);
    const weak = cats.filter((c) => c.total >= 2 && c.done / c.total < 0.4);
    if (weak.length) issues.push(`完成率較低的類別：${weak.map((c) => c.name).join('、')}。不是做得不好，可以檢查是任務太大，還是時間被其他事情占走，必要時把任務拆小或移到別天。`);
  }
  if (s.content.count) good.push(`發布了 ${s.content.count} 篇內容（Reels ${s.content.reels}、輪播 ${s.content.carousel}）。`);
  if (s.content.best) good.push(`觀看最高的是「${s.content.best.title}」（${s.content.best.views} 次觀看），值得拆解它的開頭與主題。`);
  if (s.finance.saved > 0) good.push(`這段期間存入 ${s.finance.saved.toLocaleString()} 元。`);
  if (s.finance.debtPrincipal > 0) good.push(`還掉本金 ${s.finance.debtPrincipal.toLocaleString()} 元。`);
  if (s.finance.hasData && s.finance.income > 0 && s.finance.nonessential > s.finance.income * 0.2) {
    issues.push('非必要支出超過收入的 20%，可以挑一項最容易減少的先調整。');
  }
  if (s.retail.count && s.retail.gross < 0) issues.push('零售毛利為負，請檢查成本或折扣是否記錄正確。');
  return { good, issues };
}

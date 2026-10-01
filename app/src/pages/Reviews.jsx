import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Chips, Stat, Field, Progress } from '../components/ui.jsx';
import { AiNotice, AiPanel } from '../components/AiPanel.jsx';
import { rangeStats, ruleBasedReview } from '../lib/stats.js';
import { addDays, cycleOf, cycleRange, toDateStr } from '../lib/plan.js';
import { fmtMoney, fmtNum, fmtPct, fmtShortDate } from '../lib/format.js';

function Missing({ list }) {
  if (!list.length) return null;
  return (
    <div className="notice warn small">
      <strong>資料不足之處：</strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{list.map((m) => <li key={m}>{m}</li>)}</ul>
      以下統計只根據已記錄的資料，沒有紀錄的部分不會自行推測。
    </div>
  );
}

function StatsView({ s }) {
  const { good, issues } = ruleBasedReview(s);
  return (
    <>
      <Missing list={s.missing} />
      <div className="grid grid-3 mb">
        <Stat label="任務完成率" value={fmtPct(s.tasks.rate)} sub={`${s.tasks.done}／${s.tasks.total} 個・${s.tasks.points} 分`} />
        <Stat label="內容產出" value={`${s.content.count} 篇`} sub={`Reels ${s.content.reels}・輪播 ${s.content.carousel}`} />
        <Stat label="粉絲數" value={s.content.followers === null ? '無紀錄' : fmtNum(s.content.followers)} sub={s.content.followerChange === null ? '需要期間前後兩筆紀錄才能比較' : `變化 ${s.content.followerChange >= 0 ? '+' : ''}${fmtNum(s.content.followerChange)}`} />
        <Stat label="IG 觀看／新增追蹤" value={fmtNum(s.content.views)} sub={`追蹤 +${fmtNum(s.content.follows)}・分享 ${fmtNum(s.content.shares)}・收藏 ${fmtNum(s.content.saves)}`} />
        <Stat label="零售毛利" value={fmtMoney(s.retail.gross)} sub={`${s.retail.count} 筆訂單・營收 ${fmtMoney(s.retail.revenue)}`} />
        <Stat label="收入／支出" value={fmtMoney(s.finance.income)} sub={`支出 ${fmtMoney(s.finance.expenses)}`} />
        <Stat label="儲蓄／還款" value={fmtMoney(s.finance.saved)} sub={`還款 ${fmtMoney(s.finance.debtPaid)}（本金 ${fmtMoney(s.finance.debtPrincipal)}）`} />
        <Stat label="團隊" value={s.team.hasData ? `${s.team.total} 人` : '無紀錄'} sub={s.team.hasData ? `活躍 ${s.team.active}${s.team.change !== null ? `・變化 ${s.team.change >= 0 ? '+' : ''}${s.team.change}` : ''}・跟進 ${s.team.followups} 次` : `跟進 ${s.team.followups} 次`} />
        <Stat label="習慣紀錄" value={`${s.habits.days} 天`} sub={`運動 ${s.habits.exerciseDays} 天・平均睡眠 ${s.habits.avgSleep ?? '—'} 時`} />
      </div>
      <div className="grid grid-2">
        <Card title="各類別完成率">
          {Object.values(s.tasks.byCategory).map((c) => (
            <div key={c.name} className="bar-row"><span>{c.name}</span><Progress value={c.total ? (c.done / c.total) * 100 : 0} /><span className="right tiny">{c.done}／{c.total}</span></div>
          ))}
        </Card>
        <Card title="系統整理（依數字，不含 AI）">
          <div className="small"><strong>做得好的事</strong></div>
          {good.length ? <ul className="small">{good.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="small muted">紀錄還不夠，暫時看不出來。</p>}
          <div className="small mt"><strong>主要問題</strong></div>
          {issues.length ? <ul className="small">{issues.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="small muted">從已記錄的資料中沒有發現明顯問題。</p>}
        </Card>
      </div>
      {s.tasks.reflections.length > 0 && (
        <Card title="這段期間的心得紀錄">
          {s.tasks.reflections.slice(0, 12).map((r, i) => (
            <div key={i} className="list-item small"><strong>{r.title}</strong>{r.result && <div>結果：{r.result}</div>}{r.reflection && <div className="muted">心得：{r.reflection}</div>}</div>
          ))}
        </Card>
      )}
    </>
  );
}

// 選擇第幾個月（從開始日起算）
function useMonthPicker() {
  const { settings } = useStore();
  const start = settings.startDate;
  const cur = start ? cycleOf(start, toDateStr()) : null;
  const [idx, setIdx] = useState(Math.max(0, cur?.index ?? 0));
  const range = start ? cycleRange(start, idx) : null;
  const picker = start ? (
    <div className="row mb">
      <button className="btn ghost sm" disabled={idx <= 0} onClick={() => setIdx(idx - 1)}>‹ 上個月</button>
      <strong>第 {idx + 1} 個月</strong><span className="small muted">{fmtShortDate(range.start)}～{fmtShortDate(range.end)}</span>
      <button className="btn ghost sm" disabled={idx >= Math.max(0, cur.index)} onClick={() => setIdx(idx + 1)}>下個月 ›</button>
    </div>
  ) : <div className="notice warn small">尚未設定計畫開始日期，以下以最近的日期計算。</div>;
  return { idx, range, picker, cur };
}

function Weekly() {
  const { data, settings } = useStore();
  const { range, picker, idx } = useMonthPicker();
  const today = toDateStr();
  const weeks = range ? Math.ceil(range.length / 7) : 1;
  const curWeek = range && today >= range.start && today <= range.end ? Math.ceil((cycleOf(settings.startDate, today).day) / 7) : 1;
  const [weekSel, setWeek] = useState(curWeek);
  const week = Math.min(weekSel, weeks);
  const from = range ? addDays(range.start, (week - 1) * 7) : addDays(today, -6);
  const to = range ? (addDays(from, 6) < range.end ? addDays(from, 6) : range.end) : today;
  const s = useMemo(() => rangeStats(data, settings, from, to), [data, settings, from, to]);

  return (
    <>
      {picker}
      <div className="mb"><Chips value={String(week)} onChange={(k) => setWeek(Number(k))} options={Array.from({ length: weeks }, (_, i) => [String(i + 1), `第 ${i + 1} 週`])} /></div>
      <p className="small muted mb">期間：{fmtShortDate(from)} ～ {fmtShortDate(to)}{s.taskTo < to && s.taskTo >= from ? `（任務完成率計算到今天 ${fmtShortDate(s.taskTo)}）` : ''}</p>
      <StatsView s={s} />
      <Card title="AI 每週覆盤與下週建議">
        <AiPanel kind="weekly" refId={`week-${from}`} label="生成本週覆盤" buildBody={(x) => ({ stats: s, input: x, summary: `第 ${idx + 1} 個月第 ${week} 週覆盤` })}
          inputPlaceholder="（選填）這週你自己的感受或想補充的事" />
      </Card>
    </>
  );
}

function Monthly() {
  const { data, settings } = useStore();
  const { range, picker, idx } = useMonthPicker();
  const today = toDateStr();
  const from = range ? range.start : `${today.slice(0, 7)}-01`;
  const to = range ? range.end : today;
  const month = `第 ${idx + 1} 個月`;
  const s = useMemo(() => rangeStats(data, settings, from, to), [data, settings, from, to]);
  const savingsPlan = data.savingsGoals.reduce((a, g) => a + (Number(g.monthlyAmount) || 0), 0);
  const rows = [
    ['月收入', settings.monthlyIncomeGoal, s.finance.hasData ? s.finance.income : null, fmtMoney],
    ['團隊人數', settings.teamGoal, s.team.total, (v) => `${v} 人`],
    ['內容篇數', settings.monthlyContentGoal, s.content.count, (v) => `${v} 篇`],
    ['存錢', savingsPlan || null, s.finance.hasData ? s.finance.saved : null, fmtMoney],
  ];

  return (
    <>
      {picker}
      <Card title="目標與實際">
        <div className="table-wrap"><table>
          <thead><tr><th>項目</th><th className="num">目標</th><th className="num">實際</th><th className="num">差距</th><th style={{ width: '30%' }}>達成</th></tr></thead>
          <tbody>{rows.map(([name, goal, actual, f]) => (
            <tr key={name}>
              <td>{name}</td>
              <td className="num">{goal ? f(goal) : '未設定'}</td>
              <td className="num">{actual === null || actual === undefined ? <span className="tag warn">資料不足</span> : f(actual)}</td>
              <td className="num">{goal && actual !== null && actual !== undefined ? (actual >= goal ? '已達成' : f(goal - actual)) : '—'}</td>
              <td>{goal && actual !== null && actual !== undefined ? <Progress value={(actual / goal) * 100} /> : null}</td>
            </tr>))}
          </tbody></table></div>
        <p className="tiny muted mt">月收入以「收支紀錄」中的收入計算；營收不等於利潤。存錢目標為各存錢目標「每月預計存入」的加總。</p>
      </Card>
      <StatsView s={s} />
      <Card title="AI 每月覆盤與調整建議">
        <AiPanel kind="monthly" refId={`month-${from}`} label="生成本月覆盤" buildBody={(x) => ({ stats: { ...s, goals: Object.fromEntries(rows.map(([n, g, a]) => [n, { goal: g, actual: a }])) }, input: x, summary: `${month}覆盤（${from}～${to}）` })}
          inputPlaceholder="（選填）這個月你自己的感受或想補充的事" />
      </Card>
    </>
  );
}

export default function Reviews() {
  const [tab, setTab] = useState('weekly');
  return (
    <>
      <PageHead eyebrow="REVIEW" title="每週／每月覆盤" desc="根據已記錄的資料自動整理；沒有記錄的部分會清楚標示，不會編造。" />
      <AiNotice />
      <div className="mb"><Chips value={tab} onChange={setTab} options={[['weekly', '每週覆盤'], ['monthly', '每月覆盤']]} /></div>
      {tab === 'weekly' ? <Weekly /> : <Monthly />}
    </>
  );
}

import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Stat, Progress, Empty, Field } from '../components/ui.jsx';
import TaskItem from '../components/TaskItem.jsx';
import TaskEditor from '../components/TaskEditor.jsx';
import { AiNotice, AiPanel } from '../components/AiPanel.jsx';
import { CATEGORIES, addDays, cycleOf, cycleRange, taskDate, toDateStr, generateMonthPlan, pickEssentialTasks } from '../lib/plan.js';
import { totalPoints, drawsAvailable } from '../lib/stats.js';
import { fmtDate, fmtShortDate } from '../lib/format.js';

// 建立某一個月的預設計畫（只有那個月還沒有任務時才會用到）
import Todos from '../components/Todos.jsx';

export function useCreateMonthPlan() {
  const { saveMany, toast } = useStore();
  return async (cycle) => {
    const saved = await saveMany('tasks', generateMonthPlan({ start: cycle.start, length: cycle.length, monthIndex: cycle.index }));
    if (saved) toast(`已建立第 ${cycle.index + 1} 個月的計畫（${saved.length} 個任務），都可以修改`, 'success');
    return saved;
  };
}

function Setup() {
  const { saveSettings, settings, data, toast } = useStore();
  const createPlan = useCreateMonthPlan();
  const [startDate, setStartDate] = useState(settings.startDate || toDateStr());
  const [goals, setGoals] = useState(settings.goals || '');
  const [busy, setBusy] = useState(false);
  const hasTasks = data.tasks.length > 0;

  const start = async (withPlan) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) { toast('請選擇開始日期', 'error'); return; }
    setBusy(true);
    const ok = await saveSettings({ startDate, goals }, { silent: true });
    if (ok && withPlan && !hasTasks) await createPlan(cycleRange(startDate, 0));
    else if (ok) toast('已設定開始日期', 'success');
    setBusy(false);
  };

  return (
    <Card title="開始你的每月計畫">
      <p className="muted small mb">從你選的開始日起算一個月（例如 10/15～11/14），月底再建立下個月的計畫。預設計畫只是起點：每週 3 支 Reels、2 篇輪播、每天限動互動，加上零售、團隊、財務與生活任務，全部都可以修改。</p>
      <div className="form-grid">
        <Field label="第一個月從哪天開始"><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="這個月最想達成的事" full hint="AI 會參考這段文字給建議，例如：穩定每週發 5 篇內容、存到 3 萬緊急預備金、團隊新增 5 位活躍夥伴">
          <textarea className="input" rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} />
        </Field>
      </div>
      <div className="row">
        {!hasTasks && <button className="btn" disabled={busy} onClick={() => start(true)}>{busy ? <span className="spinner" /> : null}建立第一個月計畫</button>}
        <button className="btn ghost" disabled={busy} onClick={() => start(false)}>{hasTasks ? '儲存開始日期' : '從空白計畫開始'}</button>
      </div>
    </Card>
  );
}

function DailyReview({ date }) {
  const { data, save, settings } = useStore();
  const id = `d-${date}`;
  const log = data.dayLogs.find((d) => d.id === id) || { id, date };
  const [mood, setMood] = useState(log.mood || '');
  const [blockers, setBlockers] = useState(log.blockers || '');
  const tasks = data.tasks.filter((t) => taskDate(t, settings.startDate) === date);
  const done = tasks.filter((t) => t.done);

  return (
    <Card title="今日覆盤" action={<span className="tiny muted">完成 {done.length}／{tasks.length}</span>}>
      <p className="small muted mb">漏做的任務不會扣分，也不需要重新開始。誠實記錄卡在哪裡，明天才知道怎麼調整。</p>
      {done.length > 0 && (
        <div className="mb small"><strong>今天完成：</strong>{done.map((t) => t.title).join('、')}</div>
      )}
      <div className="form-grid">
        <Field label="今天的心情與狀態"><input className="input" placeholder="例如：有點累但很踏實" value={mood} onChange={(e) => setMood(e.target.value)} /></Field>
        <Field label="卡住的地方 / 想補充的事" full><textarea className="input" rows={2} value={blockers} onChange={(e) => setBlockers(e.target.value)} /></Field>
      </div>
      <button className="btn ghost sm" onClick={() => save('dayLogs', { ...log, mood, blockers })}>儲存</button>
      <AiPanel
        kind="dailyReview"
        refId={id}
        label="生成今日覆盤"
        buildBody={() => ({ date, mood, input: blockers, summary: `${date} 覆盤` })}
      />
    </Card>
  );
}

export default function Home({ go }) {
  const { data, settings, save } = useStore();
  const createPlan = useCreateMonthPlan();
  const today = toDateStr();
  const [viewDate, setViewDate] = useState(today);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const start = settings.startDate;

  const tasks = useMemo(() => data.tasks.filter((t) => taskDate(t, start) === viewDate), [data.tasks, viewDate, start]);
  const logId = `d-${viewDate}`;
  const log = data.dayLogs.find((d) => d.id === logId);
  const lowEnergy = !!log?.lowEnergy;
  const essentials = useMemo(() => pickEssentialTasks(tasks), [tasks]);
  const points = totalPoints(data.tasks);
  const draws = drawsAvailable(data.tasks, data.cardDraws);

  if (!start || data.tasks.length === 0) {
    return (
      <>
        <PageHead eyebrow="WELCOME" title={`歡迎，${settings.displayName || '小陳'}`} desc="每天記錄真實的進度，AI 會根據你的紀錄給具體建議。" />
        <Todos />
        <Setup />
        <AiNotice />
      </>
    );
  }

  const cur = cycleOf(start, today);
  const notStarted = cur.index < 0;
  const month = notStarted ? cycleRange(start, 0) : cur;
  const monthTasks = data.tasks.filter((t) => { const d = taskDate(t, start); return d >= month.start && d <= month.end; });
  const monthDone = monthTasks.filter((t) => t.done).length;
  const next = cycleRange(start, Math.max(0, cur.index) + 1);
  const nextHasPlan = data.tasks.some((t) => { const d = taskDate(t, start); return d >= next.start && d <= next.end; });
  const daysLeft = notStarted ? null : month.length - cur.day;
  const viewCycle = cycleOf(start, viewDate);

  const makePlan = async (cycle) => { setCreating(true); await createPlan(cycle); setCreating(false); };

  const doneToday = tasks.filter((t) => t.done).length;
  const shown = lowEnergy ? essentials : tasks;
  const grouped = Object.keys(CATEGORIES).map((k) => [k, shown.filter((t) => t.category === k)]).filter(([, l]) => l.length);

  return (
    <>
      <PageHead
        eyebrow={fmtDate(today)}
        title={notStarted ? `距離開始還有 ${1 - cur.day} 天` : `第 ${cur.index + 1} 個月・第 ${cur.day} 天`}
        desc={`本月期間：${fmtDate(month.start)} ～ ${fmtDate(month.end)}（共 ${month.length} 天）`}
      />
      <div className="grid grid-4 mb">
        <Stat label="本月進度" value={notStarted ? `0／${month.length}` : `${cur.day}／${month.length}`} sub={<Progress value={notStarted ? 0 : (cur.day / month.length) * 100} />} />
        <Stat label="今日完成" value={`${doneToday}／${tasks.length}`} sub={`本月完成 ${monthDone}／${monthTasks.length}`} />
        <Stat label="累積積分" value={points} sub="漏做不扣分" gold />
        <Stat label="可抽卡次數" value={draws} sub={<a href="#/cards" onClick={(e) => { e.preventDefault(); go('cards'); }}>前往抽卡 →</a>} />
      </div>

      <Todos />

      {!notStarted && monthTasks.length === 0 && (
        <div className="notice info">
          <strong>第 {cur.index + 1} 個月（{fmtShortDate(cur.start)}～{fmtShortDate(cur.end)}）還沒有計畫。</strong>
          <div className="row mt"><button className="btn sm" disabled={creating} onClick={() => makePlan(cur)}>{creating ? <span className="spinner" /> : null}建立本月計畫</button><span className="tiny">沿用每週的節奏，主題會換新的</span></div>
        </div>
      )}
      {!notStarted && monthTasks.length > 0 && daysLeft <= 3 && !nextHasPlan && (
        <div className="notice info">
          這個月還剩 {daysLeft} 天。下個月是 {fmtShortDate(next.start)}～{fmtShortDate(next.end)}。
          <div className="row mt"><button className="btn sm" disabled={creating} onClick={() => makePlan(next)}>{creating ? <span className="spinner" /> : null}建立下個月計畫</button></div>
        </div>
      )}

      <Card
        title={<div className="row"><h2>{viewDate === today ? '今天的任務' : `${fmtShortDate(viewDate)} 的任務`}</h2><span className="tiny muted">{fmtDate(viewDate)}{viewCycle.index >= 0 ? `・第 ${viewCycle.index + 1} 個月第 ${viewCycle.day} 天` : ''}</span></div>}
        action={<>
          <button className="btn ghost sm" onClick={() => setViewDate(addDays(viewDate, -1))} aria-label="前一天">‹ 前一天</button>
          {viewDate !== today && <button className="btn ghost sm" onClick={() => setViewDate(today)}>今天</button>}
          <button className="btn ghost sm" onClick={() => setViewDate(addDays(viewDate, 1))} aria-label="後一天">後一天 ›</button>
        </>}
      >
        <div className="row between mb">
          <label className="check">
            <input type="checkbox" checked={lowEnergy} onChange={(e) => save('dayLogs', { ...(log || { id: logId, date: viewDate }), lowEnergy: e.target.checked }, { silent: true })} />
            <span>今天沒動力模式</span>
          </label>
          <button className="btn sm" onClick={() => setEditing({ date: viewDate })}>＋ 新增任務</button>
        </div>
        {lowEnergy && (
          <div className="notice info">
            今天只留下 {essentials.length} 件最重要、也最容易完成的事。做完一件就很好，其他任務還在，不會消失也不會扣分。
          </div>
        )}
        {tasks.length === 0 && <Empty title="這天還沒有任務">可以按「新增任務」，或到「每月計畫」安排。</Empty>}
        {lowEnergy && tasks.length > 0 && essentials.length === 0 && <Empty icon="✓" title="今天的任務都完成了">好好休息吧。</Empty>}
        {grouped.map(([k, list]) => (
          <div key={k}>
            <div className="cat-head">{CATEGORIES[k].icon} {CATEGORIES[k].name}<span className="count">{list.filter((t) => t.done).length}／{list.length}</span></div>
            {list.map((t) => <TaskItem key={t.id} task={t} onEdit={setEditing} />)}
          </div>
        ))}
      </Card>

      <AiNotice />
      <DailyReview key={viewDate} date={viewDate} />

      {editing && <TaskEditor task={editing.id ? { ...editing, date: taskDate(editing, start) } : null} defaultDate={editing.date} onSave={(t) => save('tasks', t)} onClose={() => setEditing(null)} />}
    </>
  );
}

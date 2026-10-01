import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Stat, Progress, Empty, Field } from '../components/ui.jsx';
import TaskItem from '../components/TaskItem.jsx';
import TaskEditor from '../components/TaskEditor.jsx';
import { AiNotice, AiPanel } from '../components/AiPanel.jsx';
import { CATEGORIES, TOTAL_DAYS, dateOfDay, dayOfDate, toDateStr, generateDefaultPlan, pickEssentialTasks } from '../lib/plan.js';
import { totalPoints, drawsAvailable } from '../lib/stats.js';
import { fmtDate } from '../lib/format.js';

function Setup() {
  const { saveSettings, saveMany, settings, data, toast } = useStore();
  const [startDate, setStartDate] = useState(settings.startDate || toDateStr());
  const [goals, setGoals] = useState(settings.goals || '');
  const [busy, setBusy] = useState(false);
  const hasTasks = data.tasks.length > 0;

  const start = async (withPlan) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) { toast('請選擇開始日期', 'error'); return; }
    setBusy(true);
    const ok = await saveSettings({ startDate, goals }, { silent: true });
    if (ok && withPlan && !hasTasks) {
      const saved = await saveMany('tasks', generateDefaultPlan());
      if (saved) toast(`已建立 ${saved.length} 個預設任務，之後都可以修改`, 'success');
    } else if (ok) toast('已設定開始日期', 'success');
    setBusy(false);
  };

  return (
    <Card title="開始你的 30 天">
      <p className="muted small mb">設定開始日期與你的目標。預設計畫只是起點：每週約 3 支 Reels、2 篇輪播，加上零售、團隊、財務與生活任務，全部都可以在「30 天計畫」修改。</p>
      <div className="form-grid">
        <Field label="計畫開始日期"><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="這 30 天最想達成的事" full hint="AI 會參考這段文字給建議，例如：穩定每週發 5 篇內容、存到 3 萬緊急預備金、團隊新增 5 位活躍夥伴">
          <textarea className="input" rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} />
        </Field>
      </div>
      <div className="row">
        {!hasTasks && <button className="btn" disabled={busy} onClick={() => start(true)}>{busy ? <span className="spinner" /> : null}建立預設 30 天計畫</button>}
        <button className="btn ghost" disabled={busy} onClick={() => start(false)}>{hasTasks ? '儲存開始日期' : '從空白計畫開始'}</button>
      </div>
    </Card>
  );
}

function DailyReview({ day }) {
  const { data, save } = useStore();
  const id = `day-${day}`;
  const log = data.dayLogs.find((d) => d.id === id) || { id, day };
  const [mood, setMood] = useState(log.mood || '');
  const [blockers, setBlockers] = useState(log.blockers || '');
  const tasks = data.tasks.filter((t) => t.day === day);
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
        buildBody={() => ({ day, mood, input: blockers, summary: `第 ${day} 天覆盤` })}
      />
    </Card>
  );
}

export default function Home({ go }) {
  const { data, settings, save } = useStore();
  const today = toDateStr();
  const todayDay = settings.startDate ? dayOfDate(settings.startDate, today) : 0;
  const [viewDay, setViewDay] = useState(() => Math.min(Math.max(todayDay, 1), TOTAL_DAYS));
  const [editing, setEditing] = useState(null);

  const tasks = useMemo(() => data.tasks.filter((t) => t.day === viewDay), [data.tasks, viewDay]);
  const logId = `day-${viewDay}`;
  const log = data.dayLogs.find((d) => d.id === logId);
  const lowEnergy = !!log?.lowEnergy;
  const essentials = useMemo(() => pickEssentialTasks(tasks), [tasks]);
  const points = totalPoints(data.tasks);
  const draws = drawsAvailable(data.tasks, data.cardDraws);
  const allDone = data.tasks.filter((t) => t.done).length;

  if (!settings.startDate || data.tasks.length === 0) {
    return (
      <>
        <PageHead eyebrow="WELCOME" title={`歡迎，${settings.displayName || "小陳"}`} desc="每天記錄真實的進度，AI 會根據你的紀錄給具體建議。" />
        <Setup />
        <AiNotice />
      </>
    );
  }

  const progress = Math.min(100, (Math.max(0, Math.min(todayDay, TOTAL_DAYS)) / TOTAL_DAYS) * 100);
  const doneToday = tasks.filter((t) => t.done).length;
  const shown = lowEnergy ? essentials : tasks;
  const grouped = Object.keys(CATEGORIES).map((k) => [k, shown.filter((t) => t.category === k)]).filter(([, l]) => l.length);

  return (
    <>
      <PageHead
        eyebrow={fmtDate(today)}
        title={todayDay < 1 ? `距離開始還有 ${1 - todayDay} 天` : todayDay > TOTAL_DAYS ? '30 天計畫已完成' : `第 ${todayDay} 天`}
        desc={`計畫期間：${fmtDate(settings.startDate)} ～ ${fmtDate(dateOfDay(settings.startDate, TOTAL_DAYS))}`}
      />
      <div className="grid grid-4 mb">
        <Stat label="30 天進度" value={`${Math.max(0, Math.min(todayDay, TOTAL_DAYS))}／${TOTAL_DAYS}`} sub={<Progress value={progress} />} />
        <Stat label="今日完成" value={`${doneToday}／${tasks.length}`} sub={`累計完成 ${allDone} 個任務`} />
        <Stat label="累積積分" value={points} sub="漏做不扣分" gold />
        <Stat label="可抽卡次數" value={draws} sub={<a href="#/cards" onClick={(e) => { e.preventDefault(); go('cards'); }}>前往抽卡 →</a>} />
      </div>

      <Card
        title={<div className="row"><h2>第 {viewDay} 天任務</h2><span className="tiny muted">{fmtDate(dateOfDay(settings.startDate, viewDay))}</span></div>}
        action={<>
          <button className="btn ghost sm" disabled={viewDay <= 1} onClick={() => setViewDay(viewDay - 1)} aria-label="前一天">‹ 前一天</button>
          {viewDay !== todayDay && todayDay >= 1 && todayDay <= TOTAL_DAYS && <button className="btn ghost sm" onClick={() => setViewDay(todayDay)}>今天</button>}
          <button className="btn ghost sm" disabled={viewDay >= TOTAL_DAYS} onClick={() => setViewDay(viewDay + 1)} aria-label="後一天">後一天 ›</button>
        </>}
      >
        <div className="row between mb">
          <label className="check">
            <input type="checkbox" checked={lowEnergy} onChange={(e) => save('dayLogs', { ...(log || { id: logId, day: viewDay }), lowEnergy: e.target.checked }, { silent: true })} />
            <span>今天沒動力模式</span>
          </label>
          <button className="btn sm" onClick={() => setEditing({ day: viewDay })}>＋ 新增任務</button>
        </div>
        {lowEnergy && (
          <div className="notice info">
            今天只留下 {essentials.length} 件最重要、也最容易完成的事。做完一件就很好，其他任務還在，不會消失也不會扣分。
          </div>
        )}
        {tasks.length === 0 && <Empty title="這天還沒有任務">可以按「新增任務」，或到 30 天計畫安排。</Empty>}
        {lowEnergy && tasks.length > 0 && essentials.length === 0 && <Empty icon="✓" title="今天的任務都完成了">好好休息吧。</Empty>}
        {grouped.map(([k, list]) => (
          <div key={k}>
            <div className="cat-head">{CATEGORIES[k].icon} {CATEGORIES[k].name}<span className="count">{list.filter((t) => t.done).length}／{list.length}</span></div>
            {list.map((t) => <TaskItem key={t.id} task={t} onEdit={setEditing} />)}
          </div>
        ))}
      </Card>

      <AiNotice />
      <DailyReview key={viewDay} day={viewDay} />

      {editing && <TaskEditor task={editing.id ? editing : null} defaultDay={editing.day} onSave={(t) => save('tasks', t)} onClose={() => setEditing(null)} />}
    </>
  );
}

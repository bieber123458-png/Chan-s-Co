import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Empty, Chips, Confirm, Field } from '../components/ui.jsx';
import TaskEditor from '../components/TaskEditor.jsx';
import { useCreateMonthPlan } from './Home.jsx';
import { CATEGORIES, PRIORITIES, addDays, cycleOf, cycleRange, taskDate, toDateStr, planUpgrade, PLAN_VERSION } from '../lib/plan.js';
import { fmtDate, fmtShortDate } from '../lib/format.js';

export default function Plan() {
  const { data, settings, save, removeMany, saveMany, remove, saveSettings, toast } = useStore();
  const createPlan = useCreateMonthPlan();
  const start = settings.startDate;
  const today = toDateStr();
  const cur = start ? cycleOf(start, today) : null;
  const [monthIdx, setMonthIdx] = useState(Math.max(0, cur?.index ?? 0));
  const month = start ? cycleRange(start, monthIdx) : null;
  const [selDate, setSelDate] = useState(() => (month && today >= month.start && today <= month.end ? today : month?.start || today));
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [startDate, setStartDate] = useState(start || today);

  const byDate = useMemo(() => {
    const m = {};
    for (const t of data.tasks) (m[taskDate(t, start)] ||= []).push(t);
    return m;
  }, [data.tasks, start]);

  // 從今天（或這個月第一天）起套用新版計畫
  const fromDate = month && today > month.start ? today : month?.start || today;
  const upgrade = useMemo(
    () => (month ? planUpgrade(data.tasks, fromDate, month, start) : { removeIds: [], add: [] }),
    [data.tasks, fromDate, month?.start, month?.end, start], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!start) {
    return (
      <>
        <PageHead eyebrow="MONTHLY PLAN" title="每月計畫" />
        <Card><Empty title="還沒有設定開始日期">請先到「今日任務」設定第一個月從哪天開始。</Empty></Card>
      </>
    );
  }

  const days = Array.from({ length: month.length }, (_, i) => addDays(month.start, i));
  const monthTasks = days.flatMap((d) => byDate[d] || []);
  const changeMonth = (i) => {
    const r = cycleRange(start, i);
    setMonthIdx(i);
    setSelDate(today >= r.start && today <= r.end ? today : r.start);
  };

  const list = (byDate[selDate] || [])
    .filter((t) => cat === 'all' || t.category === cat)
    .sort((a, b) => (PRIORITIES[a.priority]?.rank ?? 1) - (PRIORITIES[b.priority]?.rank ?? 1));

  const move = async (t, delta) => {
    const nd = addDays(taskDate(t, start), delta);
    const ok = await save('tasks', { ...t, date: nd }, { silent: true });
    if (ok) toast(`已移到 ${fmtShortDate(nd)}`, 'success');
  };

  const outdated = monthTasks.length > 0 && !monthTasks.some((t) => t.planVersion === PLAN_VERSION) && month.end >= today;

  const applyUpgrade = async () => {
    if (!(await removeMany('tasks', upgrade.removeIds))) return;
    const saved = await saveMany('tasks', upgrade.add);
    if (saved) toast(`已從 ${fmtShortDate(fromDate)} 起套用新版計畫，已完成的紀錄都保留`, 'success');
  };
  const resetMonth = async () => {
    if (!(await removeMany('tasks', monthTasks.map((t) => t.id)))) return;
    await createPlan(month);
  };
  const makePlan = async () => { setBusy(true); await createPlan(month); setBusy(false); };

  return (
    <>
      <PageHead eyebrow="MONTHLY PLAN" title="每月計畫" desc="從開始日起算一個月。所有任務、日期、優先順序與目標都可以修改；點選日期查看當天任務。" />

      {outdated && (
        <div className="notice info">
          <strong>有新版預設計畫：</strong>內容分成美業經營、減脂日常系列、接軌主題三條線；每天的限動加上互動貼紙，零售限動改成真實評價寫法，並加入食品廣告的合規提醒。
          <div className="row mt"><button className="btn sm" onClick={() => setConfirm('upgrade')}>從 {fmtShortDate(fromDate)} 起套用新版</button><span className="tiny">已完成或有填寫紀錄的任務都會保留</span></div>
        </div>
      )}

      <Card
        title={<div><h2>第 {monthIdx + 1} 個月</h2><div className="tiny muted">{fmtDate(month.start)} ～ {fmtDate(month.end)}（{month.length} 天）{cur.index === monthIdx ? '・本月' : ''}</div></div>}
        action={<>
          <button className="btn ghost sm" disabled={monthIdx <= 0} onClick={() => changeMonth(monthIdx - 1)}>‹ 上個月</button>
          {cur.index >= 0 && cur.index !== monthIdx && <button className="btn ghost sm" onClick={() => changeMonth(cur.index)}>本月</button>}
          <button className="btn ghost sm" onClick={() => changeMonth(monthIdx + 1)}>下個月 ›</button>
        </>}
      >
        {monthTasks.length === 0 ? (
          <Empty title="這個月還沒有計畫">
            <button className="btn sm mt" disabled={busy} onClick={makePlan}>{busy ? <span className="spinner" /> : null}建立這個月的計畫</button>
          </Empty>
        ) : (
          <>
            <div className="days">
              {days.map((d, i) => {
                const ts = byDate[d] || [];
                const done = ts.filter((t) => t.done).length;
                const cls = ts.length && done === ts.length ? 'full' : done ? 'partial' : '';
                return (
                  <button key={d} className={`day-dot ${cls} ${d === today ? 'today' : ''} ${d === selDate ? 'selected' : ''}`} onClick={() => setSelDate(d)} aria-label={`${d}，第 ${i + 1} 天`} title={fmtShortDate(d)}>
                    {Number(d.slice(8))}
                  </button>
                );
              })}
            </div>
            <p className="tiny muted mt">數字是日期。深色＝全部完成、金色＝部分完成、金框＝今天。</p>
          </>
        )}
      </Card>

      <Card
        title={<div><h2>{fmtDate(selDate)}</h2><div className="tiny muted">第 {monthIdx + 1} 個月第 {Math.max(1, days.indexOf(selDate) + 1)} 天</div></div>}
        action={<button className="btn sm" onClick={() => setEditing({ date: selDate })}>＋ 新增任務</button>}
      >
        <div className="mb"><Chips value={cat} onChange={setCat} options={[['all', '全部'], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.name])]} /></div>
        {list.length === 0 && <Empty title="這天沒有任務">{cat === 'all' ? '安排一點休息也很好，或新增一個任務。' : '這個類別在這天沒有任務。'}</Empty>}
        {list.map((t) => (
          <div key={t.id} className="list-item">
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 500 }}>{t.done ? '✓ ' : ''}{t.title}</div>
                <div className="task-meta">
                  <span className="tag">{CATEGORIES[t.category]?.name}</span>
                  <span className={`tag ${t.priority === 'high' ? 'gold' : ''}`}>{PRIORITIES[t.priority]?.name}</span>
                  <span className="tiny muted">+{t.points} 分{t.estMinutes ? `・約 ${t.estMinutes} 分鐘` : ''}</span>
                </div>
                {t.goal && <div className="small muted">目標：{t.goal}</div>}
              </div>
              <div className="row" style={{ gap: 2 }}>
                <button className="icon-btn" title="往前一天" onClick={() => move(t, -1)}>‹</button>
                <button className="icon-btn" title="往後一天" onClick={() => move(t, 1)}>›</button>
                <button className="icon-btn" onClick={() => setEditing({ ...t, date: taskDate(t, start) })}>編輯</button>
                <button className="icon-btn" onClick={() => setConfirm(t)}>刪除</button>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Card title="這個月各類別進度" className="soft">
        {Object.entries(CATEGORIES).map(([k, c]) => {
          const ts = monthTasks.filter((t) => t.category === k);
          const done = ts.filter((t) => t.done).length;
          return (
            <div key={k} className="bar-row">
              <span>{c.name}</span>
              <div className="bar"><div style={{ width: `${ts.length ? (done / ts.length) * 100 : 0}%` }} /></div>
              <span className="right tiny muted">{done}／{ts.length}</span>
            </div>
          );
        })}
        <hr className="divider" />
        <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field label="第一個月的開始日" hint="改了之後，每個月的起算日會跟著變，已排好的任務日期不會動"><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <div className="field"><button className="btn ghost sm" onClick={() => saveSettings({ startDate })} disabled={!startDate || startDate === start}>更新</button></div>
          </div>
          {monthTasks.length > 0 && <button className="btn danger sm" onClick={() => setConfirm('reset')}>重設這個月的計畫</button>}
        </div>
      </Card>

      {editing && <TaskEditor task={editing.id ? editing : null} defaultDate={editing.date} onSave={(t) => save('tasks', t)} onClose={() => setEditing(null)} />}
      {confirm === 'reset' && (
        <Confirm title="重設這個月的計畫？" confirmText="確定重設" onClose={() => setConfirm(null)} onConfirm={resetMonth}
          message={`會刪除第 ${monthIdx + 1} 個月的所有任務（包含已完成的紀錄與它們的積分），換成預設計畫。其他月份與財務、內容、日記不受影響。建議先到「設定與備份」匯出備份。`} />
      )}
      {confirm === 'upgrade' && (
        <Confirm title="套用新版計畫？" confirmText="確定套用" onClose={() => setConfirm(null)} onConfirm={applyUpgrade}
          message={`會把這個月 ${fmtShortDate(fromDate)} 起、尚未開始的 ${upgrade.removeIds.length} 個任務換成新版的 ${upgrade.add.length} 個任務。已完成的任務、已填寫的紀錄與累積積分都不會受影響。`} />
      )}
      {confirm && typeof confirm === 'object' && (
        <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('tasks', confirm.id)} message={`刪除任務「${confirm.title}」？${confirm.done ? '這個任務已完成，刪除後它的積分也會移除。' : ''}`} />
      )}
    </>
  );
}

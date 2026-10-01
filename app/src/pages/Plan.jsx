import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Empty, Chips, Confirm, Field } from '../components/ui.jsx';
import TaskEditor from '../components/TaskEditor.jsx';
import { CATEGORIES, PRIORITIES, TOTAL_DAYS, dateOfDay, dayOfDate, toDateStr, generateDefaultPlan, planUpgrade, PLAN_VERSION } from '../lib/plan.js';
import { fmtDate } from '../lib/format.js';

export default function Plan() {
  const { data, settings, save, saveMany, remove, removeMany, saveSettings, toast } = useStore();
  const todayDay = settings.startDate ? dayOfDate(settings.startDate, toDateStr()) : 1;
  const [day, setDay] = useState(Math.min(Math.max(todayDay, 1), TOTAL_DAYS));
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [startDate, setStartDate] = useState(settings.startDate || toDateStr());

  const byDay = useMemo(() => {
    const m = {};
    for (const t of data.tasks) (m[t.day] ||= []).push(t);
    return m;
  }, [data.tasks]);

  const list = (byDay[day] || [])
    .filter((t) => cat === 'all' || t.category === cat)
    .sort((a, b) => (PRIORITIES[a.priority]?.rank ?? 1) - (PRIORITIES[b.priority]?.rank ?? 1));

  const move = async (t, delta) => {
    const nd = t.day + delta;
    if (nd < 1 || nd > TOTAL_DAYS) return;
    const ok = await save('tasks', { ...t, day: nd }, { silent: true });
    if (ok) toast(`已移到第 ${nd} 天`, 'success');
  };

  const fromDay = Math.min(Math.max(todayDay, 1), TOTAL_DAYS);
  const upgrade = useMemo(() => planUpgrade(data.tasks, fromDay), [data.tasks, fromDay]);
  const outdated = data.tasks.length > 0 && !data.tasks.some((t) => t.planVersion === PLAN_VERSION);

  const applyUpgrade = async () => {
    if (!(await removeMany('tasks', upgrade.removeIds))) return;
    const saved = await saveMany('tasks', upgrade.add);
    if (saved) toast(`已從第 ${fromDay} 天起套用新版計畫（${saved.length} 個任務），已完成的紀錄都保留`, 'success');
  };

  const resetPlan = async () => {
    if (!(await removeMany('tasks', data.tasks.map((t) => t.id)))) return;
    const saved = await saveMany('tasks', generateDefaultPlan());
    if (saved) toast('已重新建立預設計畫', 'success');
  };

  return (
    <>
      <PageHead eyebrow="30-DAY PLAN" title="30 天經營計畫" desc="所有任務、日期、優先順序與目標都可以修改。點選日期查看當天任務。" />

      {outdated && (
        <div className="notice info">
          <strong>有新版預設計畫：</strong>依你 IG 的實際數據，內容改成三條線——美業經營、減脂日常系列、接軌主題；每天的限動加上互動貼紙，零售限動改成真實評價寫法，並加入食品廣告的合規提醒。
          <div className="row mt"><button className="btn sm" onClick={() => setConfirm('upgrade')}>從第 {fromDay} 天起套用新版</button><span className="tiny">已完成或有填寫紀錄的任務都會保留</span></div>
        </div>
      )}

      <Card title="計畫設定">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="開始日期"><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <div className="field"><button className="btn ghost" onClick={() => saveSettings({ startDate })} disabled={!startDate || startDate === settings.startDate}>更新開始日期</button></div>
        </div>
        <p className="tiny muted">修改開始日期後，每一天的任務會跟著順延，不會遺失已完成的紀錄。</p>
      </Card>

      <Card title="30 天總覽" action={<span className="tiny muted">深色＝全部完成、金色＝部分完成</span>}>
        <div className="days">
          {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map((d) => {
            const ts = byDay[d] || [];
            const done = ts.filter((t) => t.done).length;
            const cls = ts.length && done === ts.length ? 'full' : done ? 'partial' : '';
            return (
              <button key={d} className={`day-dot ${cls} ${d === todayDay ? 'today' : ''} ${d === day ? 'selected' : ''}`} onClick={() => setDay(d)} aria-label={`第 ${d} 天`}>
                {d}
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title={<div><h2>第 {day} 天</h2><div className="tiny muted">{settings.startDate ? fmtDate(dateOfDay(settings.startDate, day)) : '尚未設定開始日期'}</div></div>}
        action={<button className="btn sm" onClick={() => setEditing({ day })}>＋ 新增任務</button>}
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
                <button className="icon-btn" title="往前一天" onClick={() => move(t, -1)} disabled={t.day <= 1}>‹</button>
                <button className="icon-btn" title="往後一天" onClick={() => move(t, 1)} disabled={t.day >= TOTAL_DAYS}>›</button>
                <button className="icon-btn" onClick={() => setEditing(t)}>編輯</button>
                <button className="icon-btn" onClick={() => setConfirm(t)}>刪除</button>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Card title="各類別任務數" className="soft">
        {Object.entries(CATEGORIES).map(([k, c]) => {
          const ts = data.tasks.filter((t) => t.category === k);
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
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn danger sm" onClick={() => setConfirm('reset')}>重設為預設計畫</button>
        </div>
      </Card>

      {editing && <TaskEditor task={editing.id ? editing : null} defaultDay={editing.day} onSave={(t) => save('tasks', t)} onClose={() => setEditing(null)} />}
      {confirm === 'reset' && (
        <Confirm title="重設 30 天計畫？" confirmText="確定重設" onClose={() => setConfirm(null)} onConfirm={resetPlan}
          message="會刪除目前所有任務（包含已完成的紀錄與累積積分），換成預設計畫。其他資料（財務、內容、日記）不受影響。建議先到「設定與備份」匯出備份。" />
      )}
      {confirm === 'upgrade' && (
        <Confirm title="套用新版計畫？" confirmText="確定套用" onClose={() => setConfirm(null)} onConfirm={applyUpgrade}
          message={`會把第 ${fromDay} 天起、尚未開始的 ${upgrade.removeIds.length} 個任務換成新版的 ${upgrade.add.length} 個任務。今天以前的任務、已完成的任務與已填寫的紀錄、累積積分都不會受影響。`} />
      )}
      {confirm && confirm !== 'reset' && confirm !== 'upgrade' && (
        <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('tasks', confirm.id)} message={`刪除任務「${confirm.title}」？${confirm.done ? '這個任務已完成，刪除後它的積分也會移除。' : ''}`} />
      )}
    </>
  );
}

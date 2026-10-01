// 單一任務：勾選、執行結果、花費時間、心得與 AI 建議
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { CATEGORIES, PRIORITIES } from '../lib/plan.js';
import { AiPanel } from './AiPanel.jsx';

export default function TaskItem({ task, onEdit, showCategory }) {
  const { save, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ result: task.result || '', minutes: task.minutes ?? '', reflection: task.reflection || '' });
  const dirty = f.result !== (task.result || '') || String(f.minutes) !== String(task.minutes ?? '') || f.reflection !== (task.reflection || '');

  const toggle = async () => {
    const done = !task.done;
    const saved = await save('tasks', { ...task, done, doneAt: done ? new Date().toISOString() : null }, { silent: true });
    if (saved) toast(done ? `完成！+${task.points || 0} 積分` : '已取消完成（積分會依完成狀態重新計算）', done ? 'success' : 'info');
  };

  const saveNotes = async () => {
    if (f.minutes !== '' && (Number(f.minutes) < 0 || Number.isNaN(Number(f.minutes)))) {
      toast('花費時間請輸入正確的分鐘數', 'error');
      return;
    }
    await save('tasks', { ...task, ...f, minutes: f.minutes === '' ? '' : Number(f.minutes) });
  };

  const pr = PRIORITIES[task.priority] || PRIORITIES.mid;
  return (
    <div className={`task ${task.done ? 'done' : ''}`}>
      <div className="task-head">
        <button className={`task-check ${task.done ? 'on' : ''}`} onClick={toggle} aria-label={task.done ? '取消完成' : '標記完成'}>{task.done ? '✓' : ''}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="task-title" onClick={() => setOpen(!open)}>{task.title}</div>
          <div className="task-meta">
            {showCategory && <span className="tag">{CATEGORIES[task.category]?.name}</span>}
            <span className={`tag ${task.priority === 'high' ? 'gold' : ''}`}>{pr.name}</span>
            {task.estMinutes ? <span className="tiny muted">約 {task.estMinutes} 分鐘</span> : null}
            <span className="tiny muted">+{task.points || 0} 分</span>
            {(task.result || task.reflection) && <span className="tag ok">有紀錄</span>}
          </div>
        </div>
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? '收合' : '展開填寫'}>{open ? '︿' : '﹀'}</button>
      </div>
      {open && (
        <div className="task-body">
          {task.goal && <p className="small muted">目標：{task.goal}</p>}
          {task.description && <p className="small muted">{task.description}</p>}
          <div className="form-grid mt">
            <div className="field full">
              <label>執行結果</label>
              <textarea className="input" rows={2} placeholder="例如：發布了，2 小時 300 觀看；或：只完成腳本，還沒拍" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })} />
            </div>
            <div className="field">
              <label>花費時間（分鐘）</label>
              <input className="input" type="number" min="0" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} />
            </div>
            <div className="field full">
              <label>心得 / 遇到的問題</label>
              <textarea className="input" rows={2} value={f.reflection} onChange={(e) => setF({ ...f, reflection: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <button className="btn sm" onClick={saveNotes} disabled={!dirty}>儲存紀錄</button>
            {onEdit && <button className="btn ghost sm" onClick={() => onEdit(task)}>編輯任務</button>}
          </div>
          <AiPanel
            kind="task"
            refId={task.id}
            buildBody={(extra) => ({ task: { ...task, ...f }, input: extra, summary: `任務：${task.title}` })}
            inputPlaceholder="（選填）想問 AI 的補充，例如：這支 Reels 觀看很低，是開頭的問題嗎？"
          />
        </div>
      )}
    </div>
  );
}

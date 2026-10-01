// 新增／編輯任務的對話框（今日任務與每月計畫共用）
import { useState } from 'react';
import { Modal, Field } from './ui.jsx';
import { CATEGORIES, PRIORITIES, toDateStr } from '../lib/plan.js';

export default function TaskEditor({ task, defaultDate = toDateStr(), onSave, onClose }) {
  const [f, setF] = useState(() => ({
    title: '', category: 'brand', priority: 'mid', date: defaultDate, goal: '', description: '', estMinutes: 20,
    ...task,
    points: task?.points ?? PRIORITIES[task?.priority || 'mid'].points,
  }));
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async () => {
    const e = {};
    if (!f.title.trim()) e.title = '請輸入任務名稱';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) e.date = '請選擇日期';
    if (f.points === '' || Number(f.points) < 0 || Number(f.points) > 100) e.points = '請輸入 0～100';
    if (f.estMinutes !== '' && Number(f.estMinutes) < 0) e.estMinutes = '不能是負數';
    setErr(e);
    if (Object.keys(e).length) return;
    await onSave({
      ...task, ...f, title: f.title.trim(), date: f.date, points: Number(f.points),
      estMinutes: f.estMinutes === '' ? '' : Number(f.estMinutes),
      done: task?.done || false, result: task?.result || '', minutes: task?.minutes || '', reflection: task?.reflection || '',
    });
    onClose();
  };

  return (
    <Modal title={task?.id ? '編輯任務' : '新增任務'} onClose={onClose}
      actions={<><button className="btn ghost" onClick={onClose}>取消</button><button className="btn" onClick={submit}>儲存</button></>}>
      <div className="form-grid">
        <Field label="任務名稱" error={err.title} full><input className={`input ${err.title ? 'invalid' : ''}`} value={f.title} onChange={set('title')} autoFocus /></Field>
        <Field label="類別">
          <select className="input" value={f.category} onChange={set('category')}>
            {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="優先順序">
          <select className="input" value={f.priority} onChange={(e) => setF((x) => ({ ...x, priority: e.target.value, points: PRIORITIES[e.target.value].points }))}>
            {Object.entries(PRIORITIES).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="日期" error={err.date}><input className="input" type="date" value={f.date || ''} onChange={set('date')} /></Field>
        <Field label="完成可得積分" error={err.points}><input className="input" type="number" min="0" inputMode="numeric" value={f.points} onChange={set('points')} /></Field>
        <Field label="預估時間（分鐘）" error={err.estMinutes} hint="沒動力模式會優先挑選短時間任務"><input className="input" type="number" min="0" inputMode="numeric" value={f.estMinutes} onChange={set('estMinutes')} /></Field>
        <Field label="目標（做到什麼程度算完成）" full><input className="input" value={f.goal} onChange={set('goal')} /></Field>
        <Field label="說明" full><textarea className="input" rows={2} value={f.description} onChange={set('description')} /></Field>
      </div>
    </Modal>
  );
}

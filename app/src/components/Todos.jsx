// 每日待辦：每天自己寫，完成後打勾會槓掉；之前沒做完的可以一鍵移到今天
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Card, Confirm } from './ui.jsx';
import { addDays, toDateStr } from '../lib/plan.js';
import { fmtDate, fmtShortDate } from '../lib/format.js';

export default function Todos() {
  const { data, save, saveMany, remove, toast } = useStore();
  const today = toDateStr();
  const [date, setDate] = useState(today);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const todos = data.todos || [];
  const list = todos.filter((t) => t.date === date)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.order ?? 0) - (b.order ?? 0) || (a.createdAt || '').localeCompare(b.createdAt || ''));
  const done = list.filter((t) => t.done).length;
  // 今天以前沒完成的（最多往回看 14 天）
  const leftover = date === today ? todos.filter((t) => !t.done && t.date < today && t.date >= addDays(today, -14)) : [];

  const add = async () => {
    const v = text.trim();
    if (!v) return;
    if (v.length > 200) { toast('一件待辦最多 200 字', 'error'); return; }
    setText('');
    const ok = await save('todos', { date, text: v, done: false, order: Date.now() }, { silent: true });
    if (!ok) setText(v);
  };
  const toggle = (t) => save('todos', { ...t, done: !t.done, doneAt: t.done ? '' : new Date().toISOString() }, { silent: true });
  const saveEdit = async () => {
    const v = editing.text.trim();
    if (!v) { toast('內容不能是空的', 'error'); return; }
    if (await save('todos', { ...editing, text: v }, { silent: true })) setEditing(null);
  };
  const moveLeftover = async () => {
    if (await saveMany('todos', leftover.map((t) => ({ ...t, date: today, movedFrom: t.date })))) toast(`已把 ${leftover.length} 件移到今天`, 'success');
  };

  return (
    <Card
      title={<div className="row"><h2>{date === today ? '今日待辦' : `${fmtShortDate(date)} 待辦`}</h2>{list.length > 0 && <span className="tag">{done}／{list.length}</span>}</div>}
      action={<>
        <button className="btn ghost sm" onClick={() => setDate(addDays(date, -1))} aria-label="前一天">‹</button>
        {date !== today && <button className="btn ghost sm" onClick={() => setDate(today)}>今天</button>}
        <button className="btn ghost sm" onClick={() => setDate(addDays(date, 1))} aria-label="後一天">›</button>
      </>}
    >
      <div className="tiny muted mb">{fmtDate(date)}</div>
      <form className="todo-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input id="todo-input" className="input" placeholder="寫下要做的事…" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} />
        <button className="btn" type="submit" disabled={!text.trim()}>新增</button>
      </form>
      {leftover.length > 0 && (
        <div className="notice info small row between">
          <span>之前還有 {leftover.length} 件沒完成</span>
          <button className="btn ghost sm" onClick={moveLeftover}>移到今天</button>
        </div>
      )}
      {list.length === 0 ? <p className="small muted">{date === today ? '還沒有待辦，寫下第一件吧。' : '這天沒有待辦。'}</p> : (
        <ul className="todo-list">
          {list.map((t) => (
            <li key={t.id} className={`todo ${t.done ? 'done' : ''}`}>
              <label className="todo-check">
                <input type="checkbox" checked={!!t.done} onChange={() => toggle(t)} aria-label={`完成：${t.text}`} />
                <span className="box" aria-hidden="true">{t.done ? '✓' : ''}</span>
              </label>
              {editing?.id === t.id ? (
                <form className="todo-edit" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
                  <input className="input" autoFocus value={editing.text} maxLength={200} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
                  <button className="btn sm" type="submit">儲存</button>
                  <button className="btn ghost sm" type="button" onClick={() => setEditing(null)}>取消</button>
                </form>
              ) : (
                <>
                  <span className="todo-text" onDoubleClick={() => setEditing({ ...t })}>{t.text}{t.movedFrom && <span className="tiny muted">（從 {fmtShortDate(t.movedFrom)} 移來）</span>}</span>
                  <button className="icon-btn" onClick={() => setEditing({ ...t })}>編輯</button>
                  <button className="icon-btn" onClick={() => setConfirm(t)} aria-label={`刪除：${t.text}`}>✕</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && done === list.length && <p className="small mt" style={{ color: 'var(--ok)' }}>✓ 全部完成，辛苦了！</p>}
      {confirm && <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('todos', confirm.id)} message={`刪除「${confirm.text}」？`} />}
    </Card>
  );
}

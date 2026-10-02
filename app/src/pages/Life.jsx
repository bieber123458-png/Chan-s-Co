import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Empty, Chips, Confirm, Field } from '../components/ui.jsx';
import { AiNotice, AiPanel } from '../components/AiPanel.jsx';
import { addDays, toDateStr } from '../lib/plan.js';
import { fmtDate, fmtShortDate } from '../lib/format.js';
import Weight from '../components/Weight.jsx';

const MOODS = [['', '未填'], ['1', '😞 很低落'], ['2', '😕 有點低'], ['3', '😐 普通'], ['4', '🙂 不錯'], ['5', '😄 很好']];
const NUM_FIELDS = [
  ['exercise', '運動（分鐘）', 0, 600],
  ['water', '喝水（毫升）', 0, 8000],
  ['sleep', '睡眠（小時）', 0, 24],
  ['reading', '閱讀（分鐘）', 0, 600],
];
const EMPTY = { exercise: '', water: '', sleep: '', reading: '', mood: '', food: '', note: '' };

function Habits() {
  const { data, save, remove, toast } = useStore();
  const [date, setDate] = useState(toDateStr());
  const existing = data.habits.find((h) => h.id === date);
  const [f, setF] = useState({ ...EMPTY, ...existing });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setF({ ...EMPTY, ...data.habits.find((h) => h.id === date) }); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    for (const [k, label, min, max] of NUM_FIELDS) {
      if (f[k] === '') continue;
      const n = Number(f[k]);
      if (!Number.isFinite(n) || n < min || n > max) { toast(`${label}請輸入 ${min}～${max}`, 'error'); return; }
    }
    const rec = { ...f, id: date };
    for (const [k] of NUM_FIELDS) rec[k] = f[k] === '' ? '' : Number(f[k]);
    save('habits', rec);
  };

  const week = Array.from({ length: 7 }, (_, i) => addDays(toDateStr(), -6 + i)).map((d) => ({ d, h: data.habits.find((x) => x.id === d) }));

  return (
    <>
      <Card title="每日習慣">
        <div className="notice info small">以健康、可持續為原則：睡飽、喝水、規律活動比任何極端方法都更有效。不需要每天完美，記錄只是幫你看見自己的狀態。</div>
        <Field label="日期"><input className="input" type="date" value={date} max={toDateStr()} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ maxWidth: 200 }} /></Field>
        <div className="form-grid">
          {NUM_FIELDS.map(([k, label]) => (
            <Field key={k} label={label}><input className="input" type="number" min="0" inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>
          ))}
          <Field label="情緒狀態">
            <select className="input" value={f.mood} onChange={(e) => setF({ ...f, mood: e.target.value })}>{MOODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
          <Field label="飲食紀錄" full><input className="input" placeholder="例如：早餐蛋餅、午餐便當、晚餐自己煮" value={f.food} onChange={(e) => setF({ ...f, food: e.target.value })} /></Field>
        </div>
        <div className="row">
          <button className="btn" onClick={submit}>儲存 {fmtShortDate(date)} 的紀錄</button>
          {existing && <button className="btn danger sm" onClick={() => setConfirm(true)}>刪除這天紀錄</button>}
        </div>
      </Card>
      <Card title="近 7 天">
        <div className="table-wrap"><table>
          <thead><tr><th>日期</th><th className="num">運動</th><th className="num">喝水</th><th className="num">睡眠</th><th className="num">閱讀</th><th>心情</th></tr></thead>
          <tbody>{week.map(({ d, h }) => (
            <tr key={d} onClick={() => setDate(d)} style={{ cursor: 'pointer', background: d === date ? 'var(--ivory-2)' : undefined }}>
              <td>{fmtShortDate(d)}</td>
              {h ? <>
                <td className="num">{h.exercise !== '' ? `${h.exercise} 分` : '—'}</td><td className="num">{h.water !== '' ? `${h.water} ml` : '—'}</td>
                <td className="num">{h.sleep !== '' ? `${h.sleep} 時` : '—'}</td><td className="num">{h.reading !== '' ? `${h.reading} 分` : '—'}</td>
                <td>{MOODS.find((m) => m[0] === String(h.mood))?.[1] || '—'}</td>
              </> : <td colSpan={5} className="muted small">沒有紀錄</td>}
            </tr>))}
          </tbody></table></div>
      </Card>
      {confirm && <Confirm onClose={() => setConfirm(false)} onConfirm={async () => { if (await remove('habits', date)) setF(EMPTY); }} message={`刪除 ${date} 的習慣紀錄？`} />}
    </>
  );
}

function Journal() {
  const { data, save, remove, toast } = useStore();
  const [draft, setDraft] = useState({ date: toDateStr(), text: '' });
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const list = [...data.journals].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt?.localeCompare(a.createdAt));

  const add = async () => {
    if (!draft.text.trim()) { toast('請先寫下一點內容', 'error'); return; }
    if (await save('journals', { date: draft.date, text: draft.text.trim() })) setDraft({ date: toDateStr(), text: '' });
  };

  return (
    <>
      <Card title="寫日記">
        <Field label="日期"><input className="input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={{ maxWidth: 200 }} /></Field>
        <Field label="今天想記下的事"><textarea className="input" rows={5} placeholder="發生了什麼？有什麼感受？想對自己說什麼？" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} /></Field>
        <button className="btn" onClick={add}>儲存日記</button>
      </Card>
      {list.length === 0 && <Card><Empty title="還沒有日記">寫幾句就好，AI 可以幫你整理反思問題。</Empty></Card>}
      {list.map((j) => (
        <Card key={j.id} title={<h3>{fmtDate(j.date)}</h3>} action={<>
          <button className="icon-btn" onClick={() => setEditing(editing?.id === j.id ? null : { ...j })}>{editing?.id === j.id ? '取消' : '編輯'}</button>
          <button className="icon-btn" onClick={() => setConfirm(j)}>刪除</button>
        </>}>
          {editing?.id === j.id ? (
            <>
              <textarea className="input" rows={5} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
              <button className="btn sm mt" onClick={async () => { if (!editing.text.trim()) return toast('內容不能是空的', 'error'); if (await save('journals', editing)) setEditing(null); }}>儲存修改</button>
            </>
          ) : <p style={{ whiteSpace: 'pre-wrap' }}>{j.text}</p>}
          <AiPanel kind="journal" refId={j.id} label="請 AI 給我反思問題與建議" buildBody={() => ({ input: j.text })} />
        </Card>
      ))}
      {confirm && <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('journals', confirm.id)} message="刪除這篇日記？" />}
    </>
  );
}

export default function Life() {
  const [tab, setTab] = useState('habits');
  return (
    <>
      <PageHead eyebrow="LIFE" title="生活與自我成長" desc="照顧好自己，事業才走得長。" />
      <AiNotice />
      <div className="mb"><Chips value={tab} onChange={setTab} options={[['habits', '每日習慣'], ['weight', '體重'], ['journal', '日記']]} /></div>
      {tab === 'habits' && <Habits />}
      {tab === 'weight' && <Weight />}
      {tab === 'journal' && <Journal />}
    </>
  );
}

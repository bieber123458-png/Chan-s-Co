// 體重紀錄：每天一筆（可加體脂、腰圍），趨勢圖、與目標的距離、BMI
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Card, Empty, Field, Chips, Confirm, Stat } from './ui.jsx';
import { addDays, toDateStr } from '../lib/plan.js';
import { fmtShortDate } from '../lib/format.js';

const kg = (n) => `${(Math.round(n * 10) / 10).toFixed(1)} kg`;
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(Math.round(n * 10) / 10).toFixed(1)}`;
const dayNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const RANGES = [['30', '30 天'], ['90', '90 天'], ['365', '一年'], ['all', '全部']];

// 最接近某天、而且不晚於那天的紀錄
const onOrBefore = (list, date) => [...list].reverse().find((w) => w.date <= date);

function niceStep(span) {
  for (const s of [0.5, 1, 2, 5, 10]) if (span / s <= 5) return s;
  return 20;
}

function WeightChart({ points, goal }) {
  const wrap = useRef(null);
  const [w, setW] = useState(340);
  const [hover, setHover] = useState(null);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const set = () => setW(Math.max(240, el.clientWidth));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 220;
  const pad = { l: 40, r: 56, t: 14, b: 26 };
  const vals = points.map((p) => p.weight).concat(goal ? [goal] : []);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
  const step = niceStep(hi - lo);
  lo = Math.floor((lo - step * 0.2) / step) * step;
  hi = Math.ceil((hi + step * 0.2) / step) * step;
  const d0 = dayNum(points[0].date);
  const d1 = Math.max(d0 + 1, dayNum(points[points.length - 1].date));
  const x = (d) => pad.l + ((dayNum(d) - d0) / (d1 - d0)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.weight).toFixed(1)}`).join('');
  const last = points[points.length - 1];
  const xLabels = points.length === 1 ? [points[0]] : [points[0], last];

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = null;
    for (const p of points) { const dx = Math.abs(x(p.date) - px); if (!best || dx < best.dx) best = { p, dx }; }
    setHover(best?.p || null);
  };

  return (
    <div ref={wrap} className="chart-wrap">
      <svg width={w} height={H} role="img" aria-label={`體重趨勢：${points.length} 筆紀錄，最新 ${kg(last.weight)}`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={onMove}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={pad.l - 6} y={y(t)} className="axis-text" textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}
        {goal ? (
          <g>
            <line x1={pad.l} x2={w - pad.r} y1={y(goal)} y2={y(goal)} className="goal-line" />
            <text x={w - pad.r + 6} y={y(goal)} className="axis-text" dominantBaseline="middle">目標 {goal}</text>
          </g>
        ) : null}
        {xLabels.map((p, i) => (
          <text key={p.date} x={x(p.date)} y={H - 6} className="axis-text" textAnchor={i === 0 ? 'start' : 'end'}>{fmtShortDate(p.date)}</text>
        ))}
        <path d={path} className="series-line" />
        {points.length <= 45 && points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.weight)} r={3} className="series-dot" />)}
        <circle cx={x(last.date)} cy={y(last.weight)} r={4.5} className="series-dot end" />
        {!goal || Math.abs(y(goal) - y(last.weight)) > 14 ? <text x={x(last.date) + 8} y={y(last.weight)} className="end-label" dominantBaseline="middle">{last.weight}</text> : null}
        {hover && (
          <g pointerEvents="none">
            <line x1={x(hover.date)} x2={x(hover.date)} y1={pad.t} y2={H - pad.b} className="crosshair" />
            <circle cx={x(hover.date)} cy={y(hover.weight)} r={5} className="series-dot end" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(x(hover.date), 70), w - 70), top: Math.max(0, y(hover.weight) - 58) }}>
          <div className="tiny muted">{fmtShortDate(hover.date)}</div>
          <strong>{kg(hover.weight)}</strong>
          {hover.bodyFat !== '' && hover.bodyFat !== undefined && <div className="tiny">體脂 {hover.bodyFat}%</div>}
        </div>
      )}
    </div>
  );
}

const EMPTY = { weight: '', bodyFat: '', waist: '', note: '' };

export default function Weight() {
  const { data, save, remove, toast, settings, saveSettings } = useStore();
  const today = toDateStr();
  const [date, setDate] = useState(today);
  const [f, setF] = useState(EMPTY);
  const [range, setRange] = useState('90');
  const [confirm, setConfirm] = useState(null);
  const [goalForm, setGoalForm] = useState({ height: settings.heightCm || '', goal: settings.weightGoal || '' });
  const all = useMemo(() => [...(data.weights || [])].sort((a, b) => a.date.localeCompare(b.date)), [data.weights]);
  const existing = all.find((x) => x.date === date);
  useEffect(() => { setF({ ...EMPTY, ...all.find((x) => x.date === date) }); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const wv = Number(f.weight);
    if (f.weight === '' || !Number.isFinite(wv) || wv < 20 || wv > 300) { toast('體重請輸入 20～300 公斤', 'error'); return; }
    if (f.bodyFat !== '' && !(Number(f.bodyFat) >= 2 && Number(f.bodyFat) <= 70)) { toast('體脂率請輸入 2～70%', 'error'); return; }
    if (f.waist !== '' && !(Number(f.waist) >= 30 && Number(f.waist) <= 250)) { toast('腰圍請輸入 30～250 公分', 'error'); return; }
    await save('weights', {
      ...f, id: `w-${date}`, date, weight: Math.round(wv * 10) / 10,
      bodyFat: f.bodyFat === '' ? '' : Number(f.bodyFat), waist: f.waist === '' ? '' : Number(f.waist), note: (f.note || '').trim(),
    });
  };
  const saveGoal = () => {
    const h = goalForm.height === '' ? '' : Number(goalForm.height);
    const g = goalForm.goal === '' ? '' : Number(goalForm.goal);
    if (h !== '' && !(h >= 100 && h <= 230)) { toast('身高請輸入 100～230 公分', 'error'); return; }
    if (g !== '' && !(g >= 20 && g <= 300)) { toast('目標體重請輸入 20～300 公斤', 'error'); return; }
    saveSettings({ heightCm: h, weightGoal: g });
  };

  const latest = all[all.length - 1];
  const first = all[0];
  const weekAgo = latest ? onOrBefore(all, addDays(latest.date, -7)) : null;
  const goal = Number(settings.weightGoal) || 0;
  const height = Number(settings.heightCm) || 0;
  const bmi = latest && height ? latest.weight / ((height / 100) ** 2) : null;
  const shown = range === 'all' ? all : all.filter((x) => x.date >= addDays(today, -Number(range)));
  const last7 = latest ? all.filter((x) => x.date > addDays(latest.date, -7)) : [];
  const avg7 = last7.length ? last7.reduce((s, x) => s + x.weight, 0) / last7.length : null;

  return (
    <>
      <Card title="記錄體重">
        <div className="notice info small">體重一天之內會因為喝水、吃飯、睡眠起伏 1～2 公斤，建議固定在早上起床、上完廁所後量，看「趨勢」就好，不用被單日數字影響心情。</div>
        <Field label="日期"><input id="w-date" className="input" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ maxWidth: 200 }} /></Field>
        <div className="form-grid">
          <Field label="體重（公斤）*"><input id="w-weight" className="input" type="number" inputMode="decimal" step="0.1" min="20" max="300" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></Field>
          <Field label="體脂率（%，選填）"><input id="w-fat" className="input" type="number" inputMode="decimal" step="0.1" value={f.bodyFat} onChange={(e) => setF({ ...f, bodyFat: e.target.value })} /></Field>
          <Field label="腰圍（公分，選填）"><input id="w-waist" className="input" type="number" inputMode="decimal" step="0.1" value={f.waist} onChange={(e) => setF({ ...f, waist: e.target.value })} /></Field>
          <Field label="備註（選填）"><input className="input" placeholder="例如：經期、聚餐後、開始運動" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        <div className="row">
          <button className="btn" onClick={submit}>{existing ? '更新' : '儲存'} {fmtShortDate(date)} 的體重</button>
          {existing && <button className="btn danger sm" onClick={() => setConfirm(existing)}>刪除這天</button>}
        </div>
      </Card>

      {latest ? (
        <>
          <div className="grid grid-4 mb">
            <Stat label="最新體重" value={kg(latest.weight)} sub={fmtShortDate(latest.date)} />
            <Stat label="和一週前比" value={weekAgo && weekAgo.date !== latest.date ? `${signed(latest.weight - weekAgo.weight)} kg` : '—'} sub={weekAgo && weekAgo.date !== latest.date ? `${fmtShortDate(weekAgo.date)} ${kg(weekAgo.weight)}` : '再多記幾天就能比較'} />
            <Stat label="近 7 天平均" value={avg7 ? kg(avg7) : '—'} sub={`共 ${last7.length} 筆`} />
            <Stat label={goal ? '距離目標' : '總變化'} value={goal ? `${signed(latest.weight - goal)} kg` : `${signed(latest.weight - first.weight)} kg`} sub={goal ? `目標 ${kg(goal)}` : `從 ${fmtShortDate(first.date)} 開始`} />
          </div>
          <Card title="體重趨勢" action={<Chips value={range} onChange={setRange} options={RANGES} />}>
            {shown.length === 0 ? <p className="small muted">這段期間沒有紀錄，換個範圍看看。</p> : <WeightChart points={shown} goal={goal} />}
            {bmi && <p className="small mt">BMI {bmi.toFixed(1)}（身高 {height} 公分）。<span className="muted">台灣成人建議範圍 18.5～24；BMI 只是參考，不會分辨肌肉和脂肪。</span></p>}
          </Card>
          <Card title="紀錄明細">
            <div className="table-wrap"><table>
              <thead><tr><th>日期</th><th className="num">體重</th><th className="num">變化</th><th className="num">體脂</th><th className="num">腰圍</th><th>備註</th><th></th></tr></thead>
              <tbody>{[...all].reverse().slice(0, 60).map((x) => {
                const i = all.indexOf(x);
                const prev = i > 0 ? all[i - 1] : null;
                return (
                  <tr key={x.id}>
                    <td>{fmtShortDate(x.date)}</td><td className="num">{x.weight}</td>
                    <td className="num">{prev ? signed(x.weight - prev.weight) : '—'}</td>
                    <td className="num">{x.bodyFat !== '' && x.bodyFat !== undefined ? `${x.bodyFat}%` : '—'}</td>
                    <td className="num">{x.waist !== '' && x.waist !== undefined ? x.waist : '—'}</td>
                    <td className="small">{x.note || ''}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><button className="icon-btn" onClick={() => { setDate(x.date); window.scrollTo(0, 0); }}>編輯</button><button className="icon-btn" onClick={() => setConfirm(x)}>刪除</button></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </Card>
        </>
      ) : <Card><Empty title="還沒有體重紀錄">記下第一筆，之後就能看到趨勢圖。</Empty></Card>}

      <Card title="身高與目標體重（選填）">
        <div className="form-grid">
          <Field label="身高（公分）" hint="填了會幫你算 BMI"><input id="w-height" className="input" type="number" inputMode="decimal" value={goalForm.height} onChange={(e) => setGoalForm({ ...goalForm, height: e.target.value })} /></Field>
          <Field label="目標體重（公斤）" hint="健康的速度大約每週 0.5～1 公斤，不需要急"><input id="w-goal" className="input" type="number" inputMode="decimal" step="0.1" value={goalForm.goal} onChange={(e) => setGoalForm({ ...goalForm, goal: e.target.value })} /></Field>
        </div>
        <button className="btn ghost" onClick={saveGoal}>儲存</button>
      </Card>
      {confirm && <Confirm onClose={() => setConfirm(null)} onConfirm={async () => { if (await remove('weights', confirm.id) && confirm.date === date) setF(EMPTY); }} message={`刪除 ${confirm.date} 的體重紀錄？`} />}
    </>
  );
}

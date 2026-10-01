import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Chips, Field, Empty, Confirm, Stat } from '../components/ui.jsx';
import RecordForm from '../components/RecordForm.jsx';
import { AiNotice, AiPanel } from '../components/AiPanel.jsx';
import { newId } from '../lib/api.js';
import { toDateStr } from '../lib/plan.js';
import { fmtNum, fmtShortDate } from '../lib/format.js';
import { STORY_TYPES, STICKERS, TIME_SLOTS, buildStoryFrames, storyMetrics, COMPLIANCE_NOTE } from '../lib/copy.js';

const GOALS = ['提升觀看', '增加互動', '導流私訊', '帶新 Reels'];

const RECORD_FIELDS = [
  { key: 'date', label: '發布日期', type: 'date', required: true },
  { key: 'slot', label: '發布時段', type: 'select', options: TIME_SLOTS.map((x) => [x, x]) },
  { key: 'type', label: '類型', type: 'select', options: Object.entries(STORY_TYPES).map(([k, t]) => [k, t.name]) },
  { key: 'frameCount', label: '這組共幾則', type: 'number', min: 1, max: 30, required: true },
  { key: 'hook', label: '第一則的文字', type: 'text', full: true },
  { key: 'sticker', label: '主要互動貼紙', type: 'select', options: STICKERS.map((x) => [x, x]) },
  { key: 'firstViews', label: '第一則瀏覽數', type: 'number', required: true, hint: '限動 → 往上滑看到的瀏覽人數' },
  { key: 'lastViews', label: '最後一則瀏覽數', type: 'number', hint: '用來算有多少人看完整組' },
  { key: 'interactions', label: '貼紙互動數', type: 'number', hint: '投票、問答、測驗、滑桿的參與人數' },
  { key: 'replies', label: '回覆／私訊', type: 'number' },
  { key: 'shares', label: '分享', type: 'number' },
  { key: 'linkClicks', label: '連結點擊', type: 'number' },
  { key: 'notes', label: '備註', type: 'textarea', rows: 2 },
];

const latestFollowers = (data) => {
  const s = [...data.igSnapshots].sort((a, b) => a.date.localeCompare(b.date));
  return s.length ? Number(s[s.length - 1].followers) : null;
};

const newPlan = () => ({ id: newId(), status: 'planned', type: 'opinion', goal: '提升觀看', topic: '', date: toDateStr(), slot: TIME_SLOTS[3], frames: buildStoryFrames('opinion') });

// ---------------- 規劃 ----------------
function Planner({ plan, setPlan, onSaved }) {
  const { save } = useStore();
  const p = plan;
  const set = (patch) => setPlan({ ...p, ...patch });
  const setFrame = (i, patch) => set({ frames: p.frames.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const changeType = (type) => set({ type, frames: buildStoryFrames(type).map((f, i) => ({ ...f, text: p.frames[i]?.text || '' })) });
  const addFrame = () => set({ frames: [...p.frames, { no: p.frames.length + 1, role: '補充', sticker: '無', text: '' }] });
  const removeFrame = (i) => set({ frames: p.frames.filter((_, j) => j !== i).map((f, j) => ({ ...f, no: j + 1 })) });
  const hasSticker = p.frames.some((f) => f.sticker !== '無');

  const savePlan = async (silent) => {
    const first = p.frames[0]?.text?.trim();
    const sticker = p.frames.find((f) => f.sticker !== '無')?.sticker || '無';
    const ok = await save('stories', { ...p, frameCount: p.frames.length, hook: first || p.topic, sticker }, { silent });
    if (ok && !silent) onSaved?.();
    return !!ok;
  };

  const type = STORY_TYPES[p.type];
  return (
    <Card title="規劃這組限動">
      <p className="small muted mb">一組 3～5 則講完一件事：第一則決定觀眾要不要往下看，至少一則放互動貼紙。</p>
      <Field label="類型" hint={type.tip}><Chips value={p.type} onChange={changeType} options={Object.entries(STORY_TYPES).map(([k, t]) => [k, t.name])} /></Field>
      <div className="form-grid">
        <Field label="今天想發的事"><input id="story-topic" className="input" value={p.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="例如：防曬到底要不要補擦" /></Field>
        <Field label="這組的目標"><select id="story-goal" className="input" value={p.goal} onChange={(e) => set({ goal: e.target.value })}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="預計發布日期"><input id="story-date" className="input" type="date" value={p.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="預計時段"><select id="story-slot" className="input" value={p.slot} onChange={(e) => set({ slot: e.target.value })}>{TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}</select></Field>
      </div>
      {p.type === 'review' && <div className="notice warn small">{COMPLIANCE_NOTE}</div>}
      {!hasSticker && <div className="notice info small">這組還沒有互動貼紙。你的限動平均約 730 人看，但互動幾乎是 0，建議至少一則加投票或問答。</div>}

      {p.frames.map((f, i) => (
        <div key={i} className="frame-row">
          <span className="frame-no">{f.no}</span>
          <div className="stack" style={{ gap: 6, minWidth: 0 }}>
            <div className="row between"><strong className="small">{f.role}</strong>
              <div className="row" style={{ gap: 6 }}>
                <select className="input" style={{ width: 'auto', minHeight: 34, padding: '4px 8px', fontSize: 14 }} value={f.sticker} onChange={(e) => setFrame(i, { sticker: e.target.value })} aria-label={`第 ${f.no} 則貼紙`}>
                  {STICKERS.map((s) => <option key={s} value={s}>{s === '無' ? '不放貼紙' : `貼紙：${s}`}</option>)}
                </select>
                {p.frames.length > 1 && <button className="icon-btn" onClick={() => removeFrame(i)} aria-label={`刪除第 ${f.no} 則`}>✕</button>}
              </div>
            </div>
            <textarea className="input" rows={2} value={f.text} placeholder={i === 0 ? '例如：這罐防曬我宣判無效' : '這則要放的文字或畫面'} onChange={(e) => setFrame(i, { text: e.target.value })} />
          </div>
        </div>
      ))}
      <div className="row mt">
        <button className="btn ghost sm" onClick={addFrame} disabled={p.frames.length >= 10}>＋ 加一則</button>
        <button className="btn" onClick={() => savePlan(false)}>儲存規劃</button>
        <button className="btn ghost" onClick={() => setPlan(newPlan())}>規劃新的一組</button>
      </div>
      <AiPanel kind="storyPlan" refId={p.id} label="AI 幫我寫這組限動"
        validate={() => (!p.topic.trim() && !p.frames.some((f) => f.text.trim()) ? '請先填「今天想發的事」' : '')}
        beforeRun={() => savePlan(true)}
        buildBody={(extra) => ({ type: p.type, goal: p.goal, topic: p.topic, input: extra, frames: p.frames.map(({ role, sticker, text }) => ({ role, sticker, text })), summary: `限動：${p.topic || type.name}` })}
        inputPlaceholder="（選填）補充，例如：想帶到昨天的 Reels" />
    </Card>
  );
}

// ---------------- 紀錄 ----------------
function Records({ onEditPlan }) {
  const { data, save, remove } = useStore();
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const followers = latestFollowers(data);
  const list = [...data.stories].sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const blank = { date: toDateStr(), slot: TIME_SLOTS[3], type: 'opinion', frameCount: 4, hook: '', sticker: '投票', firstViews: '', lastViews: '', interactions: '', replies: '', shares: '', linkClicks: '', notes: '' };

  return (
    <Card title="限動紀錄" action={<button className="btn sm" onClick={() => setForm(blank)}>＋ 記錄一組已發布限動</button>}>
      <p className="small muted mb">建議發布 24 小時後填數據（限動消失前）。完成率＝最後一則瀏覽 ÷ 第一則瀏覽；互動率＝（貼紙互動＋回覆）÷ 第一則瀏覽。</p>
      {list.length === 0 && <Empty title="還沒有限動紀錄">先在「規劃」排一組，發布後回來填數據；或直接記錄一組已發布的限動。</Empty>}
      {list.map((s) => {
        const m = storyMetrics(s, followers);
        const planned = s.status === 'planned';
        return (
          <div key={s.id} className="list-item">
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="task-meta" style={{ marginTop: 0 }}>
                  <span className="tiny muted">{fmtShortDate(s.date)}・{s.slot || '時段未填'}</span>
                  <span className="tag">{STORY_TYPES[s.type]?.name || s.type}</span>
                  {planned ? <span className="tag warn">規劃中</span> : <span className="tag ok">已發布</span>}
                  {s.sticker && s.sticker !== '無' && <span className="tag gold">{s.sticker}</span>}
                </div>
                <div style={{ fontWeight: 500, marginTop: 4 }}>{s.hook || s.topic || '（沒有填第一則文字）'}</div>
                {!planned && (
                  <div className="small muted">
                    瀏覽 {fmtNum(s.firstViews)}・完成率 {m.completion ?? '—'}%・互動率 {m.engagement ?? '—'}%{m.reachRate !== null ? `・觸及粉絲 ${m.reachRate}%` : ''}
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 2 }}>
                {planned ? <>
                  <button className="btn sm" onClick={() => setForm({ ...blank, ...s, frameCount: s.frames?.length || s.frameCount, status: 'posted' })}>已發布，填數據</button>
                  <button className="icon-btn" onClick={() => onEditPlan(s)}>編輯規劃</button>
                </> : <button className="icon-btn" onClick={() => setForm(s)}>編輯</button>}
                <button className="icon-btn" onClick={() => setConfirm(s)}>刪除</button>
              </div>
            </div>
          </div>
        );
      })}
      {form && <RecordForm title={form.id ? '填寫限動數據' : '記錄一組限動'} fields={RECORD_FIELDS} initial={form}
        check={(v) => (v.lastViews !== '' && v.firstViews !== '' && v.lastViews > v.firstViews ? { lastViews: '最後一則通常不會比第一則多，請再確認' } : {})}
        onSave={(v) => save('stories', { ...v, status: 'posted' })} onClose={() => setForm(null)} />}
      {confirm && <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('stories', confirm.id)} message="刪除這組限動紀錄？" />}
    </Card>
  );
}

// ---------------- 分析 ----------------
function groupBy(list, key, label, followers) {
  const m = {};
  for (const s of list) (m[s[key] || '未填'] ||= []).push(s);
  return Object.entries(m).map(([k, l]) => {
    const ms = l.map((s) => storyMetrics(s, followers));
    const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null);
    return {
      k: label ? label(k) : k, n: l.length,
      views: avg(l.map((s) => Number(s.firstViews) || 0)),
      completion: avg(ms.map((x) => x.completion).filter((x) => x !== null)),
      engagement: avg(ms.map((x) => x.engagement).filter((x) => x !== null)),
    };
  }).sort((a, b) => (b.views || 0) - (a.views || 0));
}

function GroupTable({ title, rows }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? <Empty title="資料不足" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>分類</th><th className="num">組數</th><th className="num">平均瀏覽</th><th className="num">完成率</th><th className="num">互動率</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.k}><td>{r.k} {r.n < 3 && <span className="tag warn">樣本少</span>}</td><td className="num">{r.n}</td><td className="num">{fmtNum(Math.round(r.views))}</td>
              <td className="num">{r.completion ?? '—'}{r.completion !== null ? '%' : ''}</td><td className="num">{r.engagement ?? '—'}{r.engagement !== null ? '%' : ''}</td></tr>))}
          </tbody></table></div>
      )}
    </Card>
  );
}

function Analysis() {
  const { data } = useStore();
  const followers = latestFollowers(data);
  const posted = useMemo(() => data.stories.filter((s) => s.status !== 'planned' && s.firstViews !== '' && s.firstViews != null), [data.stories]);
  const ms = posted.map((s) => storyMetrics(s, followers));
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null);
  const avgViews = avg(posted.map((s) => Number(s.firstViews)));
  const avgCompletion = avg(ms.map((m) => m.completion).filter((x) => x !== null));
  const avgEng = avg(ms.map((m) => m.engagement).filter((x) => x !== null));

  return (
    <>
      <div className="grid grid-4 mb">
        <Stat label="已記錄組數" value={posted.length} sub={posted.length < 5 ? '少於 5 組，還不能下結論' : ''} />
        <Stat label="平均第一則瀏覽" value={avgViews === null ? '—' : fmtNum(Math.round(avgViews))} sub={followers && avgViews ? `約粉絲數的 ${Math.round((avgViews / followers) * 1000) / 10}%` : '記錄粉絲數後可計算觸及比例'} />
        <Stat label="平均完成率" value={avgCompletion === null ? '—' : `${avgCompletion}%`} sub="看完整組的比例" />
        <Stat label="平均互動率" value={avgEng === null ? '—' : `${avgEng}%`} sub="目標：5% 以上" gold />
      </div>
      {posted.length < 5 && <div className="notice warn">目前只有 {posted.length} 組有數據。少於 5 組時差異可能只是偶然，以下比較僅供參考。</div>}
      <div className="grid grid-2">
        <GroupTable title="依類型" rows={groupBy(posted, 'type', (k) => STORY_TYPES[k]?.name || k, followers)} />
        <GroupTable title="依互動貼紙" rows={groupBy(posted, 'sticker', null, followers)} />
      </div>
      <GroupTable title="依發布時段" rows={groupBy(posted, 'slot', null, followers)} />
      <Card title="AI 限動分析">
        <AiPanel kind="storyPerformance" refId="story-performance" label="分析我的限動表現"
          validate={() => (posted.length === 0 ? '還沒有已發布的限動數據，請先到「限動紀錄」填寫。' : '')}
          buildBody={(x) => ({ input: x, summary: '限動數據分析' })} inputPlaceholder="（選填）想特別了解的，例如：為什麼大家都不回覆投票？" />
      </Card>
    </>
  );
}

export default function Stories() {
  const [tab, setTab] = useState('plan');
  const [plan, setPlan] = useState(newPlan);
  return (
    <>
      <PageHead eyebrow="STORIES" title="限動經營" desc="規劃每一組限動的開頭、節奏與互動貼紙，發布後記錄數據，找出讓更多人看、更多人回覆的做法。" />
      <AiNotice />
      <div className="mb"><Chips value={tab} onChange={setTab} options={[['plan', '規劃限動'], ['records', '限動紀錄'], ['analysis', '限動分析']]} /></div>
      {tab === 'plan' && <Planner plan={plan} setPlan={setPlan} onSaved={() => setTab('records')} />}
      {tab === 'records' && <Records onEditPlan={(s) => { setPlan({ ...newPlan(), ...s }); setTab('plan'); }} />}
      {tab === 'analysis' && <Analysis />}
    </>
  );
}

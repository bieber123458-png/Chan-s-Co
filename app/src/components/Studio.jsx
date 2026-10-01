// 文案架構與輪播呈現工作室：先給結構，再由使用者填寫或請 AI 依架構寫出完整內容
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Card, Chips, Field, Empty, Confirm } from './ui.jsx';
import { AiPanel } from './AiPanel.jsx';
import { newId } from '../lib/api.js';
import { fmtDateTime } from '../lib/format.js';
import {
  FRAMEWORKS, HOOK_FORMULAS, CTA_OPTIONS, COPY_FORMATS, CAROUSEL_STYLES, CAROUSEL_SPEC, buildCarousel, COMPLIANCE_NOTE,
} from '../lib/copy.js';

async function copyText(text, toast) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已複製', 'success');
  } catch {
    toast('這個瀏覽器不允許自動複製，請手動選取文字複製', 'error');
  }
}

const sectionsFor = (fw) => FRAMEWORKS[fw].sections.map(([role, hint, example]) => ({ role, hint, example, text: '' }));

export function newCopyDraft() {
  return { id: newId(), kind: 'copy', status: '草稿', format: 'Reels 腳本', framework: 'pain', topic: '', points: '', sections: sectionsFor('pain') };
}
export function newCarouselDraft() {
  return { id: newId(), kind: 'carousel', status: '草稿', style: 'teach', topic: '', points: '', pages: buildCarousel(7, 'teach') };
}

// ---------------- 文案架構 ----------------
export function CopyStudio({ draft, setDraft }) {
  const { save, toast } = useStore();
  const d = draft;
  const set = (patch) => setDraft({ ...d, ...patch });
  const setSection = (i, text) => set({ sections: d.sections.map((s, j) => (j === i ? { ...s, text } : s)) });

  const changeFramework = (fw) => {
    // 換架構時保留已寫的內容（依段落順序對應）
    const next = sectionsFor(fw).map((s, i) => ({ ...s, text: d.sections[i]?.text || '' }));
    set({ framework: fw, sections: next });
  };
  const insertHook = (h) => setSection(0, d.sections[0].text ? `${d.sections[0].text}\n${h}` : h);
  const insertCta = (c) => { const i = d.sections.length - 1; setSection(i, d.sections[i].text ? `${d.sections[i].text}\n${c}` : c); };
  const fullText = d.sections.filter((s) => s.text.trim()).map((s) => s.text.trim()).join('\n\n');
  const saveDraft = async (silent) => {
    const title = d.topic.trim() || d.sections[0].text.trim().slice(0, 20) || '未命名文案';
    return !!(await save('drafts', { ...d, title }, { silent }));
  };

  const fw = FRAMEWORKS[d.framework];
  return (
    <>
      <Card title="文案架構">
        <p className="small muted mb">選一種架構，照著每一段填。不知道怎麼寫的段落可以留空，按「AI 依架構幫我寫」。</p>
        <Field label="形式"><Chips value={d.format} onChange={(v) => set({ format: v })} options={COPY_FORMATS.map((x) => [x, x])} /></Field>
        <Field label="架構" hint={`適合：${fw.fit}`}><Chips value={d.framework} onChange={changeFramework} options={Object.entries(FRAMEWORKS).map(([k, f]) => [k, f.name])} /></Field>
        <div className="form-grid">
          <Field label="主題"><input id="copy-topic" className="input" value={d.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="例如：價目表怎麼寫客人才不會只問價錢" /></Field>
          <Field label="想講的重點（選填）"><input id="copy-points" className="input" value={d.points} onChange={(e) => set({ points: e.target.value })} placeholder="例如：先寫適合誰、放客人回饋" /></Field>
        </div>
        {(d.framework === 'review' || d.framework === 'change') && <div className="notice warn small">{COMPLIANCE_NOTE}</div>}

        {d.sections.map((s, i) => (
          <div key={`${d.framework}-${i}`} className="field">
            <label>{i + 1}. {s.role}{s.hint && <span className="muted" style={{ fontWeight: 400 }}>：{s.hint}</span>}</label>
            {i === 0 && (
              <div className="chips" style={{ marginBottom: 6 }}>
                {HOOK_FORMULAS.slice(0, 5).map((h) => <button key={h} type="button" className="chip" onClick={() => insertHook(h)}>{h}</button>)}
              </div>
            )}
            {i === d.sections.length - 1 && (
              <div className="chips" style={{ marginBottom: 6 }}>
                {CTA_OPTIONS.map((c) => <button key={c} type="button" className="chip" onClick={() => insertCta(c)}>{c}</button>)}
              </div>
            )}
            <textarea className="input" rows={2} value={s.text} placeholder={s.example ? `例：${s.example}` : ''} onChange={(e) => setSection(i, e.target.value)} />
          </div>
        ))}
        <div className="row">
          <button className="btn" onClick={() => saveDraft(false)}>儲存草稿</button>
          <button className="btn ghost" disabled={!fullText} onClick={() => copyText(fullText, toast)}>複製全文</button>
          <button className="btn ghost" onClick={() => setDraft(newCopyDraft())}>開新的一份</button>
        </div>
        <AiPanel kind="copywrite" refId={d.id} label="AI 依架構幫我寫"
          validate={() => (!d.topic.trim() && !d.sections.some((s) => s.text.trim()) ? '請先填主題，或至少寫一段想法' : '')}
          beforeRun={() => saveDraft(true)}
          buildBody={(extra) => ({ format: d.format, framework: d.framework, topic: d.topic, input: [d.points, extra].filter(Boolean).join('；'), sections: d.sections.map(({ role, text }) => ({ role, text })), summary: `文案：${d.topic || fw.name}` })}
          inputPlaceholder="（選填）補充給 AI 的要求，例如：口氣再更直接一點" />
      </Card>
    </>
  );
}

// ---------------- 輪播呈現 ----------------
export function CarouselStudio({ draft, setDraft }) {
  const { save, toast } = useStore();
  const d = draft;
  const set = (patch) => setDraft({ ...d, ...patch });
  const rebuild = (count, style) => {
    const next = buildCarousel(count, style).map((p, i) => ({ ...p, title: d.pages[i]?.title || '', text: d.pages[i]?.text || '' }));
    set({ pages: next, style });
  };
  const setPage = (i, patch) => set({ pages: d.pages.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const saveDraft = async (silent) => {
    const title = d.topic.trim() || d.pages[0].title.trim() || '未命名輪播';
    return !!(await save('drafts', { ...d, title }, { silent }));
  };
  const fullText = d.pages.map((p) => `【${p.no}/${p.total} ${p.role}】${p.title}${p.text ? `\n${p.text}` : ''}`).join('\n\n');

  return (
    <Card title="輪播呈現方式">
      <p className="small muted mb">選風格與頁數，系統會排好每一頁的角色和版型。每頁只講一個重點，字數超過上限會提醒。</p>
      <Field label="風格"><Chips value={d.style} onChange={(s) => rebuild(d.pages.length, s)} options={Object.entries(CAROUSEL_STYLES).map(([k, s]) => [k, s.name])} /></Field>
      <div className="form-grid">
        <Field label="頁數（5～10）">
          <select id="carousel-pages" className="input" value={d.pages.length} onChange={(e) => rebuild(Number(e.target.value), d.style)}>
            {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} 頁</option>)}
          </select>
        </Field>
        <Field label="主題"><input id="carousel-topic" className="input" value={d.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="例如：美業人必備 6 個工具" /></Field>
        <Field label="想講的重點（選填）" full><input id="carousel-points" className="input" value={d.points} onChange={(e) => set({ points: e.target.value })} /></Field>
      </div>
      <details className="mb small"><summary style={{ cursor: 'pointer', color: 'var(--tea-dark)' }}>呈現規範（尺寸、字體、顏色）</summary><ul>{CAROUSEL_SPEC.map((x) => <li key={x}>{x}</li>)}</ul></details>

      <div className="carousel-grid">
        {d.pages.map((p, i) => {
          const len = (p.title + p.text).length;
          return (
            <div key={i} className="slide">
              <div className="slide-head"><span className="tag gold">{p.no}/{p.total}</span><strong>{p.role}</strong></div>
              <div className="tiny muted">版型：{p.layout}</div>
              <div className="tiny muted">{p.hint}</div>
              <input className="input mt" placeholder="這頁的大標題" value={p.title} onChange={(e) => setPage(i, { title: e.target.value })} />
              <textarea className="input" style={{ marginTop: 6 }} rows={2} placeholder="內文（可留空給 AI 寫）" value={p.text} onChange={(e) => setPage(i, { text: e.target.value })} />
              <div className="tiny" style={{ color: len > p.limit ? 'var(--err)' : 'var(--muted)', textAlign: 'right' }}>{len}／{p.limit} 字{len > p.limit ? '，太多了，拆成兩頁或刪減' : ''}</div>
            </div>
          );
        })}
      </div>
      <div className="row mt">
        <button className="btn" onClick={() => saveDraft(false)}>儲存草稿</button>
        <button className="btn ghost" onClick={() => copyText(fullText, toast)}>複製逐頁文字</button>
        <button className="btn ghost" onClick={() => setDraft(newCarouselDraft())}>開新的一組</button>
      </div>
      <AiPanel kind="carousel" refId={d.id} label="AI 幫我規劃每一頁"
        validate={() => (!d.topic.trim() ? '請先填主題' : '')}
        beforeRun={() => saveDraft(true)}
        buildBody={(extra) => ({ style: d.style, topic: d.topic, input: [d.points, extra].filter(Boolean).join('；'), pages: d.pages.map(({ role, layout, limit, title, text }) => ({ role, layout, limit, text: [title, text].filter(Boolean).join('／') })), summary: `輪播：${d.topic}` })}
        inputPlaceholder="（選填）補充要求，例如：封面要有我的照片、用奶茶色系" />
    </Card>
  );
}

// ---------------- 草稿 ----------------
export function Drafts({ onOpen }) {
  const { data, save, remove } = useStore();
  const [confirm, setConfirm] = useState(null);
  const list = [...data.drafts].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return (
    <Card title="我的草稿">
      {list.length === 0 && <Empty title="還沒有草稿">在「文案架構」或「輪播規劃」按「儲存草稿」就會出現在這裡。</Empty>}
      {list.map((x) => (
        <div key={x.id} className="list-item row between">
          <div style={{ flex: 1, minWidth: 180 }}>
            <div><strong>{x.title}</strong></div>
            <div className="task-meta">
              <span className="tag">{x.kind === 'carousel' ? `輪播・${CAROUSEL_STYLES[x.style]?.name}・${x.pages?.length} 頁` : `${x.format}・${FRAMEWORKS[x.framework]?.name}`}</span>
              <span className={`tag ${x.status === '已發布' ? 'ok' : ''}`}>{x.status}</span>
              <span className="tiny muted">{fmtDateTime(x.updatedAt)}</span>
            </div>
          </div>
          <div className="row" style={{ gap: 2 }}>
            <button className="icon-btn" onClick={() => onOpen(x)}>開啟</button>
            <button className="icon-btn" onClick={() => save('drafts', { ...x, status: x.status === '已發布' ? '草稿' : '已發布' }, { silent: true })}>{x.status === '已發布' ? '改回草稿' : '標為已發布'}</button>
            <button className="icon-btn" onClick={() => setConfirm(x)}>刪除</button>
          </div>
        </div>
      ))}
      {confirm && <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('drafts', confirm.id)} message={`刪除草稿「${confirm.title}」？`} />}
    </Card>
  );
}

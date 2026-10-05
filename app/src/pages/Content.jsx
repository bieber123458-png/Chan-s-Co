import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Empty, Chips, Confirm, Stat, Field } from '../components/ui.jsx';
import RecordForm, { blankFrom } from '../components/RecordForm.jsx';
import { AiNotice, AiPanel, AiResult } from '../components/AiPanel.jsx';
import { fmtNum, fmtShortDate } from '../lib/format.js';
import { sum } from '../lib/finance.js';
import { CopyStudio, CarouselStudio, Drafts, newCopyDraft, newCarouselDraft } from '../components/Studio.jsx';

export const FORMATS = ['Reels', '輪播', '限動', '貼文'];
export const TOPICS = ['減脂料理', '減脂日常', '外食／超商吃法', '生活日常', '旅遊生活', '產品真實評價', '開箱好物', '心態與習慣', '個人故事', '吃東西／美食', '其他'];

const POST_FIELDS = [
  { key: 'date', label: '發布日期', type: 'date', required: true },
  { key: 'format', label: '形式', type: 'select', options: FORMATS.map((f) => [f, f]) },
  { key: 'title', label: '標題 / 內容摘要', type: 'text', required: true, full: true },
  { key: 'topic', label: '主題分類', type: 'select', options: TOPICS.map((t) => [t, t]) },
  { key: 'views', label: '觀看數', type: 'number', hint: '還沒看數據可以先留空' },
  { key: 'reach', label: '觸及人數', type: 'number' },
  { key: 'nonFollower', label: '非粉絲觸及比例（%）', type: 'number', max: 100, hint: '洞察報告 → 觸及人數 → 「非粉絲」的百分比；越高代表推給越多新觀眾' },
  { key: 'shares', label: '分享', type: 'number' },
  { key: 'saves', label: '收藏', type: 'number' },
  { key: 'comments', label: '留言', type: 'number' },
  { key: 'follows', label: '新增追蹤', type: 'number' },
  { key: 'leads', label: '免費資源導流（領取／私訊數）', type: 'number' },
  { key: 'stickers', label: '限動互動數（投票／問答／回覆）', type: 'number', hint: '限動建議改到「限動經營」記錄，可看完成率與互動率' },
  { key: 'notes', label: '備註（例如：開頭用了什麼、發布時段）', type: 'textarea', rows: 2 },
];

function Analyze() {
  const { data, remove } = useStore();
  const [format, setFormat] = useState('Reels 腳本');
  const [topic, setTopic] = useState('');
  const [text, setText] = useState('');
  const history = data.aiHistory.filter((h) => h.kind === 'contentAnalyze').sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <Card title="內容健檢">
        <p className="small muted mb">貼上 Reels 腳本、輪播文案、限動內容或只是一個主題。AI 會依話題性、衝擊性、知識量、大眾性、帳號契合性、簡易性逐項說明原因與改法，並優化開頭、標題、CTA 與留言互動。</p>
        <div className="mb"><Chips value={format} onChange={setFormat} options={['Reels 腳本', '輪播文案', '限動內容', '貼文主題'].map((x) => [x, x])} /></div>
        <Field label="主題（選填）"><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="例如：價目表怎麼寫" /></Field>
        <Field label="內容"><textarea className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="把腳本或文案貼在這裡" /></Field>
        <AiPanel kind="contentAnalyze" label="分析這份內容" showHistory={false}
          validate={() => (text.trim().length < 5 ? '請先貼上內容（至少 5 個字）' : '')}
          buildBody={() => ({ input: text, format, topic })} />
      </Card>
      <Card title="過去的分析">
        {history.length === 0 && <Empty title="還沒有分析紀錄" />}
        {history.map((h) => (
          <div key={h.id} className="mb">
            <div className="small muted">{String(h.input).slice(0, 60)}…</div>
            <AiResult record={h} onDelete={(r) => remove('aiHistory', r.id)} />
          </div>
        ))}
      </Card>
    </>
  );
}

function Posts() {
  const { data, save, remove } = useStore();
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [filter, setFilter] = useState('all');
  const posts = [...data.posts].filter((p) => filter === 'all' || p.format === filter).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card title="發布紀錄" action={<button className="btn sm" onClick={() => setForm(blankFrom(POST_FIELDS))}>＋ 新增內容</button>}>
      <div className="notice info small">目前沒有連接 Instagram，請從 IG 後台「洞察報告」手動填入數據。建議發布 48 小時後再回來補數據，比較準確。</div>
      <div className="mb"><Chips value={filter} onChange={setFilter} options={[['all', '全部'], ...FORMATS.map((f) => [f, f])]} /></div>
      {posts.length === 0 ? <Empty title="還沒有內容紀錄">發布後新增一筆，之後就能分析哪種內容表現最好。</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>日期</th><th>內容</th><th className="num">觀看</th><th className="num">觸及</th><th className="num">分享</th><th className="num">收藏</th><th className="num">追蹤</th><th className="num">導流</th><th></th></tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>{fmtShortDate(p.date)}</td>
                  <td style={{ minWidth: 160 }}><div>{p.title}</div><div className="tiny muted">{p.format}・{p.topic}</div></td>
                  <td className="num">{fmtNum(p.views)}</td><td className="num">{fmtNum(p.reach)}</td><td className="num">{fmtNum(p.shares)}</td>
                  <td className="num">{fmtNum(p.saves)}</td><td className="num">{fmtNum(p.follows)}</td><td className="num">{fmtNum(p.leads)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" onClick={() => setForm(p)}>編輯</button>
                    <button className="icon-btn" onClick={() => setConfirm(p)}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {form && <RecordForm title={form.id ? '編輯內容' : '新增內容'} fields={POST_FIELDS} initial={form} onSave={(v) => save('posts', v)} onClose={() => setForm(null)} />}
      {confirm && <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('posts', confirm.id)} message={`刪除「${confirm.title}」的紀錄？`} />}
    </Card>
  );
}

function Performance() {
  const { data } = useStore();
  const posts = data.posts;
  const withViews = posts.filter((p) => p.views !== '' && p.views != null);
  const groups = useMemo(() => {
    const by = (key) => {
      const m = {};
      for (const p of withViews) (m[p[key]] ||= []).push(p);
      return Object.entries(m).map(([k, l]) => ({
        k, n: l.length,
        avgViews: Math.round(sum(l, (p) => p.views) / l.length),
        avgSaves: Math.round(sum(l, (p) => p.saves) / l.length),
        avgShares: Math.round(sum(l, (p) => p.shares) / l.length),
      })).sort((a, b) => b.avgViews - a.avgViews);
    };
    return { format: by('format'), topic: by('topic') };
  }, [withViews]);
  const top = [...withViews].sort((a, b) => b.views - a.views).slice(0, 3);
  const maxViews = Math.max(1, ...groups.format.map((g) => g.avgViews), ...groups.topic.map((g) => g.avgViews));
  const enough = withViews.length >= 5;

  return (
    <>
      <div className="grid grid-4 mb">
        <Stat label="內容篇數" value={posts.length} sub={`有觀看數據 ${withViews.length} 篇`} />
        <Stat label="總觀看" value={fmtNum(sum(posts, (p) => p.views))} />
        <Stat label="總新增追蹤" value={fmtNum(sum(posts, (p) => p.follows))} />
        <Stat label="免費資源導流" value={fmtNum(sum(posts, (p) => p.leads))} />
      </div>
      {!enough && <div className="notice warn">目前只有 {withViews.length} 篇有觀看數據。少於 5 篇時差異可能只是偶然，<strong>還不能下結論</strong>，以下僅供參考。</div>}
      <div className="grid grid-2">
        <Card title="依形式（平均觀看）">
          {groups.format.length === 0 ? <Empty title="資料不足" /> : groups.format.map((g) => (
            <div key={g.k} className="bar-row"><span>{g.k}（{g.n}）</span><div className="bar"><div style={{ width: `${(g.avgViews / maxViews) * 100}%` }} /></div><span className="right tiny">{fmtNum(g.avgViews)}</span></div>
          ))}
        </Card>
        <Card title="依主題（平均觀看）">
          {groups.topic.length === 0 ? <Empty title="資料不足" /> : groups.topic.map((g) => (
            <div key={g.k} className="bar-row"><span>{g.k}（{g.n}）</span><div className="bar"><div style={{ width: `${(g.avgViews / maxViews) * 100}%` }} /></div><span className="right tiny">{fmtNum(g.avgViews)}</span></div>
          ))}
        </Card>
      </div>
      <Card title="觀看最高的內容">
        {top.length === 0 ? <Empty title="還沒有觀看數據" /> : top.map((p, i) => (
          <div key={p.id} className="list-item"><strong>{i + 1}. {p.title}</strong><div className="tiny muted">{p.date}・{p.format}・觀看 {fmtNum(p.views)}・收藏 {fmtNum(p.saves)}・分享 {fmtNum(p.shares)}</div></div>
        ))}
      </Card>
      <Card title="AI 數據分析與下一篇建議">
        <AiPanel kind="postPerformance" refId="post-performance" label="分析我的內容表現"
          validate={() => (posts.length === 0 ? '還沒有任何內容紀錄，請先到「發布紀錄」新增。' : '')}
          buildBody={(extra) => ({ input: extra, summary: '內容數據分析' })} inputPlaceholder="（選填）想特別了解的問題，例如：輪播跟 Reels 哪個比較適合我？" />
      </Card>
    </>
  );
}

// ---------------- 提高觸及 ----------------
const REACH_CHECKS = [
  ['第 1 秒就有畫面＋字卡標題', '料理先放成品、日常先放最有感的畫面，不要從打招呼開始'],
  ['影片 7～30 秒、節奏快', '剪掉空白和重複，越多人看完，越會被推出去'],
  ['內容實用到讓人想收藏或分享', '食譜、清單、外食點法、超商組合：「分享給一起減脂的朋友」'],
  ['文案第一行寫關鍵字', '例如「減脂便當」「雞胸肉料理」，IG 搜尋才找得到你'],
  ['3～5 個精準 hashtag', '#減脂料理 #減脂便當 這種具體的，不要放 30 個'],
  ['用熱門或趨勢音訊', '音量可以調低，但有用熱門音訊比較容易進到推薦'],
  ['封面字清楚', '在個人頁的格子裡也看得懂這支在講什麼'],
  ['發布後 30 分鐘內回留言、分享到限動', '一開始的互動越多，IG 越會繼續推'],
  ['做成系列（第 N 集）', '結尾預告下一集，給新觀眾追蹤的理由'],
  ['一個月 1～2 次合作貼文', '和料理、減脂、生活類帳號一起發，同時出現在兩邊'],
];

function Reach() {
  const { data } = useStore();
  const [checked, setChecked] = useState({});
  const followers = [...data.igSnapshots].sort((a, b) => b.date.localeCompare(a.date))[0]?.followers || 0;
  const posts = data.posts.filter((p) => p.reach !== '' && p.reach != null && Number(p.reach) > 0);
  const recent = posts.filter((p) => p.date >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const avg = (l, f) => (l.length ? sum(l, f) / l.length : 0);
  const withNF = posts.filter((p) => p.nonFollower !== '' && p.nonFollower != null);
  const byTopic = useMemo(() => {
    const m = {};
    for (const p of posts) (m[p.topic || '未分類'] ||= []).push(p);
    return Object.entries(m).map(([k, l]) => ({
      k, n: l.length, reach: Math.round(avg(l, (p) => p.reach)),
      spread: Math.round(avg(l, (p) => ((Number(p.shares) || 0) + (Number(p.saves) || 0)) / Number(p.reach) * 1000)),
    })).sort((a, b) => b.reach - a.reach);
  }, [posts]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = [...posts].sort((a, b) => b.reach - a.reach).slice(0, 3);
  const maxReach = Math.max(1, ...byTopic.map((g) => g.reach));
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <>
      <div className="grid grid-4 mb">
        <Stat label="近 30 天平均觸及" value={recent.length ? fmtNum(Math.round(avg(recent, (p) => p.reach))) : '—'} sub={`${recent.length} 篇有觸及數據`} />
        <Stat label="觸及÷粉絲數" value={recent.length && followers ? `${Math.round((avg(recent, (p) => p.reach) / followers) * 100)}%` : '—'} sub={followers ? `粉絲 ${fmtNum(followers)}（最新紀錄）` : '到「事業儀表板」記錄粉絲數'} />
        <Stat label="非粉絲觸及比例" value={withNF.length ? `${Math.round(avg(withNF, (p) => p.nonFollower))}%` : '—'} sub={withNF.length ? `${withNF.length} 篇的平均` : '發布紀錄裡填「非粉絲觸及比例」'} />
        <Stat label="每千次觸及的分享＋收藏" value={posts.length ? fmtNum(Math.round(avg(posts, (p) => ((Number(p.shares) || 0) + (Number(p.saves) || 0)) / Number(p.reach) * 1000))) : '—'} sub="越高，越容易被推給新觀眾" />
      </div>
      {posts.length < 5 && <div className="notice info small">目前只有 {posts.length} 篇有觸及數據。到「發布紀錄」補上觸及、分享、收藏和非粉絲比例，累積 5 篇以上，這裡就能看出哪種內容最能帶新觀眾。</div>}

      <Card title="哪個主題觸及最高">
        {byTopic.length === 0 ? <Empty title="還沒有觸及數據" /> : byTopic.map((g) => (
          <div key={g.k} className="bar-row"><span>{g.k}（{g.n}）</span><div className="bar"><div style={{ width: `${(g.reach / maxReach) * 100}%` }} /></div><span className="right tiny">{fmtNum(g.reach)}</span></div>
        ))}
        {byTopic.length > 0 && byTopic[0].n < 3 && <p className="tiny muted mt">最高的主題只有 {byTopic[0].n} 篇，可能只是偶然，多做幾篇再下結論。</p>}
        {top.length > 0 && (
          <>
            <hr className="divider" />
            <div className="small muted mb">觸及最高的 3 篇：照它們的開頭和主題，下週再做一支</div>
            {top.map((p, i) => <div key={p.id} className="list-item"><strong>{i + 1}. {p.title}</strong><div className="tiny muted">{p.date}・{p.format}・{p.topic}・觸及 {fmtNum(p.reach)}{p.nonFollower !== '' && p.nonFollower != null ? `・非粉絲 ${p.nonFollower}%` : ''}・分享 {fmtNum(p.shares)}・收藏 {fmtNum(p.saves)}</div></div>)}
          </>
        )}
      </Card>

      <Card title={<div className="row"><h2>發布前觸及檢查</h2><span className="tag">{done}／{REACH_CHECKS.length}</span></div>}>
        <p className="small muted mb">每次發 Reels 或輪播前照著勾一遍，勾越多，越有機會被推給還沒追蹤你的人。</p>
        <ul className="todo-list">
          {REACH_CHECKS.map(([title, tip], i) => (
            <li key={title} className={`todo ${checked[i] ? 'done' : ''}`}>
              <label className="todo-check">
                <input type="checkbox" checked={!!checked[i]} onChange={() => setChecked({ ...checked, [i]: !checked[i] })} aria-label={title} />
                <span className="box" aria-hidden="true">{checked[i] ? '✓' : ''}</span>
              </label>
              <span className="todo-text"><strong>{title}</strong><div className="tiny muted" style={{ textDecoration: 'none' }}>{tip}</div></span>
            </li>
          ))}
        </ul>
        {done > 0 && <button className="btn ghost sm mt" onClick={() => setChecked({})}>清空，檢查下一篇</button>}
      </Card>

      <Card title="AI 觸及分析">
        <AiPanel kind="postPerformance" refId="reach" label="分析怎麼提高我的觸及率"
          validate={() => (data.posts.length === 0 ? '還沒有任何內容紀錄，請先到「發布紀錄」新增。' : '')}
          buildBody={(extra) => ({ input: `請專門分析怎麼提高我的觸及率（特別是非粉絲觸及）：哪些主題和開頭帶來最多觸及、哪些內容被分享和收藏最多、下週該做哪 3 支內容。${extra ? `\n我的問題：${extra}` : ''}`, summary: '觸及分析' })}
          inputPlaceholder="（選填）例如：料理影片和日常影片，哪個比較能帶新觀眾？" />
      </Card>
    </>
  );
}

export default function Content({ go }) {
  const { settings, data } = useStore();
  const [tab, setTab] = useState('copy');
  const [copyDraft, setCopyDraft] = useState(newCopyDraft);
  const [carouselDraft, setCarouselDraft] = useState(newCarouselDraft);
  const openDraft = (x) => {
    if (x.kind === 'carousel') { setCarouselDraft(x); setTab('carousel'); } else { setCopyDraft(x); setTab('copy'); }
  };
  return (
    <>
      <PageHead eyebrow="CONTENT ADVISOR" title="AI 社群內容顧問" desc="先用架構寫文案、規劃輪播，發布前健檢，發布後記錄數據，再根據真實表現決定下一篇。限動請到「限動經營」。" />
      <AiNotice />
      <div className="notice info small">
        {settings.igHandle
          ? <>經營帳號：<a href={`https://www.instagram.com/${settings.igHandle}/`} target="_blank" rel="noreferrer">@{settings.igHandle}</a>。{settings.igPositioning ? `定位：${settings.igPositioning}` : <>還沒填寫帳號定位，<a href="#/settings" onClick={(e) => { e.preventDefault(); go('settings'); }}>到設定補上</a>，AI 判斷「帳號契合性」會更準。</>}</>
          : <>還沒設定 IG 帳號，<a href="#/settings" onClick={(e) => { e.preventDefault(); go('settings'); }}>到設定填寫</a>。</>}
      </div>
      <div className="mb"><Chips value={tab} onChange={setTab} options={[['copy', '文案架構'], ['carousel', '輪播規劃'], ['analyze', '內容健檢'], ['drafts', `我的草稿（${data.drafts.length}）`], ['posts', '發布紀錄'], ['perf', '數據分析'], ['reach', '提高觸及']]} /></div>
      {tab === 'copy' && <CopyStudio draft={copyDraft} setDraft={setCopyDraft} />}
      {tab === 'carousel' && <CarouselStudio draft={carouselDraft} setDraft={setCarouselDraft} />}
      {tab === 'analyze' && <Analyze />}
      {tab === 'drafts' && <Drafts onOpen={openDraft} />}
      {tab === 'posts' && <Posts />}
      {tab === 'perf' && <Performance />}
      {tab === 'reach' && <Reach />}
    </>
  );
}

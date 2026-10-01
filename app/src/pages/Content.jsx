import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Empty, Chips, Confirm, Stat, Field } from '../components/ui.jsx';
import RecordForm, { blankFrom } from '../components/RecordForm.jsx';
import { AiNotice, AiPanel, AiResult } from '../components/AiPanel.jsx';
import { fmtNum, fmtShortDate } from '../lib/format.js';
import { sum } from '../lib/finance.js';

export const FORMATS = ['Reels', '輪播', '限動', '貼文'];
export const TOPICS = ['美業經營錯誤', 'IG 首頁定位', '價目表', '限動經營', '客人為何選擇你', '成交溝通', '經營思維', '個人故事', '免費模板導流', '減脂日常', '吃東西／美食', '接軌（美業×生活）', '旅遊生活', '產品評價', '其他'];

const POST_FIELDS = [
  { key: 'date', label: '發布日期', type: 'date', required: true },
  { key: 'format', label: '形式', type: 'select', options: FORMATS.map((f) => [f, f]) },
  { key: 'title', label: '標題 / 內容摘要', type: 'text', required: true, full: true },
  { key: 'topic', label: '主題分類', type: 'select', options: TOPICS.map((t) => [t, t]) },
  { key: 'views', label: '觀看數', type: 'number', hint: '還沒看數據可以先留空' },
  { key: 'reach', label: '觸及人數', type: 'number' },
  { key: 'shares', label: '分享', type: 'number' },
  { key: 'saves', label: '收藏', type: 'number' },
  { key: 'comments', label: '留言', type: 'number' },
  { key: 'follows', label: '新增追蹤', type: 'number' },
  { key: 'leads', label: '免費資源導流（領取／私訊數）', type: 'number' },
  { key: 'stickers', label: '限動互動數（投票／問答／回覆）', type: 'number', hint: '限動才需要填' },
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

export default function Content({ go }) {
  const { settings } = useStore();
  const [tab, setTab] = useState('analyze');
  return (
    <>
      <PageHead eyebrow="CONTENT ADVISOR" title="AI 社群內容顧問" desc="寫內容前先健檢，發布後記錄數據，再根據真實表現決定下一篇。" />
      <AiNotice />
      <div className="notice info small">
        {settings.igHandle
          ? <>經營帳號：<a href={`https://www.instagram.com/${settings.igHandle}/`} target="_blank" rel="noreferrer">@{settings.igHandle}</a>。{settings.igPositioning ? `定位：${settings.igPositioning}` : <>還沒填寫帳號定位，<a href="#/settings" onClick={(e) => { e.preventDefault(); go('settings'); }}>到設定補上</a>，AI 判斷「帳號契合性」會更準。</>}</>
          : <>還沒設定 IG 帳號，<a href="#/settings" onClick={(e) => { e.preventDefault(); go('settings'); }}>到設定填寫</a>。</>}
      </div>
      <div className="mb"><Chips value={tab} onChange={setTab} options={[['analyze', '內容健檢'], ['posts', '發布紀錄'], ['perf', '數據分析']]} /></div>
      {tab === 'analyze' && <Analyze />}
      {tab === 'posts' && <Posts />}
      {tab === 'perf' && <Performance />}
    </>
  );
}

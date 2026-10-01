import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Empty, Chips, Stat, Progress } from '../components/ui.jsx';
import { CARDS, CARD_TYPES, drawRandomCard } from '../lib/cards.js';
import { totalPoints, drawsAvailable, POINTS_PER_DRAW } from '../lib/stats.js';
import { fmtDateTime } from '../lib/format.js';

const cardBg = (type) => `linear-gradient(145deg, ${CARD_TYPES[type].color}, #8b6b4f)`;

export default function Cards() {
  const { data, save } = useStore();
  const [current, setCurrent] = useState(null);
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState(false);
  const points = totalPoints(data.tasks);
  const available = drawsAvailable(data.tasks, data.cardDraws);
  const owned = new Set(data.cardDraws.map((d) => d.cardId));
  const history = [...data.cardDraws].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const toNext = POINTS_PER_DRAW - (points % POINTS_PER_DRAW);

  const draw = async () => {
    if (available <= 0) return;
    setBusy(true);
    const card = drawRandomCard();
    const saved = await save('cardDraws', { cardId: card.id }, { silent: true });
    if (saved) setCurrent(card);
    setBusy(false);
  };

  return (
    <>
      <PageHead eyebrow="REWARDS" title="積分與鼓勵卡" desc={`完成任務獲得積分，每累積 ${POINTS_PER_DRAW} 分可以抽一張鼓勵卡。抽卡只是鼓勵，不需要付費，也不會扣掉累積積分。`} />
      <div className="grid grid-3 mb">
        <Stat label="累積積分" value={points} gold sub="漏做任務不會扣分" />
        <Stat label="可抽卡次數" value={available} sub={<>距離下一次還差 {toNext} 分<Progress value={((POINTS_PER_DRAW - toNext) / POINTS_PER_DRAW) * 100} /></>} />
        <Stat label="已收集" value={`${owned.size}／${CARDS.length}`} sub={`共抽了 ${data.cardDraws.length} 次`} />
      </div>

      <Card title="抽一張鼓勵卡">
        {current ? (
          <div className="draw-card" key={history[0]?.id} style={{ background: cardBg(current.type) }}>
            <span className="tag" style={{ background: 'rgba(255,255,255,.25)', color: '#fff', alignSelf: 'flex-start' }}>{CARD_TYPES[current.type].name}</span>
            <p className="text">{current.text}</p>
            <span className="tiny" style={{ opacity: 0.85 }}>小陳的 30 天經營系統</span>
          </div>
        ) : <Empty icon="❖" title={available > 0 ? '準備好了嗎？' : '再完成一些任務就能抽卡'}>{available > 0 ? '按下按鈕抽一張給今天的自己。' : `每完成任務都會累積積分，滿 ${POINTS_PER_DRAW} 分就能抽。`}</Empty>}
        <div className="row mt" style={{ justifyContent: 'center' }}>
          <button className="btn gold" onClick={draw} disabled={available <= 0 || busy}>{busy ? <span className="spinner" /> : '✦'} 抽卡（剩 {available} 次）</button>
        </div>
      </Card>

      <Card title="我的收藏">
        <div className="mb"><Chips value={tab} onChange={setTab} options={[['all', '全部'], ...Object.entries(CARD_TYPES).map(([k, t]) => [k, t.name])]} /></div>
        <div className="grid grid-4">
          {CARDS.filter((c) => tab === 'all' || c.type === tab).map((c) => owned.has(c.id) ? (
            <div key={c.id} className="mini-card" style={{ background: cardBg(c.type) }}>
              <span>{c.text}</span><span className="tiny" style={{ opacity: 0.85 }}>{CARD_TYPES[c.type].name}</span>
            </div>
          ) : (
            <div key={c.id} className="mini-card locked"><span>尚未獲得</span></div>
          ))}
        </div>
      </Card>

      <Card title="抽卡歷史">
        {history.length === 0 ? <Empty title="還沒有抽卡紀錄" /> : history.slice(0, 50).map((h) => {
          const c = CARDS.find((x) => x.id === h.cardId);
          return (
            <div key={h.id} className="list-item">
              <div className="row between"><span className="tag">{c ? CARD_TYPES[c.type].name : '—'}</span><span className="tiny muted">{fmtDateTime(h.createdAt)}</span></div>
              <p className="small mt">{c?.text || '（卡片已不存在）'}</p>
            </div>
          );
        })}
      </Card>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PageHead, Card, Empty, Chips, Confirm } from '../components/ui.jsx';
import { AiNotice, AiResult, ManualClaude } from '../components/AiPanel.jsx';
import { Markdown } from '../lib/markdown.jsx';
import { fmtDateTime } from '../lib/format.js';

const MODES = [
  ['free', '自由聊聊'],
  ['analyze', '幫我分析'],
  ['idea', '幫我想新點子'],
  ['improve', '幫我改善'],
  ['decide', '幫我做決策'],
  ['breakdown', '幫我拆解目標'],
  ['story', '限動顧問'],
];
const PLACEHOLDER = {
  free: '今天做了什麼、遇到什麼、在想什麼都可以寫。例如：今天拍了兩支 Reels，但一直覺得自己講話很卡……',
  analyze: '描述想分析的狀況，例如：這週發了 3 篇，觀看都不到 200，不知道問題在哪',
  idea: '想要什麼方向的點子？例如：想做一系列「我今天吃什麼」的 Reels',
  improve: '貼上你想改善的做法或文字，例如：我的成交話術是……',
  decide: '描述你在猶豫的選擇，例如：要不要先暫停零售，專心做內容？',
  breakdown: '寫下你的目標，例如：這個月想新增 3 位活躍夥伴',
  story: '問限動的問題，例如：我的限動平均 730 人看，但幾乎沒人回覆，怎麼改？',
};

export default function Coach() {
  const { data, ai, aiReady, remove } = useStore();
  const [mode, setMode] = useState('free');
  const [text, setText] = useState('');
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [tab, setTab] = useState('chat');
  const endRef = useRef(null);

  const chat = data.aiHistory.filter((h) => h.kind === 'coach').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const others = data.aiHistory.filter((h) => h.kind !== 'coach').sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  useEffect(() => { if (tab === 'chat') endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat.length, pending, tab]);

  const send = async () => {
    const input = text.trim();
    if (!input) { setError('請先輸入想跟教練說的內容'); return; }
    setError('');
    setPending(input);
    setText('');
    try {
      await ai('coach', { mode, input });
    } catch (e) {
      setError(e.message);
      setText(input);
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <PageHead eyebrow="AI COACH" title="AI 個人成長教練" desc="教練會參考你的目標、近 7 天任務紀錄與過去的建議，延續上次的對話，而不是每次從頭開始。" />
      <AiNotice />
      <div className="mb"><Chips value={tab} onChange={setTab} options={[['chat', '對話'], ['history', `所有 AI 建議紀錄（${others.length}）`]]} /></div>

      {tab === 'chat' && (
        <>
          <Card>
            {chat.length === 0 && !pending && (
              <Empty icon="✦" title="還沒有對話">從今天發生的一件事開始就好，不用整理得很完整。</Empty>
            )}
            <div className="chat">
              {chat.map((h) => (
                <div key={h.id} className="stack" style={{ gap: 8 }}>
                  <div className="bubble me">
                    {h.mode && h.mode !== 'free' && <div className="tiny" style={{ opacity: 0.8 }}>{MODES.find((m) => m[0] === h.mode)?.[1]}</div>}
                    {h.input}
                  </div>
                  <div className="bubble ai">
                    <Markdown text={h.output} />
                    <div className="row between tiny muted mt">
                      <span>{fmtDateTime(h.createdAt)}</span>
                      <button className="icon-btn tiny" onClick={() => setConfirm(h)}>刪除</button>
                    </div>
                  </div>
                </div>
              ))}
              {pending && <>
                <div className="bubble me">{pending}</div>
                <div className="bubble ai"><span className="row small muted"><span className="spinner" /> 教練正在看你的紀錄並思考…</span></div>
              </>}
              <div ref={endRef} />
            </div>
          </Card>

          <Card>
            <div className="mb"><Chips value={mode} onChange={setMode} options={MODES} /></div>
            <textarea className="input" rows={4} placeholder={PLACEHOLDER[mode]} value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
            {error && <div className="notice err mt">{error}</div>}
            {aiReady ? (
              <div className="row between mt">
                <span className="tiny muted">AI 建議僅供參考，重要決定請依實際狀況判斷。</span>
                <button className="btn" onClick={send} disabled={!!pending}>{pending ? <span className="spinner" /> : null}送出</button>
              </div>
            ) : (
              <div className="mt">
                <ManualClaude kind="coach" compact
                  validate={() => (!text.trim() ? '請先輸入想跟教練說的內容' : '')}
                  getBody={() => ({ mode, input: text.trim() })}
                  onSaved={() => setText('')} />
                <p className="tiny muted mt">指令裡已經包含你的目標、近 7 天紀錄和之前的對話，Claude 會延續上次的建議。</p>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'history' && (
        <Card title="所有 AI 建議紀錄">
          {others.length === 0 && <Empty title="還沒有其他 AI 建議">在任務、內容、財務、日記等頁面按下 AI 按鈕後，紀錄會出現在這裡。</Empty>}
          {others.map((h) => (
            <div key={h.id} className="mb">
              <div className="small"><strong>{h.label}</strong>・<span className="muted">{String(h.input).slice(0, 80)}</span></div>
              <AiResult record={h} onDelete={setConfirm} />
            </div>
          ))}
        </Card>
      )}

      {confirm && <Confirm onClose={() => setConfirm(null)} onConfirm={() => remove('aiHistory', confirm.id)} message="刪除這則 AI 紀錄？之後 AI 不會再參考這則內容。" />}
    </>
  );
}

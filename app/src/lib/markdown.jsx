// 輕量 Markdown 顯示（只支援 AI 回覆會用到的標題、條列、粗體），不使用 innerHTML，避免 XSS
function inline(text, key) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') && p.length > 4
      ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>
      : <span key={`${key}-${i}`}>{p}</span>);
}

export function Markdown({ text }) {
  const lines = String(text || '').split('\n');
  const out = [];
  let list = null;
  const flush = () => {
    if (list) out.push(<ul key={`ul-${out.length}`}>{list}</ul>);
    list = null;
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const h = line.match(/^#{1,4}\s+(.*)$/);
    const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (h) { flush(); out.push(<h4 key={i}>{inline(h[1], i)}</h4>); }
    else if (li) { (list ||= []).push(<li key={i}>{inline(li[1], i)}</li>); }
    else if (!line.trim()) { flush(); }
    else { flush(); out.push(<p key={i}>{inline(line, i)}</p>); }
  });
  flush();
  return <div className="md">{out}</div>;
}

// AI 功能：所有 AI 呼叫都在後端進行，API 金鑰只從環境變數讀取
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES, PRIORITIES, dayOfDate, dateOfDay, toDateStr, addDays } from '../src/lib/plan.js';
import { monthlySummary, debtStatus, goalProgress, avgEssential, STRATEGIES, TX_TYPES } from '../src/lib/finance.js';
import { DEFAULT_SETTINGS } from '../src/lib/stats.js';

export const AI_MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

let client = null;
const getClient = () => (client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const BASE = `你是「小陳的 30 天經營系統」裡的 AI 個人成長教練與事業顧問。使用者是台灣的美業經營者（暱稱小陳），同時經營美業個人品牌（IG 教學與經營知識內容）、婕樂纖零售與團隊。

回覆規則：
- 一律使用繁體中文與台灣常用用語，語氣溫暖、直接、像一位懂經營的朋友，不說教、不責備、不羞辱。
- 必須根據使用者實際輸入與下方提供的紀錄回答。引用使用者的具體內容，不要給「加油、你可以的」這類空泛話語。
- 沒有提供的數據不可自行編造或假設成事實；資料不足時明確說「目前資料不足，無法判斷」，並說明需要補哪些資料。
- 目標（例如月收入 15 萬、團隊 150 人）只是目標，不可描述成已達成；營收不等於利潤。
- 不承諾收入或療效，不建議誇大或違規的產品宣稱；健康相關建議以可持續為原則，不鼓勵極端節食。
- 財務建議優先保障必要生活費、最低應繳金額與基本緊急預備金，不建議超出能力的還款或存錢金額。
- 你無法連接 Instagram 或任何外部帳號，只能分析使用者手動輸入的內容與數據。
- 內容若把食品或保健品（例如婕樂纖產品）和減重、瘦身、公斤數、「纖體」連在一起，要提醒台灣食品廣告不得宣稱減重等功效，並示範改成強調作息與飲食習慣的合規寫法。這是提醒而非法律意見。
- 使用簡潔的 Markdown：小標題用「### 」，條列用「- 」，重點用 **粗體**。不要寫過長的前言。`;

const MODES = {
  free: '自由對話：先理解使用者說的事，再給回饋。',
  analyze: '幫我分析：拆解狀況的原因、哪些做法值得保留、真正的問題在哪裡。',
  idea: '幫我想新點子：提出 3～5 個具體、符合使用者帳號定位且今天就能開始的點子。',
  improve: '幫我改善：針對使用者描述的做法，給出更好的具體版本（可以直接示範改寫）。',
  decide: '幫我做決策：列出選項、各自利弊與風險，最後給出你的建議與理由；若資訊不足先追問最關鍵的一點。',
  breakdown: '幫我拆解目標：把目標拆成本週、今天可以做的具體步驟，每步可衡量、時間合理。',
};

const COACH_FORMAT = `請依序回覆：
### 我理解的狀況
### 值得保留的做法
### 需要注意的問題
### 具體改善建議
### 下一步（最多三項，寫清楚做什麼、做到什麼程度）
如果有一個最重要、會影響建議的資訊缺口，最後加上「### 想再問你一件事」並只問一個問題；沒有就省略。`;

const short = (s, n) => (s && String(s).length > n ? String(s).slice(0, n) + '…' : s || '');
const money = (n) => `NT$${Math.round(Number(n) || 0).toLocaleString('zh-TW')}`;

function igLine(data) {
  const snaps = [...(data?.igSnapshots || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!snaps.length) return '- IG 粉絲數：沒有紀錄';
  const l = snaps[snaps.length - 1];
  const p = snaps[snaps.length - 2];
  return `- IG 粉絲數：${l.followers}（${l.date} 紀錄${p ? `，比 ${p.date} ${l.followers - p.followers >= 0 ? '+' : ''}${l.followers - p.followers}` : ''}）` +
    (l.views30 ? `；近 30 天觀看 ${l.views30}、新粉絲 ${l.newFollowers30 ?? '未填'}、被分享 ${l.shared30 ?? '未填'}` : '');
}

function profileBlock(settings, data) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const today = toDateStr();
  const day = s.startDate ? dayOfDate(s.startDate, today) : null;
  return `## 使用者資料
- 今天：${today}${day ? `（30 天計畫第 ${day} 天）` : '（尚未設定計畫開始日）'}
- 個人目標：${s.goals || '（尚未填寫）'}
- 月收入目標：${money(s.monthlyIncomeGoal)}（目標，非現況）
- 團隊人數目標：${s.teamGoal} 人（目標，非現況）
- 每月內容產出目標：${s.monthlyContentGoal} 篇
- Instagram 帳號：${s.igHandle ? `@${s.igHandle}` : '（未填）'}（系統無法讀取帳號內容，只能參考使用者描述與手動輸入的數據）
- 帳號定位：${s.igPositioning || '（尚未填寫）'}
${igLine(data)}`;
}

function recentTasksBlock(data, settings) {
  if (!settings.startDate) return '';
  const today = toDateStr();
  const from = addDays(today, -6);
  const rows = (data.tasks || [])
    .map((t) => ({ ...t, date: dateOfDay(settings.startDate, t.day) }))
    .filter((t) => t.date >= from && t.date <= today)
    .filter((t) => t.done || t.result || t.reflection);
  if (!rows.length) return '\n## 近 7 天任務紀錄\n（近 7 天沒有任務完成或心得紀錄）';
  return '\n## 近 7 天任務紀錄\n' + rows.slice(-25).map((t) =>
    `- ${t.date}［${CATEGORIES[t.category]?.name || t.category}］${t.title}：${t.done ? '已完成' : '未完成'}` +
    `${t.result ? `；結果：${short(t.result, 120)}` : ''}${t.reflection ? `；心得：${short(t.reflection, 120)}` : ''}` +
    `${t.minutes ? `；花費 ${t.minutes} 分鐘` : ''}`).join('\n');
}

function historyBlock(data, excludeKinds = []) {
  const items = (data.aiHistory || []).filter((h) => !excludeKinds.includes(h.kind)).slice(-6);
  if (!items.length) return '\n## 過去的 AI 建議\n（這是第一次使用 AI 建議）';
  return '\n## 過去的 AI 建議（請延續，不要重複同樣的話，也可追蹤使用者是否執行）\n' + items.map((h) =>
    `- ${h.createdAt?.slice(0, 10)}［${h.label || h.kind}］使用者說：${short(h.input, 150)}\n  你建議：${short(h.output, 300)}`).join('\n');
}

function financeBlock(data, settings) {
  const month = toDateStr().slice(0, 7);
  const m = monthlySummary(data, month);
  const pays = data.debtPayments || [];
  const debts = (data.debts || []).map((d) => {
    const st = debtStatus(d, pays);
    return `- ${d.name}：剩餘本金 ${money(st.remaining)}，年利率 ${d.apr}%，最低應繳 ${money(d.minPayment)}，每月 ${d.dueDay || '?'} 日繳款`;
  });
  const goals = (data.savingsGoals || []).map((g) => {
    const p = goalProgress(g, data.deposits || []);
    return `- ${g.name}（用途：${g.purpose || '未填'}）：目標 ${money(g.target)}，已存 ${money(p.saved)}，目標日 ${g.targetDate || '未設定'}，計畫每月存 ${money(g.monthlyAmount)}`;
  });
  const ess = avgEssential(data);
  const strat = STRATEGIES[settings.strategy] || STRATEGIES.balanced;
  return `\n## 財務資料（${month}，只含已記錄的資料）
- 本月是否有紀錄：${m.hasData ? '有' : '沒有'}
- 收入 ${money(m.income)}；${TX_TYPES.essential} ${money(m.essential)}；${TX_TYPES.nonessential} ${money(m.nonessential)}；${TX_TYPES.business} ${money(m.business)}
- 本月債務還款 ${money(m.debtPaid)}（本金 ${money(m.debtPrincipal)}、利息 ${money(m.debtInterest)}、超過最低應繳的額外還款 ${money(m.debtExtra)}）
- 本月存入 ${money(m.saved)}；可用餘額 ${money(m.available)}
- 所有負債最低應繳合計 ${money(m.minDue)}；剩餘債務 ${money(m.remainingDebt)}
- 必要生活支出月平均：${ess ? money(ess) : '資料不足'}；緊急預備金目標 ${settings.emergencyMonths || 3} 個月
- 使用者選擇的策略：${strat.name}；自訂每月額外還款：${money(settings.extraDebtPayment)}
### 負債
${debts.join('\n') || '（沒有負債紀錄）'}
### 存錢目標
${goals.join('\n') || '（沒有存錢目標）'}`;
}

function postsBlock(data) {
  const posts = [...(data.posts || [])].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  if (!posts.length) return '\n## 已發布內容數據\n（沒有任何內容數據）';
  const v = (x) => (x === '' || x == null ? '未填' : x);
  return `\n## 已發布內容數據（共 ${posts.length} 篇，使用者手動輸入）\n` + posts.map((p) =>
    `- ${p.date}｜${p.format}｜主題：${p.topic || '未分類'}｜${p.title}｜觀看 ${v(p.views)}、觸及 ${v(p.reach)}、分享 ${v(p.shares)}、收藏 ${v(p.saves)}、新增追蹤 ${v(p.follows)}、導流 ${v(p.leads)}`).join('\n');
}

// 依功能組出 system prompt 與訊息
function build(kind, body, data, settings) {
  const input = String(body.input || '').trim();
  const ctx = profileBlock(settings, data) + recentTasksBlock(data, settings);
  switch (kind) {
    case 'coach': {
      const mode = MODES[body.mode] || MODES.free;
      const prior = (data.aiHistory || []).filter((h) => h.kind === 'coach').slice(-6);
      const messages = [];
      for (const h of prior) {
        messages.push({ role: 'user', content: h.input });
        messages.push({ role: 'assistant', content: h.output });
      }
      messages.push({ role: 'user', content: `【模式：${mode}】\n${input}` });
      return {
        label: 'AI 教練',
        system: `${BASE}\n\n${COACH_FORMAT}\n\n${ctx}${historyBlock(data, ['coach'])}`,
        messages,
      };
    }
    case 'task': {
      const t = body.task || {};
      return {
        label: '任務建議',
        system: `${BASE}\n\n${ctx}${historyBlock(data)}`,
        messages: [{ role: 'user', content: `請針對這個任務給我建議。
任務：${t.title}
類別：${CATEGORIES[t.category]?.name || ''}；優先順序：${PRIORITIES[t.priority]?.name || ''}
任務目標：${t.goal || '未填'}；說明：${t.description || '無'}
狀態：${t.done ? '已完成' : '尚未完成'}；花費時間：${t.minutes || '未填'} 分鐘
執行結果：${t.result || '未填'}
心得：${t.reflection || '未填'}
${input ? `我想補充：${input}` : ''}

請回覆：
### 做得好的地方（若尚未執行或沒有填結果，請說明並改為「開始前的提醒」）
### 可以改善的地方
### 具體做法（可以直接照做的步驟或範例）
### 下一步（最多三項）`}],
      };
    }
    case 'dailyReview': {
      const day = Number(body.day);
      const tasks = (data.tasks || []).filter((t) => t.day === day);
      const list = tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.title}${t.result ? `｜結果：${t.result}` : ''}${t.reflection ? `｜心得：${t.reflection}` : ''}`).join('\n');
      return {
        label: '今日覆盤',
        system: `${BASE}\n\n${ctx}${historyBlock(data)}`,
        messages: [{ role: 'user', content: `請幫我做第 ${day} 天的覆盤。
今天的任務：
${list || '（沒有任務）'}
今天的心情與狀態：${body.mood || '未填'}
卡住的地方 / 補充：${input || '未填'}

請回覆（漏做的任務不要責備，只分析原因）：
### 今天完成了什麼
### 做得好的地方
### 卡住的原因
### 明天最重要的三件事`}],
      };
    }
    case 'contentAnalyze':
      return {
        label: '內容分析',
        system: `${BASE}\n\n${ctx}${postsBlock(data)}${historyBlock(data)}`,
        messages: [{ role: 'user', content: `請分析這份${body.format || '內容'}。
${body.topic ? `主題：${body.topic}\n` : ''}內容：
${input}

請依「話題性、衝擊性、知識量、大眾性、帳號契合性、簡易性」六大標準逐項分析。每一項都要寫：
- **評分（1–5）**
- 原因（引用內容中的具體句子）
- 改善方式（直接示範改寫）
最後給：
### 前三秒開頭（3 個版本）
### 標題建議（3 個）
### 文案與 CTA 優化
### 留言互動問題（2 個）
### 延伸主題（3 個）
### 合規檢查（是否有食品減重功效等不能寫的說法；沒有就寫「未發現」）`}],
      };
    case 'postPerformance':
      return {
        label: '內容數據分析',
        system: `${BASE}\n\n${ctx}${postsBlock(data)}${historyBlock(data)}`,
        messages: [{ role: 'user', content: `請根據我已輸入的內容數據分析表現。${input ? `\n我想特別知道：${input}` : ''}
規則：篇數少於 5 篇、或關鍵數據（觀看、分享、收藏）多數未填時，必須明確說明「資料不足，不能下結論」，只給暫時的觀察與需要補的資料。
請回覆：
### 資料是否足夠
### 表現較好的內容與可能原因
### 表現較弱的內容與可能原因
### 下一篇內容建議（主題、形式、開頭）`}],
      };
    case 'finance':
      return {
        label: '財務建議',
        system: `${BASE}\n\n${profileBlock(settings, data)}${financeBlock(data, settings)}${historyBlock(data)}`,
        messages: [{ role: 'user', content: `請依我的真實收支給我財務建議。${input ? `\n我的問題：${input}` : ''}
優先順序：必要生活費 → 所有最低應繳 → 基本緊急預備金 → 依我選的策略分配額外還款或存錢。
若收支資料不足，請明確說明，不要假設。
請回覆：
### 目前狀況（只用已記錄數字）
### 風險提醒
### 本月建議的分配（具體金額需在可用餘額範圍內）
### 策略建議（說明為何適合或不適合我目前的情況）
### 下一步（最多三項）`}],
      };
    case 'journal':
      return {
        label: '日記反思',
        system: `${BASE}\n\n${ctx}${historyBlock(data)}`,
        messages: [{ role: 'user', content: `這是我今天的日記：
${input}

請回覆：
### 我從你的日記看到的
### 3 個反思問題
### 一個具體、今天或明天就能做的小建議`}],
      };
    case 'weekly':
    case 'monthly':
      return {
        label: kind === 'weekly' ? '每週覆盤' : '每月覆盤',
        system: `${BASE}\n\n${profileBlock(settings, data)}${historyBlock(data)}`,
        messages: [{ role: 'user', content: `以下是系統根據我已記錄資料整理的${kind === 'weekly' ? '本週' : '本月'}統計（JSON）。標示為 null 或在 missing 清單中的項目代表沒有資料，不可推測。
${JSON.stringify(body.stats)}
${input ? `我的補充：${input}` : ''}

請回覆：
### 整體觀察
### 做得好的事
### 主要問題
### ${kind === 'weekly' ? '下週建議（最多三項）' : '目標與實際的差距，以及下個月的調整建議'}
### 資料不足之處`}],
      };
    default:
      return null;
  }
}

export async function runAi(kind, body, data, settings) {
  const spec = build(kind, body, data, { ...DEFAULT_SETTINGS, ...settings });
  if (!spec) throw Object.assign(new Error('不支援的 AI 功能'), { status: 400 });
  const params = {
    model: AI_MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: spec.system,
    messages: spec.messages,
  };
  // 安全分類器拒答時，由伺服器端自動改用建議的備援模型（可用 AI_FALLBACKS=off 關閉）
  const useFallback = process.env.AI_FALLBACKS !== 'off';
  let res;
  try {
    res = useFallback
      ? await getClient().beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await getClient().messages.create(params);
  } catch (err) {
    // 若帳號不支援備援參數（400），改用一般呼叫重試一次
    if (!useFallback || !(err instanceof Anthropic.BadRequestError)) throw err;
    console.warn('[AI] 備援參數不被接受，改用一般呼叫：', err.message);
    res = await getClient().messages.create(params);
  }
  if (res.stop_reason === 'refusal') {
    throw Object.assign(new Error('AI 這次無法回覆這個內容，請換個方式描述再試一次。'), { status: 422 });
  }
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) throw Object.assign(new Error('AI 沒有回傳內容，請再試一次。'), { status: 502 });
  return { label: spec.label, text: res.stop_reason === 'max_tokens' ? text + '\n\n（回覆過長被截斷）' : text, model: res.model };
}

// 把 SDK 錯誤轉成清楚的中文訊息
export function aiErrorMessage(err) {
  if (err instanceof Anthropic.AuthenticationError) return { status: 500, message: 'AI 金鑰無效，請檢查伺服器的 ANTHROPIC_API_KEY 設定。' };
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: 'AI 使用量暫時達到上限，請稍等一分鐘再試。' };
  if (err instanceof Anthropic.APIConnectionError) return { status: 502, message: '無法連線到 AI 服務，請檢查網路後再試。' };
  if (err instanceof Anthropic.APIError) return { status: 502, message: `AI 服務回傳錯誤（${err.status ?? '未知'}），請稍後再試。` };
  return { status: err.status || 500, message: err.message || 'AI 發生未知錯誤' };
}

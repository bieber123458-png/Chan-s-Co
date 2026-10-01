// AI 功能（伺服器版）：用 API 金鑰呼叫 Claude；金鑰只從環境變數讀取
import Anthropic from '@anthropic-ai/sdk';
import { build } from '../src/lib/prompts.js';

export { build };
export const AI_MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

let client = null;
const getClient = () => (client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

export async function runAi(kind, body, data, settings) {
  const spec = build(kind, body, data, settings);
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

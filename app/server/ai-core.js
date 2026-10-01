// AI 呼叫核心（伺服器版與 Cloudflare 版共用）
// 不直接 import SDK，由呼叫端把 Anthropic 類別傳進來，讓兩邊各自打包自己的套件
import { build } from '../src/lib/prompts.js';

export function createAi({ Anthropic, apiKey, model = 'claude-opus-5-5', fallbacks = true }) {
  let client = null;
  const getClient = () => (client ||= new Anthropic({ apiKey }));

  async function runAi(kind, body, data, settings) {
    const spec = build(kind, body, data, settings);
    if (!spec) throw Object.assign(new Error('不支援的 AI 功能'), { status: 400 });
    const params = {
      model,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: spec.system,
      messages: spec.messages,
    };
    // 安全分類器拒答時，由 API 自動改用建議的備援模型
    let res;
    try {
      res = fallbacks
        ? await getClient().beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
        : await getClient().messages.create(params);
    } catch (err) {
      // 若帳號不支援備援參數（400），改用一般呼叫重試一次
      if (!fallbacks || !(err instanceof Anthropic.BadRequestError)) throw err;
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
  function aiErrorMessage(err) {
    if (err instanceof Anthropic.AuthenticationError) return { status: 500, message: 'AI 金鑰無效，請檢查 ANTHROPIC_API_KEY 設定。' };
    if (err instanceof Anthropic.RateLimitError) return { status: 429, message: 'AI 使用量暫時達到上限，請稍等一分鐘再試。' };
    if (err instanceof Anthropic.APIConnectionError) return { status: 502, message: '無法連線到 AI 服務，請檢查網路後再試。' };
    if (err instanceof Anthropic.APIError) return { status: 502, message: `AI 服務回傳錯誤（${err.status ?? '未知'}），請稍後再試。` };
    return { status: err.status || 500, message: err.message || 'AI 發生未知錯誤' };
  }

  return { runAi, aiErrorMessage, configured: !!apiKey, model };
}

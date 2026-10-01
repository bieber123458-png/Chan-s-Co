// AI 功能（伺服器版）：用 API 金鑰呼叫 Claude；金鑰只從環境變數讀取
import Anthropic from '@anthropic-ai/sdk';
import { build } from '../src/lib/prompts.js';
import { createAi } from './ai-core.js';

export { build };
export const AI_MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

let ai = null;
const get = () => (ai ||= createAi({ Anthropic, apiKey: process.env.ANTHROPIC_API_KEY, model: AI_MODEL, fallbacks: process.env.AI_FALLBACKS !== 'off' }));

export const runAi = (...args) => get().runAi(...args);
export const aiErrorMessage = (err) => get().aiErrorMessage(err);

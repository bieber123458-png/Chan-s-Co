import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../server/ai.js';
import { buildCarousel, buildStoryFrames } from '../src/lib/copy.js';

const data = {
  tasks: [], aiHistory: [], posts: [], debts: [], debtPayments: [], savingsGoals: [], deposits: [], transactions: [],
  igSnapshots: [{ date: '2026-10-01', followers: 8355 }],
  stories: [{ date: '2026-10-01', type: 'opinion', status: 'posted', firstViews: 1086, lastViews: 700, interactions: 5, sticker: '投票', hook: '我該回越南了' }],
};

test('每一種 AI 功能都能組出提示詞', () => {
  const cases = {
    copywrite: { framework: 'review', format: 'Reels 腳本', topic: '防曬', sections: [{ role: '先講缺點', text: '' }] },
    carousel: { style: 'teach', topic: '美業工具', pages: buildCarousel(6, 'teach') },
    storyPlan: { type: 'opinion', topic: '防曬', frames: buildStoryFrames('opinion') },
    storyPerformance: {},
    coach: { mode: 'story', input: '限動沒人回' },
    contentAnalyze: { input: '測試內容' },
  };
  for (const [kind, body] of Object.entries(cases)) {
    const spec = build(kind, body, data, { startDate: '2026-10-01', igHandle: 'chan1201_' });
    assert.ok(spec, kind);
    assert.ok(spec.system.length > 100 && spec.messages.at(-1).content.length > 10, kind);
  }
  const story = build('storyPerformance', {}, data, {});
  assert.match(story.system, /我該回越南了/);
  assert.match(story.system, /粉絲 8355/);
  assert.match(build('copywrite', cases.copywrite, data, {}).messages[0].content, /纖體/);
});

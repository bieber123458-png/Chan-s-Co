// 30 天經營計畫：預設範本產生器與日期工具（前後端共用）
// 這只是「可編輯的預設計畫」，不是使用者的實際紀錄。

export const CATEGORIES = {
  brand: { name: '個人品牌', icon: '✦' },
  ig: { name: 'IG 內容', icon: '◎' },
  retail: { name: '零售業績', icon: '◇' },
  team: { name: '團隊經營', icon: '❖' },
  finance: { name: '財務', icon: '＄' },
  life: { name: '生活與自我成長', icon: '❀' },
};

export const PRIORITIES = {
  high: { name: '重要', points: 15, rank: 0 },
  mid: { name: '一般', points: 10, rank: 1 },
  low: { name: '輕鬆', points: 5, rank: 2 },
};

export const TOTAL_DAYS = 30;

// ---------- 日期工具（一律使用本地日期字串 YYYY-MM-DD） ----------
export function toDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}
export function diffDays(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}
export const dateOfDay = (startDate, day) => addDays(startDate, day - 1);
// 今天是第幾天（未開始為 0，結束後可能大於 30）
export const dayOfDate = (startDate, date = toDateStr()) => diffDays(startDate, date) + 1;

// ---------- 預設內容主題 ----------
const REELS_TOPICS = [
  ['美業新手最常犯的 3 個經營錯誤', '美業經營錯誤'],
  ['客人為什麼選擇你，而不是隔壁那家', '客人為何選擇你'],
  ['IG 首頁 3 秒定位檢查：陌生人看得懂你在做什麼嗎', 'IG 首頁定位'],
  ['限動這樣發，才不會只有朋友在看', '限動經營'],
  ['價目表這樣寫，客人比較不會只問價錢', '價目表'],
  ['我的故事：從護理師到美業經營者', '個人故事'],
  ['客人說「我考慮一下」時，你可以怎麼回', '成交溝通'],
  ['為什麼你很努力發文，卻沒有人來詢問', '美業經營錯誤'],
  ['美業經營思維：先賣信任，再賣服務', '經營思維'],
  ['留言關鍵字，免費領取價目表模板', '免費模板導流'],
  ['美業人最該停止的 3 個習慣', '經營思維'],
  ['我曾經做錯的決定，以及我學到的事', '個人故事'],
  ['30 天經營心得總整理', '個人故事'],
];
const CAROUSEL_TOPICS = [
  ['IG 首頁定位檢查清單（6 項）', 'IG 首頁定位'],
  ['價目表設計 5 個原則＋免費模板', '免費模板導流'],
  ['限動經營一週排程範例', '限動經營'],
  ['成交溝通：從詢問到預約的 4 個步驟', '成交溝通'],
  ['美業經營錯誤 TOP 7', '美業經營錯誤'],
  ['客人選擇你的 5 個理由，你具備幾個', '客人為何選擇你'],
  ['經營思維：定價不是越低越好', '經營思維'],
  ['免費模板：美業內容企劃表', '免費模板導流'],
];
const RETAIL = [
  ['整理婕樂纖客戶名單，依「回購期、詢問中、新客」分類', 'mid', 30],
  ['主動關心 3 位既有客戶的使用狀況（不推銷，先聽回饋）', 'high', 20],
  ['發一則真實的產品使用心得限動', 'mid', 15],
  ['跟進 2 位曾詢問過的潛在客戶', 'high', 20],
  ['記錄本週零售訂單、成本與毛利', 'mid', 15],
  ['分享一則客戶回饋（已取得客戶同意）', 'low', 10],
];
const TEAM_TRAINING = ['產品知識與正確說明方式', '分享話術與避免過度推銷', '用社群經營零售', '客戶跟進與服務', '30 天成果回顧與下月目標'];

const t = (day, category, title, priority = 'mid', estMinutes = 20, goal = '', description = '') => ({
  day, category, title, priority, estMinutes, goal, description,
  points: PRIORITIES[priority].points,
});

// 產生預設 30 天任務（每週約 3 支 Reels、2 篇輪播，第 7 天為休息日）
export function generateDefaultPlan() {
  const tasks = [];
  let reel = 0;
  let carousel = 0;
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const d = ((day - 1) % 7) + 1; // 週內第幾天
    const week = Math.floor((day - 1) / 7);
    const isLast = day === TOTAL_DAYS;

    // IG 內容
    if ([1, 4, 6].includes(d) || isLast) {
      const [title, theme] = REELS_TOPICS[reel % REELS_TOPICS.length];
      reel++;
      tasks.push(t(day, 'ig', `發布 Reels：${title}`, 'high', 60, '前三秒說出痛點，結尾放一個留言互動問題', `主題分類：${theme}`));
    } else if ([3, 5].includes(d)) {
      const [title, theme] = CAROUSEL_TOPICS[carousel % CAROUSEL_TOPICS.length];
      carousel++;
      tasks.push(t(day, 'ig', `發布輪播：${title}`, 'high', 60, '每頁一個重點，最後一頁放收藏/分享提醒', `主題分類：${theme}`));
    } else if (d === 2) {
      tasks.push(t(day, 'ig', '拍攝與寫腳本：準備本週 2 支 Reels 素材', 'high', 90, '完成 2 支腳本與拍攝'));
    }
    if (d !== 7) tasks.push(t(day, 'ig', '回覆留言與私訊 15 分鐘', 'low', 15, '每則留言都回，並追問一句'));

    // 個人品牌
    if (d === 2) tasks.push(t(day, 'brand', '研究 3 個同領域帳號的高表現內容，記下開頭與標題寫法', 'mid', 30));
    if (d === 5) tasks.push(t(day, 'brand', '數據分析：把本週每篇內容的數據填進「社群內容」', 'mid', 20, '找出表現最好與最差的一篇'));
    if (d === 3 && week === 0) tasks.push(t(day, 'brand', '檢查並更新 IG 首頁簡介與精選限動', 'high', 40, '陌生人 3 秒內看懂你是誰、能幫他什麼'));
    if (d === 3 && week === 1) tasks.push(t(day, 'brand', '整理免費模板與領取方式（導流連結）', 'mid', 40));
    if (d === 3 && week >= 2) tasks.push(t(day, 'brand', '記錄一個可以分享的個人故事素材', 'low', 15));

    // 零售
    if (d <= 6) {
      const [title, pr, min] = RETAIL[d - 1];
      tasks.push(t(day, 'retail', title, pr, min));
    }

    // 團隊
    if (d === 2) tasks.push(t(day, 'team', `團隊培訓：${TEAM_TRAINING[Math.min(week, TEAM_TRAINING.length - 1)]}`, 'high', 60));
    if (d === 4) tasks.push(t(day, 'team', '夥伴追蹤：關心 3 位夥伴本週進度與卡關點', 'mid', 30));
    if (d === 6) tasks.push(t(day, 'team', '招募：與 1 位有興趣的人深入聊聊（先了解對方需求）', 'mid', 30));
    if (d === 7) tasks.push(t(day, 'team', '更新團隊人數、活躍夥伴與新增夥伴紀錄', 'low', 10));

    // 財務
    tasks.push(t(day, 'finance', '記錄今日收支（5 分鐘）', 'low', 5));
    if (d === 5) tasks.push(t(day, 'finance', '存錢：轉入存錢帳戶並記錄', 'mid', 10));
    if (d === 7) tasks.push(t(day, 'finance', '檢查本週帳單、繳款日與還款紀錄', 'mid', 15));

    // 生活與自我成長
    tasks.push(t(day, 'life', '完成今日習慣紀錄（運動、喝水、睡眠、心情）', 'low', 5));
    if (d === 7) tasks.push(t(day, 'life', '休息日：做一件讓自己真正放鬆的事', 'low', 60));
    else if (d % 2 === 1) tasks.push(t(day, 'life', '閱讀 20 分鐘，寫下一句可以用在經營上的想法', 'low', 20));
    else tasks.push(t(day, 'life', '散步或伸展 20 分鐘', 'low', 20));
  }
  return tasks.map((task, i) => ({
    ...task,
    id: `plan-${task.day}-${i}`,
    done: false, result: '', minutes: '', reflection: '',
  }));
}

// 沒動力模式：挑 1～3 個「最重要且容易完成」的任務
// 先挑一件最重要的事中最省時的一件，再補上最容易完成的小任務
export function pickEssentialTasks(tasks) {
  const open = tasks.filter((x) => !x.done);
  const mins = (x) => Number(x.estMinutes) || 30;
  const rank = (x) => PRIORITIES[x.priority]?.rank ?? 1;
  const byImportance = [...open].sort((a, b) => rank(a) - rank(b) || mins(a) - mins(b));
  const picked = byImportance.slice(0, 1);
  const rest = open.filter((x) => !picked.includes(x)).sort((a, b) => mins(a) - mins(b) || rank(a) - rank(b));
  return [...picked, ...rest.slice(0, 2)];
}

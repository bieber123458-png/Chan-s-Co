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
// 依 @chan1201_ 的實際數據規劃三條內容線：
// 美業經營（專業與團隊招募）、減脂日常系列（互動最強）、接軌主題（吃東西流量 → 認識美業的你）
export const PLAN_VERSION = 2;

const COMPLIANCE = '合規提醒：重點放在作息、飲食與運動習慣；不要把產品和公斤數放在同一句，不寫「吃了就瘦」「纖體」等減重功效。';
const FOLLOW_CTA = '結尾說出下一集要講什麼，給觀眾追蹤的理由';

const BEAUTY_REELS = [
  ['美業人是不是都這樣（續集）：3 個最常見的經營卡關', '美業經營錯誤'],
  ['扣除成本還剩多少？我怎麼算霧唇的真實利潤', '經營思維'],
  ['客人說「我考慮一下」時，你可以怎麼回', '成交溝通'],
  ['我自己做霧唇時踩過的坑，讓你少走一年冤枉路', '個人故事'],
  ['價目表這樣寫，客人比較不會只問價錢', '價目表'],
];
const DIET_REELS = [
  '72→57kg 第 1 集：我現在一天都吃什麼',
  '72→57kg 第 2 集：停滯期我是怎麼撐過去的',
  '72→57kg 第 3 集：外食族減脂點餐法',
  '72→57kg 第 4 集：我不再跟體重計吵架的心態轉變',
  '72→57kg 第 5 集：減脂後最大的改變不是體重',
];
const BRIDGE_REELS = [
  '霧唇師收工後吃什麼？忙到沒時間的減脂晚餐',
  '一邊經營美業一邊減脂：我的一天',
  '做美業久坐一整天，我怎麼安排活動量',
  '出去玩也不破功：我旅行時的吃法',
  '邊減脂邊創業，我最大的改變',
];
const BEAUTY_CAROUSELS = [
  ['美業人必備 6 個工具（六宮格完整版）', '免費模板導流'],
  ['價目表設計 5 個原則＋免費模板', '價目表'],
  ['成交溝通：從詢問到預約的 4 個步驟', '成交溝通'],
];
const DIET_CAROUSELS = [
  '台中外食減脂便當清單（收藏起來）',
  '超商減脂組合 10 種',
  '減脂期也能吃的 5 道家常菜',
  '我的一週減脂菜單',
];
const STORY_STICKERS = ['投票：今天晚餐吃 A 還是 B', '問答：問我任何減脂或美業問題', '測驗：猜猜這道菜幾大卡', '表情滑桿：你今天的工作累度', '投票：下一集想看什麼'];

const RETAIL = [
  ['整理婕樂纖客戶名單，依「回購期、詢問中、新客」分類', 'mid', 30, '', ''],
  ['主動關心 3 位既有客戶的使用狀況（不推銷，先聽回饋）', 'high', 20, '', ''],
  ['發一則「真實評價」式產品限動：先講缺點或不適合誰，再講為什麼你還在用', 'mid', 15, '用「宣判無效」那種說真話的語氣', COMPLIANCE],
  ['跟進 2 位曾詢問過的潛在客戶', 'high', 20, '', ''],
  ['記錄本週零售訂單、成本與毛利', 'mid', 15, '', ''],
  ['分享一則客戶回饋（已取得客戶同意，不寫減重數字）', 'low', 10, '', COMPLIANCE],
];
const TEAM_TRAINING = ['產品知識與正確說明方式（含食品廣告不能說的話）', '分享話術與避免過度推銷', '用社群經營零售：真實評價式限動', '客戶跟進與服務', '30 天成果回顧與下月目標'];

const t = (day, category, title, priority = 'mid', estMinutes = 20, goal = '', description = '') => ({
  day, category, title, priority, estMinutes, goal, description,
  points: PRIORITIES[priority].points,
});

// 產生預設 30 天任務：每週 3 支 Reels（美業／減脂系列／接軌）、2 篇輪播（美業工具／減脂收藏），第 7 天休息
export function generateDefaultPlan() {
  const tasks = [];
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const d = ((day - 1) % 7) + 1; // 週內第幾天
    const week = Math.floor((day - 1) / 7);

    // IG 內容
    if (d === 1) {
      const [title, theme] = BEAUTY_REELS[week % BEAUTY_REELS.length];
      tasks.push(t(day, 'ig', `發布 Reels（美業經營）：${title}`, 'high', 60, '前三秒說出美業人的共同痛點，結尾放一個留言互動問題', `主題分類：${theme}`));
    } else if (d === 4) {
      tasks.push(t(day, 'ig', `發布 Reels（減脂系列）：${DIET_REELS[week % DIET_REELS.length]}`, 'high', 60, FOLLOW_CTA, `主題分類：減脂日常。${COMPLIANCE}`));
    } else if (d === 6 || day === TOTAL_DAYS) {
      tasks.push(t(day, 'ig', `發布 Reels（接軌主題）：${BRIDGE_REELS[week % BRIDGE_REELS.length]}`, 'high', 60, '用吃東西／生活畫面吸引人，帶出「我是美業霧唇師」的身份', `主題分類：接軌。${COMPLIANCE}`));
    } else if (d === 3) {
      const [title, theme] = BEAUTY_CAROUSELS[week % BEAUTY_CAROUSELS.length];
      tasks.push(t(day, 'ig', `發布輪播（美業工具）：${title}`, 'high', 60, '每頁一個重點，最後一頁提醒收藏並說明免費領取方式', `主題分類：${theme}`));
    } else if (d === 5) {
      tasks.push(t(day, 'ig', `發布輪播（減脂收藏）：${DIET_CAROUSELS[week % DIET_CAROUSELS.length]}`, 'high', 60, '做成讓人想收藏的清單，最後一頁放追蹤理由', `主題分類：減脂日常。${COMPLIANCE}`));
    } else if (d === 2) {
      tasks.push(t(day, 'ig', '拍攝與寫腳本：本週減脂系列＋接軌主題 2 支 Reels', 'high', 90, '完成 2 支腳本與拍攝，每支都想好「下一集預告」'));
    }
    if (d !== 7) {
      tasks.push(t(day, 'ig', `限動加互動貼紙：${STORY_STICKERS[(day - 1) % STORY_STICKERS.length]}`, 'mid', 10, '目標互動數 ≥ 35（約限動瀏覽的 5%）', '你的限動平均約 730 次瀏覽，但按讚和回覆幾乎是 0；互動貼紙能讓看的人動一下手指。到「限動經營」規劃這組限動，24 小時後回來填數據。'));
      tasks.push(t(day, 'ig', '回覆留言與私訊 15 分鐘', 'low', 15, '每則留言都回，並追問一句'));
    }

    // 個人品牌
    if (day === 1) tasks.push(t(day, 'brand', '簡介補一行：「72→57kg 減脂日常」，讓吃東西影片進來的人知道為什麼要追蹤', 'high', 15, '陌生人 3 秒內看懂：美業經營＋減脂日常'));
    if (day === 2) tasks.push(t(day, 'brand', '檢查置頂與精選限動的用詞（「吃完產品後一個半月 -5kg」「3 天 ko 2 公斤」）', 'high', 30, '把公斤數和產品分開，改成習慣與過程的說法', COMPLIANCE));
    if (d === 2 && week >= 1) tasks.push(t(day, 'brand', '研究 3 個同領域帳號的高表現內容，記下開頭與標題寫法', 'mid', 30));
    if (d === 5) tasks.push(t(day, 'brand', '數據分析：洞察報告依「追蹤人數」排序，記錄本週帶來最多追蹤的一篇', 'mid', 20, '把每篇 Reels 與限動的數據填進「社群內容」'));
    if (d === 3 && week === 1) tasks.push(t(day, 'brand', '整理免費模板與領取方式（六宮格的導流連結）', 'mid', 40));
    if (d === 3 && week >= 2) tasks.push(t(day, 'brand', '記錄一個可以分享的個人故事素材', 'low', 15));

    // 零售
    if (d <= 6) {
      const [title, pr, min, goal, desc] = RETAIL[d - 1];
      tasks.push(t(day, 'retail', title, pr, min, goal, desc));
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
    id: `plan${PLAN_VERSION}-${task.day}-${i}`,
    planVersion: PLAN_VERSION,
    done: false, result: '', minutes: '', reflection: '',
  }));
}

// 套用新版計畫：保留已完成或有紀錄的任務、保留今天以前的任務，只替換「今天起尚未開始」的任務
export function planUpgrade(existing, fromDay) {
  const untouched = (x) => !x.done && !x.result && !x.reflection;
  const removeIds = existing.filter((x) => x.day >= fromDay && untouched(x)).map((x) => x.id);
  const kept = existing.filter((x) => !removeIds.includes(x.id));
  // 「發布 Reels（美業經營）：…」與舊版「發布 Reels：…」視為同一類，同一天已保留就不再新增
  const slot = (title) => (/^發布/.test(title) ? title.split('：')[0].replace(/（.*?）/g, '') : title);
  const keptKeys = new Set(kept.map((x) => `${x.day}|${slot(x.title)}`));
  const add = generateDefaultPlan().filter((x) => x.day >= fromDay && !keptKeys.has(`${x.day}|${slot(x.title)}`));
  return { removeIds, add };
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

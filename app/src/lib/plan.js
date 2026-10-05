// 每月經營計畫：預設範本產生器與日期工具（前後端共用）
// 「一個月」從使用者設定的開始日起算，例如 10/15～11/14。
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
// 從開始日算第幾天（未開始為 0 或負數）
export const dayOfDate = (startDate, date = toDateStr()) => diffDays(startDate, date) + 1;

// 加 n 個月；遇到月底自動調整（1/31 加一個月 → 2/28）
export function addMonths(s, n) {
  const d = parseDate(s);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toDateStr(target);
}

// 第 index 個月（從 0 起算）的期間
export function cycleRange(startDate, index) {
  const start = addMonths(startDate, index);
  const end = addDays(addMonths(startDate, index + 1), -1);
  return { index, start, end, length: diffDays(start, end) + 1 };
}

// 某一天屬於第幾個月、是那個月的第幾天；開始日之前回傳 index -1
export function cycleOf(startDate, date = toDateStr()) {
  if (date < startDate) return { ...cycleRange(startDate, 0), index: -1, day: dayOfDate(startDate, date) };
  let i = Math.max(0, (parseDate(date).getFullYear() - parseDate(startDate).getFullYear()) * 12
    + parseDate(date).getMonth() - parseDate(startDate).getMonth() - 1);
  while (addMonths(startDate, i + 1) <= date) i++;
  const r = cycleRange(startDate, i);
  return { ...r, day: diffDays(r.start, date) + 1 };
}

// 任務的日期（舊資料只有「第幾天」，用開始日換算）
export const taskDate = (task, startDate) => task.date || (startDate && task.day ? dateOfDay(startDate, task.day) : '');

// ---------- 預設內容主題 ----------
// 依 @chan1201_ 的實際數據規劃三條內容線：
// 減脂料理（最容易被收藏分享、帶新觀眾）、減脂日常系列（互動最強）、生活日常（讓人認識你）；賣貨用真實評價的方式自然帶到
export const PLAN_VERSION = 4;

const COMPLIANCE = '合規提醒：重點放在作息、飲食與運動習慣；不要把產品和公斤數放在同一句，不寫「吃了就瘦」「纖體」等減重功效。';
const FOLLOW_CTA = '結尾說出下一集要講什麼，給觀眾追蹤的理由';
const REACH = '提高觸及：第 1 秒就給畫面＋字卡標題，文案第一行寫關鍵字，發布後 30 分鐘內回覆留言並分享到限動。';

// 減脂料理：最容易被收藏、分享，是帶新觀眾進來的主力
const RECIPE_REELS = [
  '15 分鐘雞胸肉料理，不柴的祕訣',
  '電鍋一鍋到底的減脂便當',
  '350 大卡的韓式拌飯，吃完很飽',
  '氣炸鍋版炸物，減脂也能吃',
  '週日備餐 1 小時，搞定 5 天便當',
  '超商買得到的食材，變身減脂晚餐',
  '不用烤箱的減脂甜點：優格杯',
  '蛋料理 3 吃，早餐一週不重複',
  '豆腐取代白飯的低卡吃法',
  '減脂火鍋：湯底怎麼選＋自煮版',
];
// 減脂日常系列：集數依順序自動編號
const DIET_REELS = [
  '我現在一天都吃什麼',
  '停滯期我是怎麼撐過去的',
  '外食族減脂點餐法',
  '我不再跟體重計吵架的心態轉變',
  '減脂後最大的改變不是體重',
  '忙到沒空煮，我的超商組合',
  '聚餐、旅行怎麼吃才不會破功',
  '我怎麼安排運動，才不會三天打魚',
  '減脂期的嘴饞怎麼辦',
  '睡眠和壓力，比你想的更影響體重',
];
// 生活日常：讓人認識你、喜歡你，願意一直看下去
const LIFE_REELS = [
  '我的一天：從早餐到睡前都吃什麼',
  '週末市場買菜 vlog',
  '跟貓一起的居家日常',
  '出去玩也不破功：我旅行時的吃法',
  '下班後的放鬆儀式',
  '我的包包裡都放什麼',
  '一個人的早午餐約會',
  '整理冰箱：減脂冰箱長這樣',
  '大家最常問我的私人問題，一次回答',
  '我怎麼在忙碌中留時間給自己',
];
const RECIPE_CAROUSELS = [
  '5 道 15 分鐘減脂晚餐（食譜卡）',
  '電鍋減脂料理 6 道，懶人也做得到',
  '一週減脂便當菜單＋採買清單',
  '減脂調味料怎麼選（收藏起來）',
  '減脂早餐 7 天不重複',
  '氣炸鍋減脂料理 5 道',
  '嘴饞時可以吃的減脂零食清單',
];
const DIET_CAROUSELS = [
  '台中外食減脂便當清單（收藏起來）',
  '超商減脂組合 10 種',
  '減脂期也能吃的 5 道家常菜',
  '我的一週減脂菜單',
  '減脂期飲料怎麼點',
  '外食族一週便當輪替表',
  '停滯期自我檢查清單',
  '我的減脂好物與用法（真實評價）',
];
const STORY_STICKERS = ['投票：今天晚餐吃 A 還是 B', '問答：問我任何減脂或料理問題', '測驗：猜猜這道菜幾大卡', '表情滑桿：你今天想吃炸物的程度', '投票：下一集想看什麼'];

const RETAIL = [
  ['整理婕樂纖客戶名單，依「回購期、詢問中、新客」分類', 'mid', 30, '', ''],
  ['主動關心 3 位既有客戶的使用狀況（不推銷，先聽回饋）', 'high', 20, '', ''],
  ['發一則「真實評價」式產品限動：先講缺點或不適合誰，再講為什麼你還在用', 'mid', 15, '用「宣判無效」那種說真話的語氣', COMPLIANCE],
  ['跟進 2 位曾詢問過的潛在客戶', 'high', 20, '', ''],
  ['記錄本週零售訂單、成本與毛利', 'mid', 15, '', ''],
  ['分享一則客戶回饋（已取得客戶同意，不寫減重數字）', 'low', 10, '', COMPLIANCE],
];
const TEAM_TRAINING = ['產品知識與正確說明方式（含食品廣告不能說的話）', '分享話術與避免過度推銷', '用社群經營零售：真實評價式限動', '客戶跟進與服務', '夥伴成果分享與下月目標'];

const t = (day, category, title, priority = 'mid', estMinutes = 20, goal = '', description = '') => ({
  day, category, title, priority, estMinutes, goal, description,
  points: PRIORITIES[priority].points,
});

// 產生一個月的預設任務：每週 3 支 Reels（減脂料理／減脂日常系列／生活日常）、2 篇輪播（食譜卡／減脂收藏），第 7 天休息
// start：這個月的第一天；length：這個月有幾天；monthIndex：第幾個月（0 起算，用來輪替主題）
export function generateMonthPlan({ start = toDateStr(), length = 30, monthIndex = 0 } = {}) {
  const tasks = [];
  const first = monthIndex === 0;
  for (let day = 1; day <= length; day++) {
    const d = ((day - 1) % 7) + 1; // 週內第幾天
    const week = Math.floor((day - 1) / 7) + monthIndex * 5; // 跨月延續，主題不重複

    // IG 內容：每週 3 支 Reels（減脂料理／減脂日常系列／生活日常）、2 篇輪播（食譜卡／減脂收藏清單）
    if (d === 1) {
      tasks.push(t(day, 'ig', `發布 Reels（減脂料理）：${RECIPE_REELS[week % RECIPE_REELS.length]}`, 'high', 60, '第 1 秒先放成品＋字卡標題（例如「350 大卡吃很飽」），步驟 3～5 個，結尾提醒收藏', `主題分類：減脂料理。料理影片最容易被收藏和分享，這兩個數字越高，IG 越會推給還沒追蹤你的人。${REACH}`));
    } else if (d === 4) {
      tasks.push(t(day, 'ig', `發布 Reels（減脂系列）：72→57kg 第 ${week + 1} 集・${DIET_REELS[week % DIET_REELS.length]}`, 'high', 60, FOLLOW_CTA, `主題分類：減脂日常。${REACH}${COMPLIANCE}`));
    } else if (d === 6 || day === length) {
      tasks.push(t(day, 'ig', `發布 Reels（生活日常）：${LIFE_REELS[week % LIFE_REELS.length]}`, 'high', 60, '真實的生活畫面＋一句心裡話，結尾問觀眾一個問題，讓人想留言', `主題分類：生活日常。${REACH}`));
    } else if (d === 3) {
      tasks.push(t(day, 'ig', `發布輪播（料理食譜卡）：${RECIPE_CAROUSELS[week % RECIPE_CAROUSELS.length]}`, 'high', 60, '做成看了就能照做的食譜卡，最後一頁提醒「先收藏」並「分享給一起減脂的朋友」', `主題分類：減脂料理。${REACH}`));
    } else if (d === 5) {
      tasks.push(t(day, 'ig', `發布輪播（減脂收藏）：${DIET_CAROUSELS[week % DIET_CAROUSELS.length]}`, 'high', 60, '做成讓人想收藏的清單，最後一頁放追蹤理由', `主題分類：減脂日常。${COMPLIANCE}`));
    } else if (d === 2) {
      tasks.push(t(day, 'ig', '拍攝與寫腳本：一次拍完本週 3 支 Reels（料理＋減脂系列＋生活）', 'high', 90, '每支都先想好第 1 秒的畫面和字卡，再想「下一集預告」'));
    }
    if (d !== 7) {
      tasks.push(t(day, 'ig', `限動加互動貼紙：${STORY_STICKERS[(day - 1) % STORY_STICKERS.length]}`, 'mid', 10, '目標互動數 ≥ 35（約限動瀏覽的 5%）', '你的限動平均約 730 次瀏覽，但按讚和回覆幾乎是 0；互動貼紙能讓看的人動一下手指。到「限動經營」規劃這組限動，24 小時後回來填數據。'));
      tasks.push(t(day, 'ig', '回覆留言與私訊 15 分鐘', 'low', 15, '每則留言都回，並追問一句（留言越多，觸及越好）'));
    }

    // 個人品牌與觸及
    if (first && day === 1) tasks.push(t(day, 'brand', '簡介改成：「減脂料理｜72→57kg 日常｜真實好物分享」，讓新觀眾 3 秒看懂為什麼要追蹤', 'high', 15, '陌生人 3 秒內看懂你分享什麼'));
    if (first && day === 2) tasks.push(t(day, 'brand', '檢查置頂與精選限動的用詞（「吃完產品後一個半月 -5kg」「3 天 ko 2 公斤」）', 'high', 30, '把公斤數和產品分開，改成習慣與過程的說法', COMPLIANCE));
    if (d === 2 && !(first && day <= 7)) tasks.push(t(day, 'brand', '研究 3 個減脂料理／生活帳號觸及最高的 Reels，記下第 1 秒畫面和標題寫法', 'mid', 30));
    if (d === 3) tasks.push(t(day, 'brand', '觸及練習：把關鍵字（例如「減脂便當」「雞胸肉料理」）寫進文案第一行，加 3～5 個精準 hashtag', 'mid', 10, '讓 IG 搜尋找得到你，不用放 30 個 hashtag'));
    if (d === 5) tasks.push(t(day, 'brand', '觸及檢查：到洞察報告看本週每篇的觸及、非粉絲比例、分享與收藏，填進「社群內容」', 'mid', 20, '找出本週觸及最高的一篇，下週照它的開頭和主題再做一支'));
    if (d === 6) tasks.push(t(day, 'brand', '找 1 個同類型帳號（料理／減脂／生活）真心留言互動，或邀請一起發合作貼文', 'low', 15, '合作貼文會同時出現在兩邊，是最快接觸新觀眾的方法'));

    // 零售
    if (d <= 6) {
      const [title, pr, min, goal, desc] = RETAIL[d - 1];
      tasks.push(t(day, 'retail', title, pr, min, goal, desc));
    }

    // 團隊
    if (d === 2) tasks.push(t(day, 'team', `團隊培訓：${TEAM_TRAINING[week % TEAM_TRAINING.length]}`, 'high', 60));
    if (d === 4) tasks.push(t(day, 'team', '夥伴追蹤：關心 3 位夥伴本週進度與卡關點', 'mid', 30));
    if (d === 6) tasks.push(t(day, 'team', '招募：與 1 位有興趣的人深入聊聊（先了解對方需求）', 'mid', 30));
    if (d === 7) tasks.push(t(day, 'team', '更新團隊人數、活躍夥伴與新增夥伴紀錄', 'low', 10));

    // 財務
    tasks.push(t(day, 'finance', '記錄今日收支（5 分鐘）', 'low', 5));
    if (d === 5) tasks.push(t(day, 'finance', '存錢：轉入存錢帳戶並記錄', 'mid', 10));
    if (d === 7) tasks.push(t(day, 'finance', '檢查本週帳單、繳款日與還款紀錄', 'mid', 15));

    // 生活與自我成長
    tasks.push(t(day, 'life', '完成今日習慣紀錄（運動、喝水、睡眠、心情）', 'low', 5));
    if (day === length) tasks.push(t(day, 'brand', '本月覆盤：到「每週／每月覆盤」看這個月的成果，並建立下個月計畫', 'high', 30, '寫下下個月最重要的 3 個目標'));
    if (d === 7) tasks.push(t(day, 'life', '休息日：做一件讓自己真正放鬆的事', 'low', 60));
    else if (d % 2 === 1) tasks.push(t(day, 'life', '閱讀 20 分鐘，寫下一句可以用在生活或經營上的想法', 'low', 20));
    else tasks.push(t(day, 'life', '散步或伸展 20 分鐘', 'low', 20));
  }
  return tasks.map((task, i) => ({
    ...task,
    date: addDays(start, task.day - 1),
    cycle: monthIndex,
    id: `m${monthIndex + 1}-${task.day}-${i}`,
    planVersion: PLAN_VERSION,
    done: false, result: '', minutes: '', reflection: '',
  }));
}

// 套用新版計畫：只替換這個月「從 fromDate 起、尚未開始」的任務；
// 已完成或有填寫紀錄的任務、fromDate 之前的任務都保留
export function planUpgrade(existing, fromDate, cycle, startDate) {
  const untouched = (x) => !x.done && !x.result && !x.reflection;
  const inCycle = (date) => date >= cycle.start && date <= cycle.end;
  const removeIds = existing
    .filter((x) => { const d = taskDate(x, startDate); return inCycle(d) && d >= fromDate && untouched(x); })
    .map((x) => x.id);
  const kept = existing.filter((x) => !removeIds.includes(x.id));
  // 「發布 Reels（減脂料理）：…」與舊版「發布 Reels：…」視為同一類，同一天已保留就不再新增
  const slot = (title) => (/^發布/.test(title) ? title.split('：')[0].replace(/（.*?）/g, '') : title);
  const keptKeys = new Set(kept.map((x) => `${taskDate(x, startDate)}|${slot(x.title)}`));
  const add = generateMonthPlan({ start: cycle.start, length: cycle.length, monthIndex: cycle.index })
    .filter((x) => x.date >= fromDate && !keptKeys.has(`${x.date}|${slot(x.title)}`));
  return { removeIds, add };
}

// 舊名稱相容：產生第一個月的計畫
export const generateDefaultPlan = (start = toDateStr()) => generateMonthPlan({ start, length: 30, monthIndex: 0 });

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

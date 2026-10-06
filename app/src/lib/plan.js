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
// 走「個人魅力」路線：用真實的日常讓人喜歡你、信任你，再自然帶到你在用的產品
// 四條線：今天吃什麼（早餐／晚餐）、開箱與好物、生活日常、產品介紹（賣貨）
export const PLAN_VERSION = 5;

const COMPLIANCE = '合規提醒：介紹產品時講你的使用情境和真實感受；不要把產品和公斤數放在同一句，不寫「吃了就瘦」「纖體」等減重功效。';
const REACH = '提高觸及：第 1 秒放你的臉或最吸睛的畫面＋一句字卡，文案第一行寫關鍵字，發布後 30 分鐘內回覆留言並分享到限動。';

// 今天吃什麼：不用教學，拍你真的吃的東西＋一句心情就好
const EAT_REELS = [
  '我今天早餐吃什麼',
  '下班後的晚餐，今天吃這個',
  '一個人的週末早午餐',
  '今天外食，我這樣點',
  '我的一天都吃什麼（早餐到晚餐）',
  '今天嘴饞，吃了這個',
  '跟朋友聚餐的一天',
  '超商隨手買的一餐',
  '今天自己煮，簡單就好',
  '旅行時的早餐',
];
// 開箱與好物：最近買的、最近愛用的
const UNBOX_REELS = [
  '開箱我最近買的東西',
  '最近愛用的 3 樣好物',
  '包包裡每天一定會帶的東西',
  '我的梳妝台／保養日常',
  '這個月花最值得的一筆',
  '網購踩雷 vs 回購，老實說',
  '家裡最常用的小物',
  '最近喝的、吃的，好喝好吃的都在這',
  '我的早晨儀式用品',
  '開箱：朋友送我的禮物',
];
// 生活日常：讓人認識你這個人
const LIFE_REELS = [
  '我的一天 vlog',
  '週末市場買菜的日常',
  '跟貓一起的居家日常',
  '下班後的放鬆儀式',
  '大家最常問我的私人問題，一次回答',
  '最近的心情和小確幸',
  '一個人的小旅行',
  '整理房間的一天',
  '72→57kg 這一路，我最大的改變',
  '我怎麼在忙碌中留時間給自己',
];
// 產品介紹：用生活情境帶出產品，讓人自己想問
const PRODUCT_POSTS = [
  '我每天早上怎麼用它（真實情境）',
  '忙到沒空吃飯的時候，我都這樣',
  '我為什麼開始用、為什麼還在用',
  '朋友最常問我的 3 個問題',
  '老實說：它不適合誰',
  '出門包包裡的那一包',
  '用了一陣子，我的真實感受',
];
const PHOTO_DUMPS = [
  '這週的生活照片日記',
  '最近吃到的好吃的',
  '週末碎片',
  '這個月的小確幸',
  '最近的穿搭和日常',
];
const STORY_STICKERS = ['投票：今天早餐吃 A 還是 B', '問答：問我任何事', '表情滑桿：今天心情幾分', '測驗：猜猜我今天開箱什麼', '投票：下一個想看我開箱什麼'];

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

// 產生一個月的預設任務：每週 3 支 Reels（今天吃什麼／開箱好物／生活日常）、照片日記與產品介紹，第 7 天休息
// start：這個月的第一天；length：這個月有幾天；monthIndex：第幾個月（0 起算，用來輪替主題）
export function generateMonthPlan({ start = toDateStr(), length = 30, monthIndex = 0 } = {}) {
  const tasks = [];
  const first = monthIndex === 0;
  for (let day = 1; day <= length; day++) {
    const d = ((day - 1) % 7) + 1; // 週內第幾天
    const week = Math.floor((day - 1) / 7) + monthIndex * 5; // 跨月延續，主題不重複

    // IG 內容：每週 3 支 Reels（今天吃什麼／開箱好物／生活日常）＋2 篇圖文（照片日記／產品介紹）
    if (d === 1) {
      tasks.push(t(day, 'ig', `發布 Reels（今天吃什麼）：${EAT_REELS[week % EAT_REELS.length]}`, 'high', 45, '拍你真的吃的東西，配一句當下的心情；結尾問觀眾「你們今天吃什麼？」', `主題分類：今天吃什麼。不用教學，真實就好。${REACH}`));
    } else if (d === 4) {
      tasks.push(t(day, 'ig', `發布 Reels（開箱好物）：${UNBOX_REELS[week % UNBOX_REELS.length]}`, 'high', 45, '拆開的第一眼反應最重要；講真心話，喜歡和不喜歡都可以說', `主題分類：開箱好物。${REACH}`));
    } else if (d === 6 || day === length) {
      tasks.push(t(day, 'ig', `發布 Reels（生活日常）：${LIFE_REELS[week % LIFE_REELS.length]}`, 'high', 45, '讓人看到你這個人：你的習慣、你的貓、你的小情緒；結尾問觀眾一個問題', `主題分類：生活日常。${REACH}`));
    } else if (d === 3) {
      tasks.push(t(day, 'ig', `發布照片日記（輪播）：${PHOTO_DUMPS[week % PHOTO_DUMPS.length]}`, 'mid', 30, '挑 5～10 張這週真實的生活照，每張配一句短短的心情', '主題分類：生活日常。不用排版、不用教學，照片和你的話就是重點。'));
    } else if (d === 5) {
      tasks.push(t(day, 'ig', `發布產品介紹：${PRODUCT_POSTS[week % PRODUCT_POSTS.length]}`, 'high', 40, '用你的生活畫面帶出產品：什麼時候用、怎麼用、真實感受；最後一句「想知道的私訊我」', `主題分類：產品介紹。${COMPLIANCE}`));
    } else if (d === 2) {
      tasks.push(t(day, 'ig', '隨手拍素材：今天的早餐、晚餐、好物、生活片段，各拍幾段', 'mid', 30, '不用一次拍好，生活中隨手錄，週末再剪'));
    }
    if (d !== 7) {
      tasks.push(t(day, 'ig', `限動加互動貼紙：${STORY_STICKERS[(day - 1) % STORY_STICKERS.length]}`, 'mid', 10, '目標互動數 ≥ 35（約限動瀏覽的 5%）', '你的限動平均約 730 次瀏覽，但按讚和回覆幾乎是 0；互動貼紙能讓看的人動一下手指。到「限動經營」規劃這組限動，24 小時後回來填數據。'));
      tasks.push(t(day, 'ig', '回覆留言與私訊 15 分鐘', 'low', 15, '每則留言都回，並追問一句（留言越多，觸及越好）'));
    }

    // 個人品牌與觸及
    if (first && day === 1) tasks.push(t(day, 'brand', '簡介改成：「72→57kg 的日常｜每天吃什麼｜真實好物開箱」，讓新觀眾 3 秒看懂你是誰', 'high', 15, '陌生人 3 秒內知道為什麼要追蹤你'));
    if (first && day === 2) tasks.push(t(day, 'brand', '檢查置頂與精選限動的用詞（「吃完產品後一個半月 -5kg」「3 天 ko 2 公斤」）', 'high', 30, '把公斤數和產品分開，改成習慣與過程的說法', COMPLIANCE));
    if (d === 2 && !(first && day <= 7)) tasks.push(t(day, 'brand', '看 3 個你喜歡的生活／個人風格帳號，記下他們第 1 秒的畫面和講話方式', 'mid', 20));
    if (d === 3) tasks.push(t(day, 'brand', '觸及練習：把關鍵字（例如「早餐吃什麼」「開箱」「減脂日常」）寫進文案第一行，加 3～5 個精準 hashtag', 'mid', 10, '讓 IG 搜尋找得到你，不用放 30 個 hashtag'));
    if (d === 5) tasks.push(t(day, 'brand', '觸及檢查：到洞察報告看本週每篇的觸及、非粉絲比例、分享與留言，填進「社群內容」', 'mid', 20, '找出本週觸及最高的一篇，下週照它的開頭和主題再做一支'));
    if (d === 6) tasks.push(t(day, 'brand', '找 1 個風格相近的生活帳號真心留言互動，或邀請一起發合作貼文', 'low', 15, '合作貼文會同時出現在兩邊，是最快接觸新觀眾的方法'));

    // 零售
    if (d <= 6) {
      const [title, pr, min, goal, desc] = RETAIL[d - 1];
      tasks.push(t(day, 'retail', title, pr, min, goal, desc));
    }

    // 團隊
    if (d === 2) tasks.push(t(day, 'team', `團隊培訓：${TEAM_TRAINING[week % TEAM_TRAINING.length]}`, 'high', 60));
    if (d === 4) tasks.push(t(day, 'team', '夥伴追蹤：關心 3 位夥伴本週進度與卡關點', 'mid', 30));
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
  // 「發布 Reels（今天吃什麼）：…」與舊版「發布 Reels：…」視為同一類，同一天已保留就不再新增
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

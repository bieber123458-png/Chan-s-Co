// 資料集合清單（前後端共用）。每一筆紀錄在資料庫中是一列，內容存成 JSON。
export const COLLECTIONS = [
  'settings',      // 個人設定與目標（單筆 id = main）
  'tasks',         // 每月計畫任務
  'dayLogs',       // 每日狀態（沒動力模式、心情、今日覆盤）
  'aiHistory',     // AI 分析與對話歷史
  'posts',         // IG 內容與數據
  'orders',        // 零售訂單
  'retailTodos',   // 客戶跟進與待辦
  'teamSnapshots', // 團隊人數紀錄
  'igSnapshots',   // IG 粉絲數與洞察報告總覽紀錄
  'stories',       // 限動組（規劃與發布後數據）
  'drafts',        // 文案與輪播草稿
  'teamFollowups', // 夥伴跟進紀錄
  'transactions',  // 收支紀錄（不含債務還款）
  'debts',         // 負債清單
  'debtPayments',  // 還款紀錄（本金／利息／額外還款）
  'savingsGoals',  // 存錢目標
  'deposits',      // 存入／提領紀錄
  'habits',        // 每日習慣（id = 日期）
  'journals',      // 日記
  'cardDraws',     // 抽卡紀錄
];

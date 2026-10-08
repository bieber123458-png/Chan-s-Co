# 小陳的每月經營系統（Chan's Co.）— 專案交接說明

> 這份文件是給「接手開發的人或 AI（ChatGPT / Codex / Claude）」看的完整說明。
> 讀完這份就能安裝、啟動、修改、建置與部署。開發規則摘要在 [`AGENTS.md`](AGENTS.md)。

---

## 1. 這個網站是做什麼的

一個給個人品牌經營者「小陳（闆闆小陳，IG：@chan1201_）」自己使用的**每月經營系統**，介面全部是繁體中文（台灣用語），手機優先設計。

主要功能：

| 區塊 | 功能 |
|---|---|
| 今日任務 | 每日待辦（可打勾槓掉）、當天的計畫任務、沒動力模式、今日覆盤 |
| 每月計畫 | 從使用者選的開始日起算一個月，自動產生每天的任務（IG 內容、零售、團隊、財務、生活），可新增／編輯 |
| AI 教練 | 自由對話、分析、想點子、改善、決策、拆解目標、限動顧問 |
| 社群內容 | 文案架構、輪播規劃、內容健檢、草稿、發布紀錄、數據分析、提高觸及 |
| 限動經營 | 規劃每組限動（類型、每則內容、互動貼紙）、發布後數據與完成率 |
| 事業儀表板 | 個人品牌（IG）數據、粉絲數紀錄、零售訂單、客戶跟進、團隊人數與夥伴跟進 |
| 存錢與負債 | 仿「88La」記帳 App：快訊、預算（四步驟）、每月診斷、記帳明細、月曆、信用卡（帳單／繳卡費／分期）、帳戶、存錢目標（儲蓄／預存）、願望清單、負債、筆記、還款策略、AI 財務建議；帳本分「個人／事業／家庭」 |
| 生活與成長 | 每日習慣、體重紀錄（趨勢圖、BMI、目標）、日記 |
| 積分與抽卡 | 完成任務得積分，換鼓勵卡（純鼓勵，不涉及金錢） |
| 每週／每月覆盤 | 依實際紀錄統計，資料不足時明確列出缺什麼 |
| 設定與備份 | 個人設定、自動備份清單（可下載／還原）、JSON／CSV 匯出、從備份還原、連接後端 |

### 目前的內容方向（很重要）
使用者明確要求，修改內容相關功能時請遵守：
- IG 走「**個人魅力**」路線：今天吃什麼（早餐／晚餐）、開箱、好物、生活日常、72→57kg 的心路歷程、自然地介紹產品（賣貨）。
- **不要**再加入「教學、乾貨、食譜步驟、收藏清單」這類實用型內容（使用者說執行不下去）。
- **不要**主動加入「美業」主題（使用者以前做美業，現在不以美業為主）。
- 團隊只做培訓與關心現有夥伴，**不要**加入「招募／找新夥伴」任務。
- 介紹食品（婕樂纖）時有台灣食品廣告合規提醒：不把產品和公斤數放同一句、不寫「吃了就瘦」「纖體」。
- 目前的目標之一是**提高 IG 觸及率**。

相關設定集中在：`app/src/lib/plan.js`（每月任務範本）、`app/src/lib/copy.js`（文案架構、限動範本）、`app/src/lib/prompts.js`（AI 的系統指示）、`app/src/lib/stats.js`（預設帳號定位）。

---

## 2. 使用的技術

| 部分 | 技術 |
|---|---|
| 前端 | React 19 + Vite 8（純 JavaScript／JSX，沒有 TypeScript、沒有 UI 套件、沒有 CSS 框架），hash 路由（`#/home`） |
| 樣式 | 單一檔案 `app/src/styles.css`，CSS 變數（奶茶棕＋香檳金＋米白配色），系統字體（蘋果用 SF＋蘋方，其他裝置用 Google Fonts 的 Noto Sans TC） |
| 後端（自架，選用） | Node.js 22.13+ 的 Express 4 + 內建 `node:sqlite`；密碼用 scrypt；token 登入 |
| 後端（Cloudflare，選用） | Cloudflare Workers + Durable Objects（內建 SQLite），PBKDF2 密碼 |
| AI | Anthropic Claude（`@anthropic-ai/sdk`），預設模型 `claude-opus-5-5`；金鑰只在後端環境變數 |
| Claude 雲端版 | 發布成 claude.ai Artifact，用 `window.claude.use('db' / 'user' / 'sample' / 'downloads')` 存資料與呼叫 AI（使用者自己的 Claude 帳號，不需要 API 金鑰） |
| 測試 | Node 內建測試器（`node --test`），32 個測試 |

沒有圖片、圖示檔或自帶字體檔：圖示全部是文字符號／emoji，字體從系統或 Google Fonts 載入。

---

## 3. 資料夾結構

```
.
├── README.md                 ← 本文件（交接說明）
├── AGENTS.md                 ← 給 AI 的開發規則摘要（Codex 會自動讀）
├── .env.example              ← 所有環境變數說明（不含任何真實金鑰）
├── index.html                ← 原本的 CHAN's Co. 品牌介紹頁（獨立靜態頁，GitHub Pages 首頁）
├── booking.html              ← 原本的線上預約頁（獨立靜態頁）
├── render.yaml               ← Render 部署設定（自架後端用，已準備但目前沒有部署）
├── system/                   ← ★ 經營系統的「建置後」靜態檔（GitHub Pages 實際提供的網站）
│   ├── index.html
│   ├── assets/index-*.js / index-*.css
│   └── xiaochen-system.html  ← 單一檔案版（JS／CSS 全部內嵌，可存桌面離線開）
├── deploy/
│   └── claude-artifact/      ← Claude 雲端版的頁面與說明
├── app/                      ← ★ 經營系統的原始碼（前端＋自架後端）
│   ├── package.json / package-lock.json
│   ├── vite.config.js
│   ├── index.html            ← Vite 入口頁
│   ├── .env.example
│   ├── scripts/
│   │   ├── dev.mjs           ← 同時啟動前後端開發伺服器
│   │   └── build-static.mjs  ← 重新產生 system/ 與單一檔案版
│   ├── server/               ← 自架後端（Express + SQLite + AI）
│   ├── src/
│   │   ├── main.jsx          ← React 進入點
│   │   ├── App.jsx           ← 版面、選單、路由、啟動流程（判斷用哪種儲存模式）
│   │   ├── styles.css        ← 全部樣式
│   │   ├── pages/            ← 每個頁面一個檔案
│   │   ├── components/       ← 共用元件與大型功能區塊
│   │   └── lib/              ← 資料存取、計算、提示詞、範本（多數前後端共用）
│   └── tests/                ← 單元／API 測試
└── worker/                   ← Cloudflare 後端（選用）
    ├── src/index.js
    ├── wrangler.toml
    ├── .dev.vars.example
    └── package.json / package-lock.json
```

> `app/README.md`、`app/DEPLOY.md`、`worker/DEPLOY.md` 是較早寫的說明，部分內容（例如「30 天」）已過時；**以本文件為準**。

---

## 4. 安裝

需要 **Node.js 22.13 以上**（後端使用內建 `node:sqlite`）。

```bash
cd app
npm ci          # 依 package-lock.json 安裝，版本與目前完全一致
```

Cloudflare 後端（選用）：

```bash
cd worker
npm ci
```

---

## 5. 啟動

### 開發模式（前端＋自架後端，最完整）
```bash
cd app
cp .env.example .env        # 想用 AI 才需要填 ANTHROPIC_API_KEY；不填也能使用全部非 AI 功能
npm run dev                 # 前端 http://localhost:5173（/api 會轉到後端 8787）
```
第一次打開會要求建立帳號（第一個帳號永遠可以建立，之後預設關閉註冊）。

### 只開前端（模擬 GitHub Pages 的「本機模式」）
```bash
cd app
npm run dev:client          # 沒有後端時，資料自動存在瀏覽器 localStorage
```

### 正式模式（建置後由 Express 一起提供前端）
```bash
cd app
npm run build
npm start                   # http://localhost:8787
```

### Cloudflare 後端本機測試
```bash
cd worker
cp .dev.vars.example .dev.vars   # 填入 ALLOWED_ORIGINS（與選填的 ANTHROPIC_API_KEY）
npm run dev                      # http://localhost:8787
```

### 測試
```bash
cd app
npm test                    # 32 個測試：財務計算、計畫、AI 提示詞、API、雲端儲存、自動備份
```

---

## 6. 建置

| 指令 | 產生什麼 | 用途 |
|---|---|---|
| `npm run build` | `app/dist/` | 自架後端（`npm start`、Render）使用 |
| `npm run build:static` | 更新 `system/`、`system/xiaochen-system.html`、`deploy/claude-artifact/app.html` 的檔名 | **GitHub Pages、單一檔案版、Claude 雲端版**都靠這個 |

> 修改前端後，要讓線上網站更新，必須執行 `npm run build:static` 並把 `system/` 一起提交。這個指令已驗證：用目前的原始碼建置出來的結果，和現在線上的 `system/` 檔案**完全相同**。

---

## 7. 三種資料儲存模式（理解這個才不會改壞資料）

啟動流程在 `app/src/App.jsx` 的 `boot()`：

1. **remote（主機模式）**：偵測到後端 `/api/status`（自架 Express 或 Cloudflare）→ 需要登入，資料存在伺服器 SQLite，AI 用伺服器的 API 金鑰。
2. **cloud（Claude 雲端模式）**：在 claude.ai Artifact 裡打開 → 資料存在 Claude 的資料庫，路徑 `data/users/<使用者 id>/app/<集合>/<紀錄 id>`；AI 用使用者自己的 Claude 帳號（`sample`）。
3. **local（本機模式）**：GitHub Pages 或單一檔案 → 資料存在瀏覽器 `localStorage`。AI 按鈕變成「📋 複製給 Claude」（把整理好的指令貼到 Claude，再把回覆貼回來）。

三種模式共用同一組資料格式：**集合清單在 `app/src/lib/collections.js`**，前端、自架後端、Cloudflare 後端、Claude 雲端版都讀這一份。**新增資料類型時只要在這裡加一行**，三個後端都會自動支援。

瀏覽器 localStorage 使用的鍵：

| 鍵 | 內容 |
|---|---|
| `xc30-local-data` | 本機模式的全部資料 |
| `xc30-snapshots` | 本機模式的自動備份（最多 1.5MB、5 份） |
| `xc30-token` | 主機模式登入 token |
| `xc30-api-base` | 使用者在設定頁輸入的後端網址 |
| `xc30-local-migrated` | 「把瀏覽器紀錄搬到雲端」提示已處理 |

**自動備份**（`app/src/lib/backup.js`）：每天第一次打開時存一份「打開當下」的全部資料。Claude 雲端版存在 `data/users/<id>/backup/`（分段存，保留 20 份），本機版存在 localStorage（保留 5 份）。還原前會先自動備份目前資料。

**資料相容性規則**：已經有使用者真實資料在使用中。修改時請保持舊資料可讀——不要改集合名稱或既有欄位的意思；移除選項時，舊紀錄仍要能顯示（例如 `RecordForm` 的下拉選單會自動保留不在清單裡的舊值、`Stories` 遇到已移除的限動類型會用預設類型顯示）。

---

## 8. 每個頁面與功能（路由 → 檔案）

頁面清單定義在 `app/src/App.jsx` 的 `PAGES`。手機底部導覽：今日、社群、＋快速記帳、財務、更多。

| 路由 | 頁面 | 檔案 | 主要用到的元件／邏輯 |
|---|---|---|---|
| `#/home` | 今日任務 | `pages/Home.jsx` | `components/Todos.jsx`（每日待辦）、`TaskItem.jsx`、`TaskEditor.jsx`、`lib/plan.js` |
| `#/plan` | 每月計畫 | `pages/Plan.jsx` | `lib/plan.js`（`generateMonthPlan`、`planUpgrade`、`PLAN_VERSION`） |
| `#/coach` | AI 教練 | `pages/Coach.jsx` | `components/AiPanel.jsx`、`lib/prompts.js` |
| `#/content` | 社群內容 | `pages/Content.jsx` | `components/Studio.jsx`（文案／輪播）、`lib/copy.js`；「提高觸及」分頁也在這個檔案（`Reach`） |
| `#/stories` | 限動經營 | `pages/Stories.jsx` | `lib/copy.js` 的 `STORY_TYPES`、`storyMetrics` |
| `#/business` | 事業儀表板 | `pages/Business.jsx` | 粉絲數、零售訂單、客戶跟進、團隊 |
| `#/finance` | 存錢與負債 | `pages/Finance.jsx` | `components/MoneyPanels.jsx`（快訊餘額、提醒、預算、診斷）、`components/MoneyMore.jsx`（明細、月曆、信用卡、帳戶、願望清單、筆記）、`components/QuickAdd.jsx`（快速記帳）、`lib/finance.js`（所有計算） |
| `#/life` | 生活與成長 | `pages/Life.jsx` | `components/Weight.jsx`（體重） |
| `#/cards` | 積分與抽卡 | `pages/Cards.jsx` | `lib/cards.js`、`lib/stats.js` |
| `#/review` | 每週／每月覆盤 | `pages/Reviews.jsx` | `lib/stats.js` |
| `#/settings` | 設定與備份 | `pages/Settings.jsx` | 自動備份清單、匯出 CSV／JSON、還原、連接後端 |
| — | 登入 | `pages/Login.jsx` | 只有主機模式會出現 |

### 重要的 lib 檔案

| 檔案 | 用途 |
|---|---|
| `lib/store.jsx` | 全域資料狀態（`useStore()`）：`save`、`saveMany`、`remove`、`importAll`、`ai`、自動備份、儲存中狀態、舊資料轉換 |
| `lib/api.js` | 主機模式與本機模式的資料存取 |
| `lib/cloud.js` | Claude 雲端模式的資料存取、分頁讀取（超過 1000 筆）、快照、AI |
| `lib/collections.js` | 資料集合清單（三個後端共用） |
| `lib/finance.js` | 記帳、預算、診斷、信用卡帳單、分期、帳目歸屬等純函式 |
| `lib/plan.js` | 每月計畫範本、日期與月份週期工具 |
| `lib/copy.js` | 文案架構、開頭句型、行動呼籲、輪播樣式、限動範本 |
| `lib/prompts.js` | 所有 AI 提示詞；也產生「複製給 Claude」的文字 |
| `lib/stats.js` | 預設設定（`DEFAULT_SETTINGS`）、積分、覆盤統計 |
| `lib/backup.js` | 每日自動備份 |
| `components/ui.jsx` | 共用元件：`PageHead`、`Card`、`Field`、`Chips`、`Stat`、`Progress`、`Modal`、`Confirm`、`Empty` |
| `components/RecordForm.jsx` | 依欄位定義產生的新增／編輯表單（含驗證） |

---

## 9. 想改某個功能，要改哪些檔案

| 想改的東西 | 要改的檔案 |
|---|---|
| 每月計畫的任務內容（Reels 主題、零售、團隊任務） | `app/src/lib/plan.js`；改完把 `PLAN_VERSION` 加 1，計畫頁就會提示「套用新版」（只換掉還沒開始的任務） |
| 文案架構、開頭句型、限動範本 | `app/src/lib/copy.js` |
| AI 的語氣、規則、內容方向 | `app/src/lib/prompts.js`（`BASE` 與各功能的提示詞） |
| 預設帳號定位、預設目標 | `app/src/lib/stats.js`（`DEFAULT_SETTINGS`、`LEGACY_POSITIONINGS`） |
| 記帳計算（可用餘額、預算、診斷、信用卡） | `app/src/lib/finance.js`（有測試：`tests/finance.test.js`） |
| 快速記帳的欄位 | `app/src/components/QuickAdd.jsx` |
| 財務頁版面與分頁 | `app/src/pages/Finance.jsx`、`components/MoneyPanels.jsx`、`components/MoneyMore.jsx` |
| 每日待辦 | `app/src/components/Todos.jsx` |
| 體重 | `app/src/components/Weight.jsx` |
| 新增一種資料 | `app/src/lib/collections.js` 加一行；需要匯出 CSV 時在 `pages/Settings.jsx` 的 `CSV_SETS` 加一項 |
| 新增頁面 | 在 `app/src/pages/` 新增檔案，並加到 `app/src/App.jsx` 的 `PAGES` |
| 顏色、字體、間距 | `app/src/styles.css` 開頭的 `:root` 變數；字體載入在 `app/index.html` |
| 選單、底部導覽、儲存狀態標籤 | `app/src/App.jsx` |
| 後端 API | 自架：`app/server/index.js`；Cloudflare：`worker/src/index.js`（兩邊路由相同） |
| AI 模型或呼叫方式 | `app/server/ai-core.js`（兩個後端共用）、`app/server/ai.js`、`worker/src/index.js`；Claude 雲端版在 `app/src/lib/cloud.js` |

---

## 10. API（自架與 Cloudflare 相同）

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/status` | 健康檢查、儲存方式、AI 是否設定、是否開放註冊 |
| POST | `/api/auth/register`、`/api/auth/login` | 註冊（第一個帳號永遠可建）、登入，回傳 token |
| GET | `/api/auth/me`；POST `/api/auth/logout` | 目前使用者、登出 |
| GET | `/api/data` | 取得全部集合 |
| PUT／DELETE | `/api/data/:collection/:id` | 新增或更新／刪除一筆 |
| POST | `/api/data/:collection/batch`、`/batch-delete` | 批次寫入／刪除 |
| POST | `/api/import` | 用備份取代全部資料 |
| POST | `/api/ai/:kind` | AI 功能（需要 `ANTHROPIC_API_KEY`） |

除了 `status` 與註冊／登入，其他都要 `Authorization: Bearer <token>`。

---

## 11. 環境變數

詳見根目錄 [`.env.example`](.env.example)、`app/.env.example`、`worker/.dev.vars.example`。**沒有任何真實金鑰在專案裡。**

| 變數 | 用在 | 必填 | 說明 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | 自架後端、Cloudflare（Secret） | 否 | 沒有時 AI 按鈕改成「複製給 Claude」，其他功能正常 |
| `AI_MODEL` | 兩個後端 | 否 | 預設 `claude-opus-5-5` |
| `PORT` | 自架後端 | 否 | 預設 8787 |
| `DATABASE_PATH` | 自架後端 | 否 | 預設 `./data/app.db` |
| `ALLOW_REGISTRATION` | 兩個後端 | 否 | 預設 `false`（第一個帳號建立後關閉註冊） |
| `ALLOWED_ORIGINS` | Cloudflare | 是 | 允許呼叫後端的網站（逗號分隔） |
| `VITE_API_BASE` | 前端建置時 | 否 | 預設連的後端網址；也可在網站「設定」頁輸入 |

---

## 12. 目前的部署狀態（整理專案時沒有更動任何線上網站）

| 版本 | 網址 | 部署方式 |
|---|---|---|
| GitHub Pages（網頁版） | https://bieber123458-png.github.io/Chan-s-Co/system/ | GitHub 儲存庫 `bieber123458-png/Chan-s-Co` 的 `main` 分支根目錄直接提供；更新方式＝執行 `npm run build:static` 後把 `system/` 推到 `main` |
| 單一檔案版 | https://bieber123458-png.github.io/Chan-s-Co/system/xiaochen-system.html | 同上；也可以直接下載這個檔案離線使用 |
| 品牌介紹頁／預約頁 | https://bieber123458-png.github.io/Chan-s-Co/ 、`/booking.html` | 同上（根目錄的 `index.html`、`booking.html`） |
| **Claude 雲端版（使用者主要在用）** | https://claude.ai/artifact/F2PQFSr8zmMLUrR6tYB7SS | claude.ai Artifact，詳見 [`deploy/claude-artifact/README.md`](deploy/claude-artifact/README.md)。只有使用者本人的 Claude 帳號（或 Claude Code）能更新這個網址 |
| 自架後端（Render） | 沒有部署 | `render.yaml` 已準備好（需要付費方案的永久磁碟） |
| Cloudflare 後端 | 沒有部署（使用者沒有提供 workers.dev 網址） | `worker/` 已準備好，步驟見 `worker/DEPLOY.md` |

Git：開發分支 `claude/xiaoan-tutor-guide-ktgal0`，每次完成後也推到 `main`（GitHub Pages）。

---

## 13. 已驗證（交接當下）

- 從乾淨的副本執行 `npm ci` → `npm test`（32/32 通過）→ `npm run build` 成功。
- `npm start` 啟動後：註冊、登入、寫入與讀取資料正常；11 個頁面在手機尺寸（390px）都能打開、沒有錯誤、沒有橫向捲動；快速記帳後重新整理資料仍在。
- Cloudflare 後端用 `wrangler dev` 本機啟動：狀態、註冊正常。
- `npm run build:static` 產生的 `system/` 與目前線上的檔案逐位元相同。

## 14. 注意事項

- 使用者的真實資料**不在這個專案裡**：Claude 雲端版的資料在使用者自己的 Claude 帳號（私人區，連開發者也讀不到），網頁版的資料在使用者的瀏覽器。要拿到資料，請使用者在網站「設定與備份 → 下載完整 JSON 備份」。
- 修改後請一定要跑 `npm test`，並用手機尺寸實際操作一次。
- AI 回覆不可編造使用者的數據；這條規則寫在 `prompts.js`，請保留。

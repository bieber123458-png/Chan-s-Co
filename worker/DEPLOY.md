# 讓 GitHub 網頁版也能用 AI 教練（Cloudflare 後端）

網頁版網址：<https://bieber123458-png.github.io/Chan-s-Co/system/>

部署這個後端之後，網頁版就能：
- 使用所有 AI 功能（AI 教練、文案架構、輪播規劃、限動規劃、財務建議、覆盤）
- 把資料存在雲端，手機和電腦登入同一個帳號看到相同資料
- 只有你能登入：第一個建立的帳號就是你的，之後別人無法註冊

## 費用
- **Cloudflare 主機：免費**（免費方案每天 10 萬次請求，一個人用綽綽有餘）
- **Claude API：依使用量付費**。預設模型 Claude Opus 5.5，每次 AI 回覆大約 US$0.05～0.10。每天用 5 次，一個月大約 US$12（約 NT$400）。
  - 想更省：把 `wrangler.toml` 裡的 `AI_MODEL` 改成 `claude-sonnet-5-5`，費用大約減半。

## 步驟一：準備 Claude API 金鑰（約 5 分鐘）
1. 到 <https://console.anthropic.com/> 註冊或登入。
2. 左側 **Billing** → 儲值（最低 US$5），可以設定每月上限避免超支。
3. 左側 **API Keys** → **Create Key** → 名稱填「小陳經營系統」→ 複製 `sk-ant-` 開頭的金鑰（只會顯示一次，先貼到記事本）。

## 步驟二：部署到 Cloudflare（約 5 分鐘）
1. 到 <https://dash.cloudflare.com/sign-up> 註冊免費帳號並驗證 Email。
2. 左側選 **Workers & Pages** → **Create** → **Import a repository**（從 GitHub 匯入）。
3. 按 **Connect GitHub**，授權後選擇 `bieber123458-png/Chan-s-Co`。
4. 設定畫面：
   - **Project name**：`xiaochen-system`
   - **Root directory**（根目錄，可能在「Advanced settings」裡）：`worker`
   - **Deploy command**：保持 `npx wrangler deploy`
   - 其他保持預設
5. 按 **Deploy**，等 1～3 分鐘出現成功畫面。

## 步驟三：放入 AI 金鑰
1. 在剛建立的 `xiaochen-system` 頁面 → **Settings** → **Variables and Secrets** → **Add**。
2. **Type** 選 **Secret**，**Variable name** 填 `ANTHROPIC_API_KEY`，**Value** 貼上步驟一的金鑰。
3. 按 **Deploy**（或 Save）。

## 步驟四：連接網頁版
1. 在 Cloudflare 的 `xiaochen-system` 頁面上方找到網址，例如 `https://xiaochen-system.你的帳號.workers.dev`，複製。
2. 打開網頁版 <https://bieber123458-png.github.io/Chan-s-Co/system/> → **設定與備份** → **連接 AI 主機** → 貼上網址 → **測試並連接**。
3. 出現登入畫面後，**馬上建立你的帳號**（帳號、密碼自己記好）。
4. 手機、電腦都打開同一個網頁版，第一次各自貼一次後端網址並登入即可。

> 如果原本在網頁版已經輸入過資料：連接前先到「設定與備份」下載 JSON 備份，登入後再用「從備份還原」匯入。

## 常見問題
- **連不到後端**：確認網址開頭是 `https://`、結尾沒有多餘的路徑；Cloudflare 部署狀態是成功。
- **AI 顯示「金鑰無效」**：重新檢查步驟三的金鑰有沒有貼完整。
- **AI 顯示「使用量上限」**：Claude API 餘額不足，到 console.anthropic.com 儲值。
- **想讓其他網址也能連**：`wrangler.toml` 的 `ALLOWED_ORIGINS` 加上該網址（逗號分隔）。
- **更新程式**：程式推送到 GitHub 的 `main` 後，Cloudflare 會自動重新部署，資料不受影響。

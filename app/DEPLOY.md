# 部署到 Render（約 10 分鐘）

部署後會得到一個固定網址（例如 `https://xiaochen-30-day-system.onrender.com`），手機、電腦都能登入同一個帳號，AI 功能也能使用。

## 事前準備
1. **GitHub 帳號**：程式碼已經在 `bieber123458-png/Chan-s-Co`。
2. **Claude API 金鑰（選用）**：不需要 AI 功能就不用準備。金鑰不是登入密碼，是讓系統呼叫 AI 的付費憑證（依用量計費，和 Claude 會員訂閱分開）。之後想用 AI，再到 <https://console.anthropic.com/> 建立金鑰。
3. **Render 帳號**：到 <https://render.com/> 用 GitHub 登入，並綁定信用卡。

## 費用
- Render starter 方案約每月 US$7，加上 1GB 磁碟約每月 US$0.25。
- 需要磁碟是因為資料庫是一個檔案；免費方案沒有磁碟，每次重新啟動資料都會消失，不適合存放財務紀錄。
- 不用 AI 就沒有其他費用；啟用 AI 後依使用量另計。

## 步驟
1. 打開這個連結（會讀取專案裡的 `render.yaml`）：
   <https://render.com/deploy?repo=https://github.com/bieber123458-png/Chan-s-Co/tree/claude/xiaoan-tutor-guide-ktgal0>
   - 如果 Render 顯示找不到設定檔，代表它讀的是 `main` 分支：請先把這個分支合併到 `main`，再改用 <https://render.com/deploy?repo=https://github.com/bieber123458-png/Chan-s-Co>
2. 第一次使用時，Render 會請你授權讀取這個 GitHub 專案，按允許。
3. 設定畫面的欄位都不用改。
4. 按 **Deploy Blueprint**，等 3～5 分鐘，狀態變成 **Live**。
5. 點服務頁面上方的網址打開系統，**馬上建立你的帳號**：第一個註冊的帳號才能建立，之後註冊會自動關閉，別人無法註冊。
6. 想啟用 AI 時：Render 服務頁 → Environment → 新增 `ANTHROPIC_API_KEY`＝你的金鑰 → 儲存，系統會自動重新啟動，資料不受影響。

## 之後更新
程式推送到部署的分支後，Render 會自動重新部署，資料庫在磁碟上不受影響。

## 備份
磁碟資料保存在 Render 上；仍建議每週在「設定與備份」下載一次 JSON 備份。

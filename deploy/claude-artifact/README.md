# Claude 雲端版（claude.ai Artifact）

- 網址：https://claude.ai/artifact/F2PQFSr8zmMLUrR6tYB7SS
- 這是使用者目前主要使用的版本：資料存在使用者自己的 Claude 帳號，換手機、電腦都看得到；AI 直接用使用者的 Claude 帳號，不需要 API 金鑰。

## 組成
發布內容 = 本資料夾的 `app.html`（頁面本體）＋ `system/assets/` 裡的兩個檔案：

| 發布路徑 | 來源 |
|---|---|
| （頁面）| `deploy/claude-artifact/app.html` |
| `assets/index-*.js` | `system/assets/index-*.js` |
| `assets/index-*.css` | `system/assets/index-*.css` |

`app.html` 只有標題、字體連結、兩個 assets 引用和 `<div id="root">`；發布平台會自動補上完整的 HTML 外框。

## 宣告的權限（capabilities）
`db`、`user`、`sample`、`downloads`

| 權限 | 用途（程式在 `app/src/lib/cloud.js`） |
|---|---|
| `db` | 存資料：`data/users/<id>/app/<集合>/<id>`；自動備份：`data/users/<id>/backup/` |
| `user` | 取得使用者 id（決定私人資料路徑） |
| `sample` | AI：用使用者自己的 Claude 帳號回答 |
| `downloads` | 「下載備份」功能 |

## 怎麼更新
1. `cd app && npm run build:static`（會更新 `system/assets/` 與本資料夾 `app.html` 裡的檔名）
2. 用**使用者本人的 Claude 帳號**（例如在 Claude Code 裡）把 `app.html` 連同兩個 assets 發布到**同一個網址**，並移除舊的 assets 檔名。權限宣告不需要重填（沿用原本的）。
3. 發布不會刪除使用者的資料：資料庫與網頁版本是分開保存的。

> 只有擁有這個 Artifact 的 Claude 帳號能更新它。ChatGPT／Codex 無法直接發布到這個網址；
> 它們可以修改程式並執行 `npm run build:static`，再請使用者用 Claude 發布，或改用 GitHub Pages 版本。

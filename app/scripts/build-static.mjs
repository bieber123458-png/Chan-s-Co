// 產生「靜態版」：GitHub Pages 用的 ../system/ 資料夾、單一檔案版、以及 Claude Artifact 版的頁面
// 用法：在 app/ 資料夾執行 `npm run build:static`
// 1. 以相對路徑（base: ./）建置到 dist-static/（不影響 npm run build 的 dist/）
// 2. 取代 ../system/assets 與 ../system/index.html
// 3. 把 JS、CSS 內嵌成 ../system/xiaochen-system.html（單一檔案、離線可用）
// 4. 更新 ../deploy/claude-artifact/app.html 引用的檔名（發布到 Claude 時使用）
import { build } from 'vite';
import { readFile, writeFile, readdir, rm, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(appDir, '..');
const outDir = path.join(appDir, 'dist-static');
const systemDir = path.join(root, 'system');
const artifactPage = path.join(root, 'deploy', 'claude-artifact', 'app.html');

await build({ root: appDir, base: './', logLevel: 'warn', build: { outDir, emptyOutDir: true } });

const files = await readdir(path.join(outDir, 'assets'));
const jsName = files.find((f) => f.endsWith('.js'));
const cssName = files.find((f) => f.endsWith('.css'));
if (!jsName || !cssName) throw new Error('建置結果找不到 JS 或 CSS 檔案');

// GitHub Pages：system/
await rm(path.join(systemDir, 'assets'), { recursive: true, force: true });
await mkdir(systemDir, { recursive: true });
await cp(path.join(outDir, 'assets'), path.join(systemDir, 'assets'), { recursive: true });
const html = await readFile(path.join(outDir, 'index.html'), 'utf8');
await writeFile(path.join(systemDir, 'index.html'), html);

// 單一檔案版：把 JS 與 CSS 內嵌進 HTML（JS 放在 body 最後，等 #root 出現後才執行）
const js = await readFile(path.join(outDir, 'assets', jsName), 'utf8');
const css = await readFile(path.join(outDir, 'assets', cssName), 'utf8');
let single = html
  .replace(/\s*<script type="module"[^>]*><\/script>/, '\n  ')
  .replace(/<link rel="stylesheet" crossorigin[^>]*>/, () => `\n<style>${css}</style>`);
single = single.replace('</body>', () => `<script type="module">${js}</script>\n</body>`);
await writeFile(path.join(systemDir, 'xiaochen-system.html'), single);

// Claude Artifact 頁面：只更新引用的檔名
try {
  const page = await readFile(artifactPage, 'utf8');
  const next = page
    .replace(/\.\/assets\/index-[A-Za-z0-9_-]+\.js/, `./assets/${jsName}`)
    .replace(/\.\/assets\/index-[A-Za-z0-9_-]+\.css/, `./assets/${cssName}`);
  await writeFile(artifactPage, next);
} catch {
  // 沒有 deploy/claude-artifact/app.html 時略過
}

console.log(`完成：system/assets/${jsName}、system/assets/${cssName}、system/xiaochen-system.html`);

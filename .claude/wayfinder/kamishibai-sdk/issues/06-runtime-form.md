# 技術形態／runtime

Status: resolved
Type: grilling
Blocked by: 03, 05

## Question

SDK 以什麼形態存在讓 Agent 最好用？候選：CLI 工具（skill 用 Bash 調用，最貼近現有 render_map.py 模式）、node/python library、MCP server、或混合（CLI 為主＋可嵌入 lib）。需考量：公開發佈的安裝體驗、WSL2＋nvm 環境慣例、無網路依賴的自包含 HTML 輸出、以及「Agent 好用」的介面設計（錯誤訊息、冪等重繪、dry-run）。

## Answer

三題定案（2026-08-16 使用者確認）：

1. **介面形態＝A＋C：node library core＋CLI 薄殼＋MCP server 殼**——核心是可嵌入 library（程式化客戶直接 import）；CLI 是 Agent 主通道；MCP server 是同一套 lib API 的再包裝，列入範圍。排序建議：CLI 先行，MCP 殼隨後（公開 SDK 的開箱體驗不得依賴 MCP 設定）。UI 通道另由 12 號票決議。

2. **v1 CLI 指令面**：
   - `render <input>` — IR／Markdown 超集 → 單檔產物
   - `serve <input>` / `close` — dev server＋HMR 起停
   - `replay <artifact>` — 從產物內嵌 IR 重繪（換模板／升版／換皮）
   - `export <artifact> --to pdf|pptx` — 匯出附屬格式
   - `snapshot <target>` — 截圖產物／serve 畫面，讓 Agent（與人）即時看視覺效果
   - `init` / `fork <template>` — 模板包腳手架（含衍生起手式）
   - `import-template <zip|dir|url>` / `export-template` — 模板匯入（多來源，依 `.toml` 專案描述檔識別）／打包分享
   - `lint <target>` — 驗模板包或產物（收編既有六套閘門）
   - `add <pkg>` / `store list|rollback` — npm 模板包安裝／中央儲存庫管理（分組、退版）
   - `example <block|template>` / `schema` / `help` — 防試錯通道
   - `comments <artifact>` — 列出產物留言（block id 錨定，`--json`；依 12 增補之留言迭代迴路，2026-08-16 追加）
   - `config set|get|remove|list` — 設定管理（remove＝回預設）
   - `debug` — 診斷（環境、依賴、模板解析過程）
   - `setup` — 初始化環境（建中央儲存庫、裝渲染依賴如 Playwright）
   - `ui` — 等 12 號票決議後補掛

3. **Agent 好用語意**：全指令支援 `--json`（成功與失敗皆機器可讀），視需求加 `--yaml`；驗證錯誤指到 block tree 路徑而非 HTML 行號；exit code 穩定分類；`render`/`replay` 冪等；`--dry-run` 只驗不寫。安裝：npm 發佈、`npx @kamishibai/sdk` 免安裝可用（修訂：原文「npx kamishibai」成文早於 09 的命名實查，裸名已被佔；2026-08-16 F0 裁決改為 scoped 形式，安裝後 bin 名仍為 `kamishibai`）；WSL＋nvm 的 `zsh -lic` 慣例入文件。

**附帶定案**：模板包專案描述檔格式候選定為 **TOML**（隨 import-template 決議，細部欄位歸 11 號票）。

## Comments

- 2026-08-16 依 03 定案更新前提：實作棧已定為 Vue3 + Vite SSG + vite-plugin-singlefile（node 生態），故本票收斂為 node CLI 的具體形狀。**硬需求（使用者指定）**：CLI 須有 `help`／`example` 類指令，直接輸出合法 IR 範例與 schema，讓 Agent 免反覆試錯。
- 2026-08-16 **硬需求二（使用者指定）**：遞送層須有雙伺服模式——`serve`/watch 模式（Vite dev server＋HMR，資料視圖隨來源檔變更即時熱更新，消滅「重繪後手動重新整理」流程）與 `export` 模式（離線單檔產物，規格依 10 號票）。兩模式共用同一套元件渲染。

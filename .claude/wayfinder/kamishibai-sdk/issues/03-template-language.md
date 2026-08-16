# 模板語言／初始化方案選型

Status: resolved
Type: grilling
Blocked by: 02, 07

## Question

skill（或任何 Agent）對 SDK 說話的正式介面長什麼樣？候選方向：既有模板語言（Handlebars／Nunjucks 類）、結構化資料＋schema（JSON/YAML doc model）、Markdown 超集＋指令、或自訂 DSL。需同時回答「初始化方案」——一個新模板從無到有如何被建立（design 的新職責）。選型需以 07 盤點出的實際內容形態（book 章節、slide、報告、工作日誌、地圖視圖）為證據。

## Answer

三個子決策定案如下（2026-08-16 使用者確認）：

1. **著作面 IR：雙入口、單一 canonical 層**——散文類 skill 寫 Markdown 超集（frontmatter metadata＋fenced 型別 block：```diagram、```raw 島嶼…），SDK 編譯為 canonical JSON block tree；資料類 skill（wayfinder、沙盤）直接產 block tree。驗證與閘門只面對 block tree。**附帶硬需求**：CLI 必須提供 `help`／`example` 類指令，直接輸出合法範例與 schema，讓 Agent 免反覆試錯（轉記 06 技術形態票）。
2. **模板實作棧：Vue3 + Vite（SSG 模式）+ vite-plugin-singlefile**——模板＝Vue 元件家族＋具名 slot＋token 詞彙＋閘門 manifest；build 時預渲染、全資產內聯成離線單檔 HTML；需互動的視圖將 Vue runtime 一併內聯。**Nuxt 明確不採用**（完整應用框架對渲染管線過重）。樣式層 Tailwind（或 Sass）架在 CSS custom properties 之上——既有 tokens.css 38 名詞彙仍是唯一真源，Tailwind theme 映射到變數。此決策同時解掉 126 個僅差前綴的骨架複製問題（元件化後一個骨架寫一次）。已接受代價：渲染成為 build（每次數秒、需 node/nvm 環境）；PDF/PPTX 鏈對接 SSG 產物。推翻條件：單檔內聯尺寸實測失控時，退到「文件類免 runtime、視圖類帶 runtime」分級打包。
3. **初始化方案：模板包規格＋腳手架**——SDK 定義模板包目錄格式（manifest＋元件骨架＋tokens＋閘門規則＋範例頁），提供 `init`／`lint` 工具，並支援「從既有模板衍生」起手式；design skill 轉型為「引導設計決策 → 產出合法模板包 → 註冊進持久化系統」。lint 工具收編現有 6 套零散閘門職責。

## Comments

- 2026-08-16 使用者提問「raw 島嶼可否用 slot 或 plugin 解決」，討論結論作為本票素材：兩者互補——**slot**（模板側具名槽位，book 的 `data-slot` 為雛形）定義自訂內容可出現的位置，使島嶼佔比與內容可被閘門量測；**plugin**（渲染器側擴充）把反覆出現的島嶼模式升格為結構化 block 類型（如 book 的 18 種 diagram-types 可做成 diagram plugin，GATE 規則內建於 plugin）。演化路徑：raw 島嶼是起點逃生艙，plugin 讓島嶼逐步轉正；第三方 block plugin 亦是公開 SDK 的擴充點。

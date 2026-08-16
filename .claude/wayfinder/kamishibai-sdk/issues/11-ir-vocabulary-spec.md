# IR block 詞彙與模板包 manifest 細部規格

Status: resolved
Type: grilling
Blocked by: 04, 10

## Question

03 定了方向（Markdown 超集 → canonical JSON block tree；模板包＝Vue 元件＋slot＋tokens＋閘門 manifest），本票拆細部：

1. **v1 block 詞彙表**：第一版支援哪些 block 類型？（章節／段落／圖表 plugin／raw 島嶼／表格／看板／圖……）以既有產物形態（book 章節、slide、校對表、地圖、沙盤）反推最小集合。
2. **模板包 manifest 格式**：宣告哪些欄位（支援的 block 類型、slot 對映、token 需求、閘門規則、版本）？（依 06 附帶定案：格式候選為 **TOML**——`.toml` 專案描述檔，隨 import-template 決議。）
3. **raw 島嶼的柵欄**：島嶼佔比如何量測與設限、島嶼內 SVG 沿用哪些既有 GATE 規則。
4. **IR 隨產物內嵌的格式**（依 10 號票決議：block tree＋模板 id＋版本，`<script type="application/json">`——本票定欄位細節）。
5. **互動元件詞彙**：SDK 內建哪些互動元件——**播放／演講模式**（10 號票定為產物硬能力：全螢幕、鍵盤翻頁；細部如講者備註、計時器在此定）、filterable 看板、hover 依賴圖、TOC scrollspy、lightbox 等，哪些進 v1。
6. **中央儲存庫目錄佈局與分組模型**（依 04 定案：user scope 專屬目錄、具名專案／分組、近 N 版保留——本票定實際佈局、manifest 中的 namespace 欄位、N 的預設值）。

## Answer

六項提案全收＋一項追加（2026-08-16 使用者確認）：

**P1 — v1 block 詞彙表**（進場標準：足以重現五種既有產物）：
- 結構：`doc`（根，帶 metadata）、`section`（可嵌套章節）
- 散文：`prose`（Markdown 行內）、`quote`、`callout`（note/warn）、`code`
- 資料：`table`、`stat`（KPI 磚）、`timeline`、`board`（卡片看板）、`graph`（節點邊圖）、`diagram`（結構化圖表 spec，plugin 承載，book 18 圖型收編起點）
- 媒體：`figure`（圖片）、`raw`（島嶼，子型 html|svg）、**`video`**（追加）——子型 `embedded`（本地內嵌，體積自負、lint 指出肥胖來源）與 `remote`（YouTube/Vimeo；build 時抓縮圖內嵌 poster，離線／嚴格模式顯示 poster＋連結、連網才載 iframe；manifest 標記「含線上限定 block」，lint 提示非完全離線體——零外部請求鐵律的明碼標價例外）
- 簡報：`deck`＋`slide`（layout id＋槽位填充）

**P2 — TOML manifest 欄位**：`[template]` name/namespace/version/description/language；`[engine]` SDK 相容區間；`[blocks]` supported；`[slots]` 具名槽位與接受型別；`[tokens]` required；`[gates]` 開關與門檻；`[export]` pdf/pptx。

**P3 — 島嶼柵欄**：佔比軟上限 20%（block 數與字元權重雙指標取高者），超標 lint 警告、可覆寫；島內禁 `<script>`（互動一律走元件）；島內 SVG 沿用既有 GATE 機械項（viewBox 含界、marker 合法、PDF 鏈 rgba 禁令）。

**P4 — IR 內嵌欄位**：`<script type="application/kamishibai+json">` 含 `irVersion`、`engine`、`template {namespace,name,version}`、`doc`（完整 block tree）、`createdAt`、`generator`；`replay` 讀此包即可完整重繪。

**P5 — 互動元件 v1**：播放模式（全螢幕、方向鍵/空白鍵/點擊翻頁、Esc、進度指示、講者備註）、TOC scrollspy、lightbox、board 篩選、graph hover 高亮；計時器、雷射筆等進 v1.x。

**P6 — 儲存庫佈局**：`~/.kamishibai/` 下 `templates/<namespace>/<name>/`（現行版＋`.versions/` 近 N=3 版）、`config.toml`、`cache/`（字型子集等）。

## 增補：詞彙演化治理（2026-08-16 使用者確認）

三級演化管線——語言成長的每一步都有數據錨（「無使用數據不得入主線」）：

1. **slot-report（自動蒐集）**：raw 島嶼新增必填欄位 `intent`（一句話記「為何需要手寫」；臨摹失敗自動降級為帶 intent 的島嶼）。每次 render/lint append 至 `~/.kamishibai/telemetry/slot-reports-{YYYY-MM}.jsonl`（月切檔，與 baransu 遙測同構）：intent、專案、產物、島嶼大小、來源。
2. **升格審查**：`kamishibai report slots` 按 intent 聚類跨專案計數；**升格條款**＝同性質島嶼 ≥3 份產物或 ≥2 專案 → plugin 候選；`init --plugin` 生成骨架，歷史島嶼直接成為 test fixtures。plugin block 帶前綴（`x-*`）與核心詞彙隔離。
3. **轉正／降格條款（falsifiable）**：plugin 於 ≥1 發佈週期內 ≥N 產物、≥M 專案使用、零未結渲染 bug、≥2 模板 manifest 宣告 → 去前綴併入核心（舊名 alias 一週期）。反向：核心 block 一個觀察窗零使用 → 降格審查。

**配套 skill（使用者指定）**：詞彙演化審查 skill——驅動月回看（跑 report、判升格、開 plugin 骨架），與產物管理 skill 同住 kamishibai plugin 層；歸 08 切片規劃。

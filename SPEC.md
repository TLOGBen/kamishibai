# kamishibai SDK 規格書

> **v0.1 草稿**。蒸餾自 wayfinder 地圖 2026-08-16；衝突時以票面 Answer 為準。
> 真源：`.claude/wayfinder/kamishibai-sdk/map.md` 與 `issues/01`–`issues/12`。
> 本文每節標注出處票號。地圖未定之處一律寫「未定，見 SPEC 演化」——不補腦。

---

## 1. 概述與定位

### 1.1 這是什麼

kamishibai（紙芝居）是一套**公開發佈的通用 Agent Presentation SDK**：Agent 著作結構化內容，SDK 確定性地把它渲染成可單獨生存的呈現產物。

定名取自日本街頭說書以圖卡逐張呈現故事的技藝，與「把內容做成可呈現畫面」的本業直接對應，並延續 baransu（バランス）→ Kami 主題 → kamishibai 的命名血緣。候選 hyousou（表装）、butai（舞台）、utsuwa（器）皆落選。（來源：issues/01、map.md Notes）

- Repo：https://github.com/TLOGBen/kamishibai （2026-08-16 建立）
- License：**目前 `UNLICENSED`（保留所有權利）**；issues/09 定案的 **MIT 為目的地，v1.0 前不生效**（來源：issues/09）
- 從第一天就設計成可公開發佈的通用 SDK；baransu 與 common-dev 兩個 plugin 是**第一批客戶**，不是唯一客戶。（來源：map.md Notes）

### 1.2 為什麼要有它（現況背景）

2026-08-16 的盤點（來源：issues/07、research/07-inventory-report.md）給出動工理由：

| 面向 | 現況 |
|---|---|
| 獨立 renderer | **10 套**（腳本驅動 2、模板驅動模型填充 2、規格驅動無模板 2、純 ad-hoc 4） |
| 主題系統 | **3 套零位元組共用**（Kami 38-token／wayfinder 航海配色／strategic-advance 軍事 HUD） |
| HTML 骨架產生方式 | **5 種不相干**；Kami 內部另有 126 個僅差 class 前綴的骨架複製 |
| 開瀏覽器 | 2 個 fallback 鏈不同的近似函式＋baransu 的 SendUserFile 第三路 |
| zh-TW 在地化 | 2 套機制相反的實作（渲染前 token 替換 vs 渲染後 85 對字串替換） |
| 品質閘門 | **6 套、4 種語言**，規則彼此重述且單位不一致；map.html／sand-table.html／錯字修改.html／工作日誌／prototype／impl.html 完全無覆蓋 |
| 既有共用設施 | 僅 `_shared/output-journal.md`（97 行契約、無機制）與 `color_distance.py` |

結論：重複集中在「模板／主題／骨架／遞送／在地化／閘門」六個面向，而各 skill 的**內容合成彼此獨立**——這正是 SDK 的刀口所在。

### 1.3 邊界（SDK 管到哪為止）

（來源：issues/02）

| 歸 SDK | 歸 skill |
|---|---|
| 模板怎麼定義、存在哪、怎麼渲染、怎麼送達 | 內容怎麼來（內容合成） |
| 渲染、遞送、模板系統、持久化 | book 的 Synthesize、slide 切頁、design 的引導流程 |

角色轉型：**design ＝模板作者**（在 SDK 持久化系統中建立標準模板）、**book 等＝模板消費者**。追加定案：design 與 book 兩個 skill **日後歸屬 kamishibai 專案，而非留在 baransu**——kamishibai 不只是函式庫，也是呈現類 skill 的新家。

### 1.4 統一風格願景

wayfinder 地圖、strategic-advance 沙盤等資料視圖，未來同樣改用同一風格模板家族、透過 SDK 呈現，不再各自維護獨立配色與 renderer。（來源：map.md Notes）

### 1.5 常設原則：臨摹即完備性判準

模板語言的表達力目標是「**能敘述任意圖片、文字與網站**」；凡臨摹不出來的，就是模板語言漏考量的東西。每次臨摹失敗＝模板 spec 的 bug report。因此 block 詞彙表是**由失敗案例驅動演化的開放集，非封閉清單**。（來源：map.md Notes，2026-08-16 使用者定調；演化管線見 §12）

---

## 2. 核心抽象

### 2.1 單一管線：一切皆內容＋模板

（來源：issues/05）

不做「著作模式 vs 資料視圖模式」雙 API。**單一管線**：

1. 模型**不再著作 HTML**，改著作結構化內容 IR（帶 schema 的區塊樹）
2. 渲染一律由 SDK **確定性**完成

紅利：著作文件（book、錯字修改表、工作日誌）與資料視圖（wayfinder 地圖、strategic-advance 沙盤）同樣可重繪；主題改版時歷史產物可一鍵換皮；品質閘門統一驗 IR。

已接受的邊界：**所有既有 skill 都需改產 IR**，遷移工程量最重（由 §16 遷移策略承擔）。

### 2.2 raw 島嶼逃生艙

為保住 book 級表現力，IR 保留 **raw 島嶼**：模型可在特定槽位嵌入自寫 HTML/SVG 區塊，且島嶼佔比可被品質閘門量測。（來源：issues/05；柵欄規格見 §11）

島嶼與模板槽位、plugin 的關係是互補三層（來源：issues/03 Comments）：

- **slot**（模板側具名槽位，book 的 `data-slot` 為雛形）定義自訂內容可出現的位置，使島嶼佔比與內容可被閘門量測
- **plugin**（渲染器側擴充）把反覆出現的島嶼模式升格為結構化 block 類型（book 的 18 種 diagram-types 可做成 diagram plugin，GATE 規則內建於 plugin）
- **演化路徑**：raw 島嶼是起點逃生艙，plugin 讓島嶼逐步轉正；第三方 block plugin 亦是公開 SDK 的擴充點

### 2.3 產物必須能單獨生存

承接 book「把輸出帶去任何地方、像真實書本」的原始意象：SDK 產物必須**自包含、離線可開、不依賴 SDK 存在**。（來源：issues/05 追加需求；細部規格見 §7）

---

## 3. v1 block 詞彙表

（來源：issues/11 P1）

進場標準：**足以重現五種既有產物**（book 章節、slide、校對表、地圖、沙盤）。

v1 **核心**詞彙表共 **17 種** block。核心以外另有 plugin block，一律帶 `x-*` 前綴，不計入這 17 種（見 §12）。依 §1.5 的常設原則，此表是開放集的當前快照，非封閉清單。

### 3.1 結構類（2）

| block | 說明 |
|---|---|
| `doc` | 根節點，帶 metadata |
| `section` | 章節，可嵌套 |

### 3.2 散文類（4）

| block | 說明 |
|---|---|
| `prose` | Markdown 行內 |
| `quote` | 引言 |
| `callout` | 提示框，型別 note / warn |
| `code` | 程式碼 |

### 3.3 資料類（6）

| block | 說明 |
|---|---|
| `table` | 表格 |
| `stat` | KPI 磚 |
| `timeline` | 時間軸 |
| `board` | 卡片看板 |
| `graph` | 節點邊圖 |
| `diagram` | 結構化圖表 spec，由 plugin 承載；book 18 圖型收編起點 |

### 3.4 媒體類（3）

| block | 說明 |
|---|---|
| `figure` | 圖片 |
| `raw` | 島嶼，子型 `html` \| `svg`；**必填 `intent` 欄位**（一句話記「為何需要手寫」，見 §12） |
| `video` | 雙子型，見 §3.6 |

### 3.5 簡報類（2）

| block | 說明 |
|---|---|
| `deck` | 簡報容器 |
| `slide` | 單頁，layout id ＋槽位填充 |

### 3.6 `video` 雙子型與離線降級

（來源：issues/11 P1「追加」）

| 子型 | 行為 |
|---|---|
| `embedded` | 本地內嵌，**體積自負**；lint 指出肥胖來源 |
| `remote` | YouTube / Vimeo。build 時抓縮圖內嵌為 poster；**離線／嚴格模式顯示 poster＋連結**，連網才載 iframe |

使用 `remote` 時：manifest 標記「含線上限定 block」，lint 提示此產物非完全離線體。這是 §7 零外部請求鐵律的**明碼標價例外**。

> **規格缺口（未定，見 SPEC 演化）**：issues/10 要求產物以 CSP meta 自我驗證零外部請求，而 `remote` 子型的 iframe 會被該 CSP 擋下。CSP 在 remote-video 產物中如何放寬，票面未定。

### 3.7 互動元件 v1 五件組

（來源：issues/11 P5）

block 詞彙以外，SDK 內建的互動能力 v1 共五件；互動一律由元件承載，**島嶼內禁 `<script>`**（§11）。

| 元件 | v1 內容 |
|---|---|
| **播放模式** | 全螢幕、方向鍵／空白鍵／點擊翻頁、Esc、進度指示、**講者備註** |
| **TOC scrollspy** | 目錄捲動高亮 |
| **lightbox** | 圖片放大檢視 |
| **board 篩選** | 卡片看板 filterable |
| **graph hover 高亮** | 節點邊圖 hover 依賴高亮 |

**計時器、雷射筆等進 v1.x**，不在 v1 範圍。

---

## 4. 雙入口與 canonical block tree

（來源：issues/03 Answer 第 1 點）

**著作面 IR 為雙入口、單一 canonical 層**：

```
散文類 skill ──► Markdown 超集 ──編譯──┐
                                        ├──► canonical JSON block tree ──► 驗證／閘門／渲染
資料類 skill ──► 直接產 block tree ─────┘
```

- **Markdown 超集**：frontmatter metadata ＋ fenced 型別 block（` ```diagram `、` ```raw ` 島嶼…）。散文類 skill（book、錯字修改表、工作日誌）走這條。
- **canonical JSON block tree**：資料類 skill（wayfinder 地圖、strategic-advance 沙盤）直接產出。
- **驗證與閘門只面對 block tree**——單一驗證面，不重複實作。

**附帶硬需求**：CLI 必須提供 `help` / `example` 類指令，直接輸出合法範例與 schema，讓 Agent 免反覆試錯。（來源：issues/03，轉記 issues/06）

---

## 5. 模板系統

### 5.1 實作棧

（來源：issues/03 Answer 第 2 點）

**Vue3 + Vite（SSG 模式）+ vite-plugin-singlefile**。

- 模板 ＝ Vue 元件家族 ＋ 具名 slot ＋ token 詞彙 ＋ 閘門 manifest
- build 時預渲染、全資產內聯成離線單檔 HTML
- 需互動的視圖將 Vue runtime 一併內聯
- **Nuxt 明確不採用**（完整應用框架對渲染管線過重）

**樣式層**：Tailwind（或 Sass）**架在 CSS custom properties 之上**——既有 tokens.css 的 38 名詞彙仍是唯一真源，Tailwind theme 映射到變數。

此決策同時解掉 126 個僅差前綴的骨架複製問題（元件化後一個骨架寫一次）。

**已接受的代價**：渲染成為 build（每次數秒、需 node/nvm 環境）；PDF/PPTX 鏈對接 SSG 產物。

**推翻條件**：單檔內聯尺寸實測失控時，退到「文件類免 runtime、視圖類帶 runtime」分級打包。

### 5.2 模板包規格與 TOML manifest 七區段

（來源：issues/03 Answer 第 3 點、issues/06 附帶定案、issues/11 P2）

模板包目錄格式 ＝ manifest ＋ 元件骨架 ＋ tokens ＋ 閘門規則 ＋ 範例頁。描述檔格式定為 **TOML**。

| 區段 | 欄位 |
|---|---|
| `[template]` | `name` / `namespace` / `version` / `description` / `language` |
| `[engine]` | SDK 相容區間 |
| `[blocks]` | `supported`（支援的 block 類型） |
| `[slots]` | 具名槽位與接受型別 |
| `[tokens]` | `required` |
| `[gates]` | 開關與門檻 |
| `[export]` | pdf / pptx |

> **命名警示（蒸餾時的解讀）**：專案中存在三個彼此無關的 TOML 檔，票面用語有重疊。本 SPEC 一律以下列名稱區分：
> - **模板包 manifest**（本節，issues/11 P2；issues/06 稱其為「`.toml` 專案描述檔」）
> - **`.kamishibai.toml` 專案錨點檔**（§9.2，issues/12）
> - **`~/.kamishibai/config.toml` 全域設定檔**（§6.1，issues/11 P6）

### 5.3 初始化與腳手架

（來源：issues/03、issues/06）

| 動作 | 說明 |
|---|---|
| `init` | 新模板包腳手架 |
| `fork <template>` | 從既有模板衍生的起手式 |
| `import-template <zip\|dir\|url>` | 多來源匯入，依 TOML 描述檔識別 |
| `export-template` | 打包分享 |
| `lint` | 驗模板包或產物，**收編現有 6 套零散閘門職責** |

design skill 轉型為：引導設計決策 → 產出合法模板包 → 註冊進持久化系統。

---

## 6. 持久化

### 6.1 中央儲存庫佈局

（來源：issues/04、issues/11 P6、issues/12 附帶定案、issues/11 增補）

SDK 擁有**獨立的中央儲存庫**——模板不散落在各 repo，住在 user scope 下的專屬目錄，內部以**具名專案／分組**組織（與 baransu 遙測「集中 user scope、按專案分目錄」先例同構）。SDK 另自帶出廠內建模板家族（公開發佈的開箱層）。

下列樹狀圖是三張票的併集（每行標注出處）：

```
~/.kamishibai/
├── templates/<namespace>/<name>/        # 模板本體（11 P6）
│   └── .versions/                       # 近 N=3 版保留（11 P6）
├── artifacts/<專案名>/                  # 中央產物庫正本（12 附帶定案）
│   ├── <產物>.html
│   └── <產物>.comments.jsonl            # 留言（12 增補，見 §13.1）
├── telemetry/
│   └── slot-reports-{YYYY-MM}.jsonl     # 島嶼遙測，月切檔（11 增補，見 §12）
├── config.toml                          # 全域設定（11 P6）
└── cache/                               # 字型子集等（11 P6）
```

### 6.2 版本策略

（來源：issues/04 第 2 點、issues/11 P6）

- 模板**以最新版為正身、就地演進**
- 儲存庫保留最近 **N ＝ 3** 版（預設值，可設定）供**退版**與**選擇比對**
- **已接受的邊界**：超出保留窗的歷史版本不可取回，「依原版重繪歷史產物」僅保證近 N 版內；但產物自帶 IR（§7.3），任何時點仍可用現行版模板重繪——**樣貌可能不同，內容不失**

> 注意：本 SPEC 中出現兩個彼此無關的符號 `N`。此處的 N＝3 是版本保留數；§12.3 轉正條款中的 ≥N 產物是另一個未定值，不共用符號含義。

### 6.3 調用 key 與分發

（來源：issues/04 第 3 點）

- 調用 key ＝ **`<namespace>/<name>@<version>`**；省略版本 ＝ 最新；namespace 對映分組
- 第三方模板包走 **npm 分發**：`kamishibai add <pkg>` 裝進中央儲存庫
- **不自建 registry**

---

## 7. 產物規格

（來源：issues/10）

### 7.1 格式家族

- **HTML 是唯一一等公民**
- **PDF / PPTX 為匯出附屬**，由轉換器自 HTML 派生，**不承諾 IR 隨行**

### 7.2 字體子集化

**build 時子集化**：渲染時掃描產物實際用字、只嵌用到的字形（中文長文約數百 KB），缺字退系統字型堆疊。

**出廠字體堆疊（2026-08-16 F0 定案，依授權查證報告 `.claude/research/tsanger-jinkai02-license.md`）**：
- 正文襯線：**Noto Serif TC**（SIL OFL 1.1、未宣告 Reserved Font Name——子集化無改名義務）
- 等寬：**Maple Mono CN**（SIL OFL 1.1，使用者指定）
- TsangerJinKai02 **不隨包散布**（授權查證 NO-GO：官方免費白名單不含今楷家族、name table 明文要求書面許可）；降為「使用者自裝、SDK 偵測使用」層。倉耳免費 22 款（与墨、非白系列）授權允許再散布，列為日後型體品味 follow-up。

### 7.3 IR 內嵌欄位

**IR 隨產物內嵌，為規格必要項**——每份產物自帶原稿，任何時點可被 SDK 重新換皮／升級／轉格式，不依賴原始檔案存續。

嵌入形式：`<script type="application/kamishibai+json">`（來源：issues/11 P4；issues/10 原文寫 `<script type="application/json">`，以 11 的細部定案為準）

| 欄位 | 內容 |
|---|---|
| `irVersion` | IR schema 版本 |
| `engine` | 渲染引擎版本 |
| `template` | `{ namespace, name, version }` |
| `doc` | 完整 canonical block tree |
| `createdAt` | 產生時間 |
| `generator` | 產生者 |

`replay` 讀此包即可完整重繪。

### 7.4 播放模式

**HTML 產物須內建「播放能力」**——演講／簡報模式（全螢幕、鍵盤翻頁等）直接活在單檔產物內。**簡報的本體是 HTML 而非 PPTX 原稿。**（來源：issues/10 第 3 點追加；互動細目見 §3.7）

### 7.5 尺寸與相容底線

| 項目 | 值 |
|---|---|
| 單檔軟上限 | **10MB**（CLI 警告並列出肥胖來源）——**可設定覆寫** |
| 單檔硬上限 | **16MB**——**可設定覆寫** |
| 外部請求 | **零外部請求**（CSP meta 自我驗證）；唯一明碼標價例外見 §3.6 |
| 瀏覽器 | evergreen |

兩個上限皆可覆寫，是為避免真實個案被上限卡死。

---

## 8. 中央產物庫與投遞副本

（來源：issues/12 附帶定案）

| 角色 | 位置與語意 |
|---|---|
| **正本** | `~/.kamishibai/artifacts/<專案名>/…`，與模板庫同構分組；`render` 完成**自動歸檔**。產物自帶 IR，中央份即永久檔案庫——UI 產物庫、`replay`、換皮試穿皆讀此 |
| **投遞副本** | 呼叫端仍可指定輸出路徑（如各 repo `.claude/book/` 老地方），作為交付用副本（SendUserFile、commit、分享）。副本路徑記入索引，刪除標失效，**正本不受影響** |

SendUserFile 屬 Claude harness 工具，由 skill 側呼叫，不進 SDK。

**開啟三通道**：

1. `kamishibai open <產物|latest>` — 統一跨平台開啟鏈 `wslview → xdg-open → explorer.exe → webbrowser`，一次收編現存兩套分歧 opener
2. UI 產物庫點開
3. 產物本身雙擊即開（播放模式內建，§7.4 已保證）

---

## 9. 專案解析

### 9.1 四層解析順序

（來源：issues/12 附帶定案，2026-08-16 修訂補②錨點層）

`kamishibai list` / `store artifacts` 自動解析當前專案，順序為：

| 層 | 來源 |
|---|---|
| ① | `--project` 明指 |
| ② | 往上找**最近的 `.kamishibai.toml` 專案錨點檔**——非 git 專案的持久錨點；由 `config set project` 或首次 `render` 落檔，子目錄執行也解析正確 |
| ③ | git root 資料夾名 |
| ④ | cwd 資料夾名保底 |

### 9.2 列出內容

列出該專案產物：名稱、模板＠版本、時間、generator、副本落點。`--json` 全支援——**產物庫成為 Agent 可查詢的「專案呈現史」**。

---

## 10. CLI 指令面

> **蒸餾解讀（明示）**：本表是 **issues/06 ＋ issues/11 增補 ＋ issues/12 附帶定案與增補的併集**，非 issues/06 單張票的原表。06 的 v1 指令表成文在先，未回填後兩票新增的 `open`、`list`、`report slots`；本 SPEC 採併集，逐列標注出處。

### 10.1 指令全表

| 指令 | 說明 | 出處 |
|---|---|---|
| `render <input>` | IR／Markdown 超集 → 單檔產物 | 06 |
| `serve <input>` | dev server ＋ HMR 起 | 06 |
| `close` | dev server 停 | 06 |
| `replay <artifact>` | 從產物內嵌 IR 重繪（換模板／升版／換皮） | 06 |
| `export <artifact> --to pdf\|pptx` | 匯出附屬格式 | 06 |
| `snapshot <target>` | 截圖產物／serve 畫面，讓 Agent（與人）即時看視覺效果 | 06 |
| `init` | 模板包腳手架；`init --plugin` 生成 plugin 骨架 | 06 / 11 增補 |
| `fork <template>` | 從既有模板衍生 | 06 |
| `import-template <zip\|dir\|url>` | 模板匯入（多來源，依 TOML 描述檔識別） | 06 |
| `export-template` | 模板打包分享 | 06 |
| `lint <target>` | 驗模板包或產物（收編既有六套閘門） | 06 |
| `add <pkg>` | npm 模板包安裝進中央儲存庫 | 06 |
| `store list\|rollback` | 中央儲存庫管理（分組、退版） | 06 |
| `store artifacts` | 產物庫查詢 | 12 |
| `list` | 列出當前專案產物（四層解析，見 §9） | 12 |
| `open <產物\|latest>` | 統一跨平台開啟鏈 | 12 |
| `example <block\|template>` | 輸出合法範例（防試錯通道） | 06 |
| `schema` | 輸出 schema（防試錯通道；文件的 block reference 由此自動生成） | 06 / 09 |
| `help` | 說明（防試錯通道） | 06 |
| `comments <artifact>` | 列出產物留言（block id 錨定） | 06 / 12 增補 |
| `report slots` | 按 `intent` 聚類跨專案計數島嶼，驅動升格審查 | 11 增補 |
| `config set\|get\|remove\|list` | 設定管理（`remove` ＝回預設） | 06 |
| `debug` | 診斷（環境、依賴、模板解析過程） | 06 |
| `setup` | 初始化環境（建中央儲存庫、裝渲染依賴如 Playwright） | 06 |
| `ui` | 本地 web UI（見 §13） | 06 待補 / 12 定案 |

> `store` 的子指令集在票面上不一致：06 寫 `store list|rollback`，12 寫 `store artifacts`。本表併列三者，完整子指令集**未定，見 SPEC 演化**。

### 10.2 雙伺服模式

（來源：issues/06 Comments 硬需求二）

遞送層須有雙伺服模式，**兩模式共用同一套元件渲染**：

- **`serve` / watch 模式**：Vite dev server ＋ HMR，資料視圖隨來源檔變更即時熱更新，消滅「重繪後手動重新整理」流程
- **`export` 模式**：離線單檔產物，規格依 §7

### 10.3 Agent 好用語意

（來源：issues/06 Answer 第 3 點）

- **全指令支援 `--json`**（成功與失敗皆機器可讀）；視需求加 `--yaml`
- **驗證錯誤指到 block tree 路徑**，而非 HTML 行號
- **exit code 穩定分類**
- **`render` / `replay` 冪等**
- **`--dry-run` 只驗不寫**
- 安裝：npm 發佈；WSL ＋ nvm 的 `zsh -lic` 慣例入文件

> **已裁決（2026-08-16 F0）**：免安裝入口＝**`npx @kamishibai/sdk`**（npx 對 scoped 套件直接執行其 bin；安裝後 bin 名仍為 `kamishibai`）。issues/06 的「`npx kamishibai`」為成文早於命名實查的筆誤，已於該票 Comments 修訂。npm org `@kamishibai` 已由使用者於 2026-08-16 註冊成功。

---

## 11. 島嶼柵欄與品質閘門

（來源：issues/11 P3）

| 項目 | 規則 |
|---|---|
| 佔比軟上限 | **20%**，以 **block 數與字元權重雙指標取高者**計算；超標 lint 警告、**可覆寫** |
| 島內 script | **禁 `<script>`**——互動一律走元件 |
| 島內 SVG | 沿用既有 GATE **機械項**：viewBox 含界、marker 合法、PDF 鏈 rgba 禁令 |

閘門的其餘職責由 `lint` 收編（六套零散閘門，見 §1.2、§5.3），開關與門檻由模板包 manifest 的 `[gates]` 區段宣告（§5.2）。

---

## 12. 詞彙演化治理

（來源：issues/11 增補，2026-08-16 使用者確認）

三級演化管線——**語言成長的每一步都有數據錨**：「無使用數據不得入主線」。

### 12.1 slot-report（自動蒐集）

- `raw` 島嶼新增**必填欄位 `intent`**：一句話記「為何需要手寫」
- **臨摹失敗自動降級**為帶 `intent` 的島嶼
- 每次 `render` / `lint` append 至 `~/.kamishibai/telemetry/slot-reports-{YYYY-MM}.jsonl`（月切檔，與 baransu 遙測同構）
- 每筆內容：intent、專案、產物、島嶼大小、來源

### 12.2 升格審查

- `kamishibai report slots` 按 `intent` 聚類**跨專案計數**
- **升格條款**：同性質島嶼 **≥3 份產物 或 ≥2 專案** → plugin 候選
- `init --plugin` 生成骨架，**歷史島嶼直接成為 test fixtures**
- plugin block 帶前綴 **`x-*`**，與核心詞彙隔離

### 12.3 轉正／降格條款（falsifiable）

- **轉正**：plugin 於 **≥1 發佈週期**內達成 **≥N 產物**、**≥M 專案**使用、**零未結渲染 bug**、**≥2 模板 manifest 宣告** → 去前綴併入核心；舊名 alias 保留一週期
- **降格**：核心 block 一個觀察窗**零使用** → 降格審查

> N 與 M 的具體數值**未定，見 SPEC 演化**（票面僅寫符號）。

### 12.4 配套 skill

**詞彙演化審查 skill**（使用者指定）：驅動月回看——跑 `report`、判升格、開 plugin 骨架。與產物管理 skill 同住 kamishibai plugin 層；建置順位歸 §16 切片規劃。

---

## 13. UI 模式

（來源：issues/12）

| 題目 | 定案 |
|---|---|
| **能力範圍** | **唯讀管理台＋換皮試穿**——模板 gallery、產物庫瀏覽、換皮試穿（讀產物內嵌 IR 即時切換模板／版本對照預覽）、播放。**不做內容編輯**（著作歸 Agent 通道，避免雙寫入口） |
| **實體形狀** | **`kamishibai ui` 指令**起本地 web UI，架在 `serve` 模式同一套 dev server 基礎設施、同為 Vue 元件（**自吃狗糧**）。不做 Electron、不做雲端 |
| **與 Agent 通道的關係** | **檔案／儲存庫是唯一真源**——UI 的所有操作（選模板、調 config、退版）一律回寫檔案（`config.toml`、store 狀態），UI 不持有獨立狀態；人與 Agent 永遠透過檔案對話 |

### 13.1 留言迭代迴路

（來源：issues/12 增補，2026-08-16 使用者指定，v1 納入）

參照 open-slide.dev 的 comment 機制，但以 IR 結構升級精度——**留言錨定 block id**，Agent 收到的是「哪個 block、什麼意見」，非自然語言猜謎。

- **留言即資料，非編輯**：唯讀原則與檔案唯一真源不破
- **寫入**：`serve` / `ui` 模式下點任一 block 留言，寫入中央產物庫正本旁的 `<產物>.comments.jsonl`（block id 錨點、留言文字、時間、狀態 `open` / `resolved`）
- **Agent 端**：`comments <artifact>`（`--json`）→ 逐條修改 IR → `replay` 重繪 → 標 `resolved`
- **v1 範圍**：`serve` / `ui` 模式可留言；**離線單檔產物唯讀**（`file://` 無法寫檔，離線捕捉留待 v1.x）
- **切片歸位**：S5

---

## 14. 三殼架構

（來源：issues/06 Answer 第 1 點）

```
┌─────────────────────────────────────────┐
│ node library core（可嵌入，程式化客戶 import）│  ← 核心
└─────────────────────────────────────────┘
      ▲                ▲                ▲
   CLI 薄殼         MCP server 殼      UI（§13）
（Agent 主通道）   （同一套 lib API 再包裝）
```

- **CLI 先行，MCP 殼隨後**——公開 SDK 的開箱體驗**不得依賴 MCP 設定**
- MCP 殼列入範圍（切片 S9）

---

## 15. 發佈

（來源：issues/09）

| 題目 | 定案 |
|---|---|
| License | **MIT**（定案）——**尚未生效**：`package.json` 現為 `UNLICENSED` + `private: true`，v1.0 收斂後才轉正 |
| 套件名 | **`@kamishibai/sdk`（已定案）**——npm org `@kamishibai` 於 2026-08-16 由使用者註冊成功（帳號 vakarve）。裸名 `kamishibai` 已被 Re:Earth 影片工具佔走（實查：`curl registry.npmjs.org/kamishibai` → 200，latest 0.4.0），保底名 `kamishibai-sdk` 不再需要 |
| CLI 執行檔 | 一律 **`kamishibai`** |
| 版本策略 | **semver、0.x 起步**；book 遷移完（**S3**）升 **1.0**；兩 plugin 以 `^` 追版 |

### 15.1 私有慣例抽成預設

- **Kami 模板家族**作為出廠內建預設，token 全走 CSS 變數
- **zh-TW chrome 預設 ＋ `--language`** 可換

**Verification task（S1 前）——已完成（2026-08-16）**：TsangerJinKai02 再散布授權查證結果 **NO-GO**（一手官方證據四路印證，報告：`.claude/research/tsanger-jinkai02-license.md`）。出廠字體定案見 §7.2：Noto Serif TC＋Maple Mono CN，Tsanger 降為使用者自裝層。

### 15.2 文件最低標

- README quickstart
- **block reference 由 `schema` 指令自動生成**（單一真源）
- 模板作者指南
- **AGENTS.md**——Agent-first SDK 的門面文件

---

## 16. 遷移策略

（來源：issues/08）

### 16.1 第一驗證客戶＝book

使用者最常用、回饋迴路最密。後果：**S1 核心脊椎前置 book 所需地基**（Markdown 超集編譯、raw 島嶼、基本閘門），wayfinder 後移。

### 16.2 雙軌逐個切

- 每個 skill 遷完即刪舊機制，未遷者照舊
- **舊設施退役綁客戶**：
  - golden-template 三兄弟 ＋ 126 骨架 → 隨 book ＋ design 遷完退役
  - `render_map.py` → 隨 wayfinder
  - `strategic_state.py` 的 HTML 部分 → 隨沙盤

### 16.3 硬約束（使用者指定）

- SDK 程式碼依 **clean architecture** 分層：`parser` / `core` / `render` / `delivery` / `CLI 殼` 獨立模組
- **單檔 < 800 行**
- **明文禁止 5k 行大單檔重演**（現況 `strategic_state.py` 5322 行為反例）

### 16.4 搬家機制

- kamishibai **同時作為 Claude Code plugin 發佈**（`.claude-plugin/` ＋ skills：design、book、產物管理輔助 skill、詞彙演化審查 skill）
- baransu **下個 major 移除 book / design**；過渡期留**薄提示 stub**（僅提示改裝，**一個版本週期後刪**——目前僅使用者一人使用，過渡負擔低）
- marketplace 兩 plugin 並列、互不依賴

### 16.5 切片表 S1–S9

每片走 `/contract` → 實作 → `/seal`。

| 片 | 內容 |
|---|---|
| **S1** | 核心脊椎：IR schema ＋ Markdown 超集編譯 ＋ `render` ＋ Kami 模板家族 v1（長文）＋ CLI 基本盤（`render` / `lint` / `example` / `schema`） |
| **S2** | book 遷移 I：長文路徑（prose／島嶼／figure）＋ 中央產物庫 ＋ `open` / `list` ＋ `replay` |
| **S3** | book 遷移 II：diagram plugin（18 圖型收編）＋ `deck` / `slide` ＋ `export pdf/pptx` ＋ `snapshot` |
| **S4** | 文件類輕客戶：錯字修改表、工作日誌 |
| **S5** | 遞送層補完：`serve` / HMR ＋ `close` ＋ `config` / `setup` / `debug` ＋ **留言迭代迴路**（block id 錨定留言、`comments` 指令） |
| **S6** | 視圖客戶：wayfinder 地圖 ＋ 沙盤遷移；`render_map.py` / `strategic_state.py` HTML 退役 |
| **S7** | design 轉型：`init` / `fork` / `import-template` / `export-template` ＋ **臨摹能力** ＋ `lint` 收編六閘門 |
| **S8** | UI 模式 ＋ 換皮試穿 |
| **S9** | MCP 殼 ＋ npm 公開發佈（銜接 §15） |

**初版驗證戰役範圍 ＝ S1–S5 ＋ design 最小段**（原為 S1–S3，因 12 增補的留言迴路納入 v1 而擴大）。

### 16.6 臨摹能力（S7）

解析圖片／文字／現成畫面（含 CSS + script），逆向重組成暫存模板，入 store 的 **draft 命名空間**、人確認後轉正。（使用者指定新增）

**原則**：臨摹即模板語言的完備性判準——**凡敘述不出來的即 spec 缺口**，失敗案例回饋 block 詞彙演化（§12、§1.5）。

### 16.7 執行指揮層

預設每片直接 `/contract` → `/seal`。當出現**跨 session 停滯或單 session 飽和**，將本地圖 Decisions so far ＋ 切片表交 `/common:strategic-advance` 開戰役——屆時其入場條件自然滿足，**現在不預先啟用**。

---

## 17. 範圍外

（來源：map.md Out of scope）

- **SDK 的實作本身**——地圖終點是可動工規格（含遷移策略）
- **各 skill 的內容合成核心**（book 的 Synthesize、slide 切頁、design 的引導流程）——依 issues/02 定案不納入 SDK

---

## 附錄 A：票號索引

| 票 | 主題 | 對應章節 |
|---|---|---|
| 01 | 專案命名 | §1.1 |
| 02 | SDK 邊界定案 | §1.3 |
| 03 | 模板語言／初始化方案選型 | §4、§5 |
| 04 | 持久化系統形態 | §6 |
| 05 | 雙模式決策 | §2 |
| 06 | 技術形態／runtime | §10、§14 |
| 07 | 現況盤點 | §1.2 |
| 08 | 遷移順序與策略 | §16 |
| 09 | 公開發佈包裝 | §15 |
| 10 | 產物規格 | §7 |
| 11 | IR block 詞彙與模板包 manifest | §3、§3.7、§5.2、§6.1、§7.3、§11、§12 |
| 12 | UI 模式 | §8、§9、§13 |

## 附錄 B：本 SPEC 標記為「未定」的項目

| 項目 | 章節 |
|---|---|
| `remote` video 與 CSP meta 的相容作法（方向：含 remote block 的產物生成僅白名單該供應商的 CSP、lint 明碼標價；精確寫法 S1 contract 釘） | §3.6 |
| `store` 完整子指令集 | §10.1 |
| 轉正條款的 N（產物數）與 M（專案數）——待遙測月回看定值 | §12.3 |

（原列「免安裝入口的實際形式」已於 2026-08-16 裁決為 `npx @kamishibai/sdk`，見 §10.3。）

（地圖 Notes 的「Not yet specified」已清空；上表為蒸餾過程中辨識出的票面空白，不屬原地圖霧項。）

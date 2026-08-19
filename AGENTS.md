# AGENTS.md — 在 kamishibai repo 工作的 Agent 入口文件

> **v0.2（2026-08-18）**。SDK **已經跑得起來**：S1／S2／S3a／S3b／S5 五片封緘，
> 186 測試綠（**機器敏感，見量測報告 §1.5**），CLI 15 個指令可用，中央儲存庫 `~/.kamishibai` 為真實落點。
> 本文是**在本 repo 內開發 SDK 的 Agent** 的入口。規格衝突時以 wayfinder 票面 Answer 為準。

---

## 五行 quick-start（照抄即可）

非互動 context 下 node 走 nvm，**每一行都要包 `zsh -lic`**：

```bash
zsh -lic 'node ./src/cli/index.js setup --json'                            # 1. 建庫＋確認瀏覽器
zsh -lic 'node ./src/cli/index.js example doc > /tmp/demo.md'              # 2. 要一份合法範例
zsh -lic 'node ./src/cli/index.js render /tmp/demo.md -o out/demo.html --json'  # 3. 渲染
zsh -lic 'node ./src/cli/index.js lint out/demo.html --json'              # 4. 驗收（exit 0 才算數）
zsh -lic 'node ./src/cli/index.js snapshot out/demo.html -o out/demo.png --json' # 5. 自己看一眼
```

跑完你會得到：`out/demo.html`（離線單檔、內嵌 IR）、正典副本
`~/.kamishibai/artifacts/<專案>/demo.html`、以及一張 PNG。

---

## 1. 這個專案是什麼

kamishibai（紙芝居）是一套**公開發佈的通用 Agent Presentation SDK**：Agent 著作結構化內容 IR，SDK 確定性地渲染成可單獨生存的離線單檔產物。（來源：issues/01、issues/02、issues/05）

- **刀口**：渲染＋遞送＋模板系統＋持久化歸 SDK；**內容合成歸 skill**。（來源：issues/02）
- **第一批客戶**：baransu 與 common-dev 兩個 plugin；book 是第一驗證客戶。（來源：map.md Notes、issues/08）
- **License**：**目前 `UNLICENSED`，保留所有權利**——v1.0 前不對外授權。issues/09 定案的 MIT 是**目的地、尚未生效**，別在文件或 `package.json` 裡寫成已授權。**Repo**：https://github.com/TLOGBen/kamishibai （來源：issues/09、issues/01）

一句話判準：**如果你在寫「內容怎麼來」，那不屬於這個 repo；如果你在寫「內容怎麼變成畫面、怎麼送出去、存在哪」，那屬於。**

---

## 2. 規格真源在哪

| 檔案 | 角色 |
|---|---|
| **`SPEC.md`** | 實作用規格書。動工前必讀。 |
| `.claude/wayfinder/kamishibai-sdk/map.md` | 決策地圖：Destination、常設原則、12 張票的定案摘要 |
| `.claude/wayfinder/kamishibai-sdk/issues/01`–`12` | **票面本文＝最終真源**。每張的 `## Answer` 是定案，`## Comments` 是脈絡 |
| `.claude/research/tsanger-jinkai02-license.md` | 字體授權查證報告（NO-GO，見 §4.1） |
| `.claude/research/2026-08-19-perf-token-benchmark.md` | 效能／token 一手實測 ＋ 架構缺口報告（三層歸位、模板抽換實測、四項未定決策 U1–U4、測試套件 timeout 判定） |

**優先順序**：issues/*.md 的 `## Answer` > `map.md` > `SPEC.md` > 本檔。
SPEC.md 是蒸餾產物；若它與票面衝突，**以票面為準並回頭修 SPEC.md**。

SPEC.md 附錄 B 列出目前**已知未定**的項目，別在那些地方腦補：
`remote` video 的 CSP 相容作法、`store` 完整子指令集、免安裝入口形式、轉正條款的 N/M 數值。

---

## 3. 硬約束

以下由票面明文指定，**不是建議，是驗收條件**。

### 3.1 clean architecture 分層（來源：issues/08）

`parser` / `core` / `render` / `delivery` / `export` / `serve` / `CLI 殼` 為獨立模組。
核心是可嵌入的 node library，CLI 只是薄殼。（來源：issues/06）
**依賴方向單向**：`core` 不得反向依賴 `delivery` 或任何 I/O 層——`core/lint.js` 由呼叫端餵入
已抽出的 IR payload，正是這條線的體現。

### 3.2 單檔 < 800 行（來源：issues/08）

**明文禁止 5k 行大單檔重演**——現況 `strategic_state.py` 5322 行、`validate-output.ts` 1135 行即反面教材。

### 3.3 每片 contract → seal（來源：issues/08）

每個切片都走 `/baransu:contract` → 實作 → `/baransu:seal`。不要把兩片合成一次做完，也不要跳過 contract 直接寫。（來源：issues/08 §4）

**測試先行**由 repo 慣例採行（票面未載）。實務標準：每個具名驗收條件對應一個具名測試，
測試名帶條件編號（如 `test_a5_lint_fails_on_banned_font_string`），驗收時可逐條對帳。

### 3.4 雙軌並存，不破壞既有 plugin（來源：issues/08）

- 每個 skill **遷完即刪舊機制，未遷者照舊**
- 舊設施退役**綁客戶**：golden-template 三兄弟＋126 骨架隨 book＋design、`render_map.py` 隨 wayfinder、`strategic_state.py` 的 HTML 部分隨沙盤
- baransu 下個 major 才移除 book/design，過渡期留薄提示 stub 一個版本週期

在 kamishibai 這邊做的任何事，**不得讓 baransu / common-dev 現行 skill 當場壞掉**。

### 3.5 開放集原則：臨摹即完備性判準（來源：map.md Notes、issues/08 S7）

模板語言的表達力目標是「能敘述任意圖片、文字與網站」。**凡臨摹不出來的，就是模板語言漏考量的東西**——每次失敗是 spec 的 bug report，不是使用者的錯。

推論：v1 的 block 詞彙表是**開放集的當前快照**，不是封閉清單。想加 block 時走 `SPEC.md` §12 的三級演化管線（島嶼＋`intent` → slot-report 遙測 → `x-*` plugin → 用量達標轉正），**不要直接往核心詞彙表塞東西**——「無使用數據不得入主線」。

---

## 4. 切片進度與當前狀態

**當前狀態（2026-08-18）**：SDK 可用。engine `0.1.0`、套件名 `@kamishibai/sdk`、
**186 測試 / 34 測試檔全綠**（`npm test`，vitest）。

| 片 | 內容 | 狀態 |
|---|---|---|
| **S1** | 核心脊椎：IR schema ＋ Markdown 超集編譯 ＋ `render` ＋ Kami 長文模板 ＋ CLI 基本盤 | **已封緘** |
| **S2** | book 遷移 I：中央產物庫（`KAMISHIBAI_HOME`／原子寫）＋ `list`／`open`／`replay` | **已封緘** |
| **S3a** | `list` block 入詞彙 ＋ `deck`／`slide` 家族 ＋ `kami/slides` 模板＋離線播放 ＋ 詞彙／根形雙層模板守衛 | **已封緘** |
| **S3b** | `diagram` block v1（確定性分層 SVG）＋ `export pdf/pptx` ＋ `snapshot` ＋ sidecar 原子寫 | **已封緘** |
| S4 | 文件類輕客戶：錯字修改表、工作日誌 | 已交付，驗證併入 S5 通過 |
| **S5** | 遞送層補完：`serve`／reload ＋ `close` ＋ `setup`／`debug` ＋ 留言迭代迴路 ＋ 模板命名空間（TOML manifest） | **已封緘** |
| S6 | 視圖客戶：wayfinder 地圖 ＋ 沙盤；舊 renderer 退役 | 未開工 |
| S7 | design 轉型：`init`／`fork`／`import-template`／`export-template` ＋ 臨摹能力 ＋ `lint` 收編六閘門 | 未開工 |
| S8 | UI 模式 ＋ 換皮試穿 | 未開工 |
| S9 | MCP 殼 ＋ npm 公開發佈 | 未開工 |

**初版驗證戰役範圍 ＝ S1–S5 ＋ design 最小段**（來源：issues/12 增補、issues/08）。

### 4.1 已結案的前置查證

**TsangerJinKai02 再散布授權：NO-GO**（2026-08-16 一手官方證據四路印證，報告見
`.claude/research/tsanger-jinkai02-license.md`）。出廠字體定案 **Noto Serif TC（OFL）＋ Maple Mono CN**，
Tsanger 降為「使用者自裝、SDK 偵測使用」層。

因此 `lint` 帶一條**禁用字串規則**（`KSB_BANNED_FONT`）擋下夾帶該字體的產物。
該規則只掃 **CSS 區域**——字體是「被宣告／內嵌」才算再散布，正文只是**提到**名字不算
（CONTRACT A3「內容文字…不在此限」）。改動這條前先讀 `src/core/scan.js` 的模組註解。

### 4.2 何時升級指揮層

預設每片直接 `/baransu:contract` → `/baransu:seal`。**當出現跨 session 停滯或單 session 飽和**，
把 `map.md` 的 Decisions so far ＋ 切片表交給 `/common:strategic-advance` 開戰役。（來源：issues/08 §5）

---

## 5. 環境慣例

| 項目 | 慣例 | 出處 |
|---|---|---|
| Shell | **zsh**（`/usr/bin/zsh`）。不要假設 bash 語法或 rc 檔 | map.md Notes |
| node / npm / npx | **一律走 nvm**；不用系統 node、不 `sudo npm -g` | map.md Notes |
| 非互動 context | nvm 只在互動式 login shell 載入 → 一律包成 **`zsh -lic '...'`** | map.md Notes、issues/06 |
| 檢視語言 | HTML 產物 **zh-TW 預設** | map.md Notes、issues/09 |
| Windows 端 PowerShell | `pwsh.exe`（PowerShell 7），不是 `powershell.exe` | 使用者全域 CLAUDE.md，**非票面** |

```
zsh -lic 'node -v'        # ✅
node -v                   # ❌ 非互動 context 下 command not found
```

### 5.1 `KAMISHIBAI_HOME` — 中央儲存庫的唯一解析點

| 項目 | 值 |
|---|---|
| 環境變數 | `KAMISHIBAI_HOME`；未設時為 `~/.kamishibai` |
| 唯一解析器 | `src/delivery/home.js` 的 `resolveHome()` **及其衍生函式** |
| 標記檔 | `<HOME>/created-by`（內容 `created-by: kamishibai@<版本>`） |
| 產物庫 | `<HOME>/artifacts/<專案名>/<slug>.html`（＋ `<slug>.copies.json` sidecar） |
| 模板包 | `<HOME>/templates/<namespace>/<name>/manifest.toml` |
| 行程狀態 | `<HOME>/run/serve.pid`（暫態，不是紀錄） |

**紅線**：任何要碰儲存庫的路徑，**一律經過 `home.js`**，不准自己 `join(homedir(), …)`。
兩個呼叫端各自拼路徑，就會有一個漏掉覆寫——然後測試寫進開發者的真實儲存庫，
而且下游看不出來。**測試一律用臨時 home**（見 `tests/helpers.js`、`tests/real-home.js`）。

**專案名四層解析**（決定產物歸檔到 `artifacts/` 下哪個資料夾）：
`--project` → `.kamishibai.toml` → git root 資料夾名 → cwd 資料夾名。

---

## 6. Ecosystem routing

（來源：map.md Notes）

- **`/baransu:think`** — 結構化判斷（grilling 型決策）
- **`/baransu:read`、`/baransu:learn`** — research 產物落檔
- **`/baransu:review`** — 規格或實作成形後的二次意見
- **`/baransu:contract`、`/baransu:seal`** — 每片切片的開工與收尾（見 §3.3）

---

## 7. CLI 全表與慣用流程

`kamishibai <指令>`（repo 內直接跑 `node ./src/cli/index.js <指令>`）。
**15 個指令全部支援 `--json`**，成功與失敗皆機器可讀；`--json` 放指令前後皆可。

| 群 | 指令 | 用途 |
|---|---|---|
| 著作 | `example [kind]` | 輸出合法範例（`doc`／`deck` 為 Markdown 超集，其餘為 block JSON） |
| 著作 | `schema` | 輸出 IR 的 JSON Schema（draft 2020-12） |
| 渲染 | `render <input>` | Markdown 超集／block tree JSON → 離線單檔 HTML（`-` 讀 stdin） |
| 渲染 | `replay <artifact>` | 由產物內嵌 IR 重繪（換模板／升版／換皮） |
| 驗收 | `lint <artifact>` | 零外部請求 ＋ 內嵌 IR 齊備且合 schema |
| 驗收 | `snapshot <artifact>` | 截成 PNG，讓 Agent（與人）看得到 |
| 匯出 | `export <artifact> --to pdf\|pptx` | document → pdf、deck → pptx |
| 產物庫 | `list` | 列出當前專案的呈現史 |
| 產物庫 | `open <name>\|latest` | 由產物庫解析並開啟（跨平台開啟鏈） |
| 迭代 | `serve <input>` | 預覽伺服器：來源檔一變就重繪並推播 reload |
| 迭代 | `close` | 終止本 SDK 起的預覽伺服器（沒在跑也算成功） |
| 迭代 | `comments <args...>` | 讀寫產物留言（block id 錨定）：列出／`resolve`／`add` |
| 環境 | `setup` | 建中央儲存庫、確認（必要時安裝）渲染用瀏覽器 |
| 環境 | `templates` | 列出已註冊的模板包 |
| 環境 | `debug` | 診斷：儲存庫位置、模板包數、瀏覽器狀態、引擎版本 |

慣用流程：**不確定 IR 怎麼寫時先 `example`／`schema`，不要試錯**；渲染後**一定 `lint`**；
要給人看之前**自己先 `snapshot` 看一眼**；人留言後 `comments` 讀 → 改來源 → `replay` 重繪 → 標 resolved。

要點：

- **驗證錯誤指到 block tree 路徑**，不是 HTML 行號
- `render` / `replay` **冪等**
- 產物**自帶 IR**（`<script type="application/kamishibai+json">`），任何時點可重繪換皮
- **檔案／儲存庫是唯一真源**——UI 不持有獨立狀態，人與 Agent 永遠透過檔案對話
- 退出碼：`0` 成功、`1` 驗證失敗、`2` 使用錯誤

---

## 8. 給 Agent 的三條紅線

1. **不要在本 repo 寫內容合成邏輯**——那歸 skill（來源：issues/02）
2. **不要為了趕進度寫大單檔**——< 800 行是驗收條件，不是風格偏好（來源：issues/08）
3. **不要在票面沒定的地方腦補**——寫「未定」並回頭補票，比寫一個看起來合理的假設安全

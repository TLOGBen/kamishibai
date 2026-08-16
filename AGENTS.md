# AGENTS.md — 在 kamishibai repo 工作的 Agent 入口文件

> **v0.1 草稿**。蒸餾自 wayfinder 地圖 2026-08-16；衝突時以票面 Answer 為準。
> 本文是**在本 repo 內開發 SDK 的 Agent** 的入口；日後 SDK 發佈後，同名文件亦是
> 「Agent-first SDK 的門面文件」（來源：issues/09 文件最低標）——兩種角色屆時需分家，
> 目前 repo 尚未動工，本文先服務前者。

---

## 1. 這個專案是什麼

kamishibai（紙芝居）是一套**公開發佈的通用 Agent Presentation SDK**：Agent 著作結構化內容 IR，SDK 確定性地渲染成可單獨生存的離線單檔產物。（來源：issues/01、issues/02、issues/05）

- **刀口**：渲染＋遞送＋模板系統＋持久化歸 SDK；**內容合成歸 skill**。（來源：issues/02）
- **第一批客戶**：baransu 與 common-dev 兩個 plugin；book 是第一驗證客戶。（來源：map.md Notes、issues/08）
- **License**：MIT。**Repo**：https://github.com/TLOGBen/kamishibai （來源：issues/09、issues/01）

一句話判準：**如果你在寫「內容怎麼來」，那不屬於這個 repo；如果你在寫「內容怎麼變成畫面、怎麼送出去、存在哪」，那屬於。**

---

## 2. 規格真源在哪

| 檔案 | 角色 |
|---|---|
| **`SPEC.md`** | 實作用規格書。動工前必讀。 |
| `.claude/wayfinder/kamishibai-sdk/map.md` | 決策地圖：Destination、常設原則、12 張票的定案摘要 |
| `.claude/wayfinder/kamishibai-sdk/issues/01`–`12` | **票面本文＝最終真源**。每張的 `## Answer` 是定案，`## Comments` 是脈絡 |
| `.claude/wayfinder/kamishibai-sdk/research/07-inventory-report.md` | 現況盤點（10 套 renderer／3 套主題／6 套閘門），提供「為什麼」的背景 |

**優先順序**：issues/*.md 的 `## Answer` > `map.md` > `SPEC.md`。
SPEC.md 是蒸餾產物；若它與票面衝突，**以票面為準並回頭修 SPEC.md**。

SPEC.md 附錄 B 列出目前**已知未定**的四項，別在那些地方腦補：
`remote` video 的 CSP 相容作法、`store` 完整子指令集、免安裝入口形式、轉正條款的 N/M 數值。

---

## 3. 硬約束

以下五條由票面明文指定，**不是建議，是驗收條件**。

### 3.1 clean architecture 分層（來源：issues/08）

`parser` / `core` / `render` / `delivery` / `CLI 殼` 為獨立模組。核心是可嵌入的 node library，CLI 與 MCP 只是薄殼。（來源：issues/06）

### 3.2 單檔 < 800 行（來源：issues/08）

**明文禁止 5k 行大單檔重演**——現況 `strategic_state.py` 5322 行、`validate-output.ts` 1135 行即反面教材。

### 3.3 每片 contract → seal（來源：issues/08）；TDD（票面未載）

每個切片都走 `/contract` → 實作 → `/seal`。不要把兩片合成一次做完，也不要跳過 contract 直接寫。（來源：issues/08 §4）

**TDD**：由本文任務指定／repo 慣例，**票面未載**——issues/08 的硬約束只列 clean architecture 分層與單檔 < 800 行，未提 TDD。此條若要成為驗收條件，應回頭補票。

### 3.4 雙軌並存，不破壞既有 plugin（來源：issues/08）

- 每個 skill **遷完即刪舊機制，未遷者照舊**
- 舊設施退役**綁客戶**：golden-template 三兄弟＋126 骨架隨 book＋design、`render_map.py` 隨 wayfinder、`strategic_state.py` 的 HTML 部分隨沙盤
- baransu 下個 major 才移除 book/design，過渡期留薄提示 stub 一個版本週期

在 kamishibai 這邊做的任何事，**不得讓 baransu / common-dev 現行 skill 當場壞掉**。

### 3.5 開放集原則：臨摹即完備性判準（來源：map.md Notes、issues/08 S7）

模板語言的表達力目標是「能敘述任意圖片、文字與網站」。**凡臨摹不出來的，就是模板語言漏考量的東西**——每次失敗是 spec 的 bug report，不是使用者的錯。

推論：v1 的 17 種 block 是**開放集的當前快照**，不是封閉清單。想加 block 時走 `SPEC.md` §12 的三級演化管線（島嶼＋`intent` → slot-report 遙測 → `x-*` plugin → 用量達標轉正），**不要直接往核心詞彙表塞東西**——「無使用數據不得入主線」。

---

## 4. 切片路線圖與當前進度

（來源：issues/08 §4 切片表）

| 片 | 內容 | 狀態 |
|---|---|---|
| **S1** | 核心脊椎：IR schema ＋ Markdown 超集編譯 ＋ `render` ＋ Kami 模板家族 v1（長文）＋ CLI 基本盤（`render`/`lint`/`example`/`schema`） | **未開工** |
| S2 | book 遷移 I：長文路徑 ＋ 中央產物庫 ＋ `open`/`list` ＋ `replay` | 未開工 |
| S3 | book 遷移 II：diagram plugin（18 圖型）＋ `deck`/`slide` ＋ `export pdf/pptx` ＋ `snapshot` | 未開工 |
| S4 | 文件類輕客戶：錯字修改表、工作日誌 | 未開工 |
| S5 | 遞送層補完：`serve`/HMR ＋ `close` ＋ `config`/`setup`/`debug` ＋ 留言迭代迴路 | 未開工 |
| S6 | 視圖客戶：wayfinder 地圖 ＋ 沙盤；舊 renderer 退役 | 未開工 |
| S7 | design 轉型：`init`/`fork`/`import-template`/`export-template` ＋ 臨摹能力 ＋ `lint` 收編六閘門 | 未開工 |
| S8 | UI 模式 ＋ 換皮試穿 | 未開工 |
| S9 | MCP 殼 ＋ npm 公開發佈 | 未開工 |

**當前狀態（2026-08-16）**：repo 內只有 `README.md`、`SPEC.md`、本檔與 wayfinder 地圖，**尚無任何實作程式碼；S1 未開工**。

**初版驗證戰役範圍 ＝ S1–S5 ＋ design 最小段**（來源：issues/12 增補、issues/08）。

### 4.1 S1 之前的前置查證

**TsangerJinKai02 再散布授權查證**（來源：issues/09）——npm 內嵌與子集化是否在倉耳免費授權內；否則出廠字體改 **Noto Serif TC（OFL）**，Tsanger 降為使用者自裝層。此項**在 S1 開工前完成**。

### 4.2 何時升級指揮層

預設每片直接 `/contract` → `/seal`。**當出現跨 session 停滯或單 session 飽和**，把 `map.md` 的 Decisions so far ＋ 切片表交給 `/common:strategic-advance` 開戰役。現在**不預先啟用**。（來源：issues/08 §5）

---

## 5. 環境慣例

| 項目 | 慣例 | 出處 |
|---|---|---|
| Shell | **zsh**（`/usr/bin/zsh`）。不要假設 bash 語法或 rc 檔 | map.md Notes |
| node / npm / npx | **一律走 nvm** | map.md Notes |
| 非互動 context | nvm 只在互動式 login shell 載入 → 一律包成 **`zsh -lic '...'`** | map.md Notes、issues/06 |
| 檢視語言 | HTML 產物 **zh-TW 預設**，`--language` 可換 | map.md Notes、issues/09 |
| Windows 端 PowerShell | `pwsh.exe`（PowerShell 7），不是 `powershell.exe` | 使用者全域 CLAUDE.md，**非票面** |
| 不用系統 node、不 `sudo npm -g` | nvm 慣例延伸 | 使用者全域 CLAUDE.md，**非票面** |

範例：

```
zsh -lic 'node -v'        # ✅
node -v                   # ❌ 非互動 context 下 command not found
```

此慣例**要寫進 SDK 文件**（來源：issues/06 Answer 第 3 點）。

---

## 6. Ecosystem routing

（來源：map.md Notes）

session 內 baransu 套件可用：

- **`/baransu:think`** — 結構化判斷（grilling 型決策）
- **`/baransu:read`、`/baransu:learn`** — research 產物落檔
- **`/baransu:review`** — 規格或實作成形後的二次意見
- **`/baransu:contract`、`/baransu:seal`** — 每片切片的開工與收尾（見 §3.3）

---

## 7. 未來 CLI 出現後的 Agent 慣用流程（佔位）

> **佔位段落**：以下流程的指令面已在 SPEC.md §10 定案，但**尚無實作**（S1 未開工）。
> 此段在 S2 中央產物庫落地後應改寫為可執行的實錄，並由 kamishibai plugin 層的
> **產物管理輔助 skill** 承接（來源：issues/12 配套需求、issues/08 §3）。

預期的慣用流程（來源：SPEC.md §10、issues/06、issues/12）：

```
# 1. 不確定 IR 怎麼寫時，先要範例與 schema——不要試錯
kamishibai example <block>
kamishibai schema

# 2. 渲染（冪等；--dry-run 只驗不寫；--json 機器可讀）
kamishibai render <input> --json

# 3. 查當前專案的呈現史（四層專案解析：--project → .kamishibai.toml → git root → cwd）
kamishibai list --json

# 4. 打開給人看（統一跨平台開啟鏈）
kamishibai open latest

# 5. 人在 serve/ui 留言後，讀留言 → 改 IR → 重繪 → 標 resolved
kamishibai comments <artifact> --json
kamishibai replay <artifact>
```

要點：

- **全指令支援 `--json`**，成功與失敗皆機器可讀
- **驗證錯誤指到 block tree 路徑**，不是 HTML 行號
- `render` / `replay` **冪等**
- 產物**自帶 IR**（`<script type="application/kamishibai+json">`），任何時點可重繪換皮
- **檔案／儲存庫是唯一真源**——UI 不持有獨立狀態，人與 Agent 永遠透過檔案對話

---

## 8. 給 Agent 的三條紅線

1. **不要在本 repo 寫內容合成邏輯**——那歸 skill（來源：issues/02）
2. **不要為了趕進度寫大單檔**——< 800 行是驗收條件，不是風格偏好（來源：issues/08）
3. **不要在票面沒定的地方腦補**——寫「未定」並回頭補票，比寫一個看起來合理的假設安全

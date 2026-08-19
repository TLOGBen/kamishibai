# kamishibai 效能／token 成本量測 ＋ 架構缺口報告

> **VERDICT: SDK 的價值命題成立，且可量化** — 同一份來源、同一交付目標下，走 SDK 的 agent
> 比手寫 HTML 的 agent 少產出 **2.51× 的 output token**、快 **2.02×**，且多了一道 `lint` 驗收閘。
> 渲染本身 **0 LLM token**、熱身後 18–34 ms。
> 但量測同時暴露三個結構缺口：**骨架的東西被留在模板包裡**、**沒有版面座標系**、
> **SPEC §11–§12 定義的第三層（slot／plugin）實作進度為 0**。

- **量測日期**：2026-08-19（+0800）
- **量測機器**：WSL2 / Linux 6.18 / node v22.18.0 / 冷啟 npm install
- **受測 commit**：`112097b`（S1／S2／S3a／S3b／S5 五片封緘後）
- **證據強度**：**一手實測**（本機執行、原始數字全數留存；架構結論皆附 file:line）
- **緣起**：使用者要求量測「用本專案產的 HTML 多快、整體花多少 token」，量測過程外溢出架構發現

---

## 一、渲染速度

### 1.1 in-process compile（排除 node 啟動）

| 輸入 | 來源 | HTML 產出 | 首次 | 熱身中位數 |
|---|---|---|---|---|
| `example doc` | 1.7 KB | 2.34 MB | 39.4 ms | **18.4 ms** |
| SPEC.md | 31 KB | 3.22 MB | 64.5 ms | **34.1 ms** |
| SPEC×2 | 63 KB | 3.32 MB | 82.0 ms | 42.1 ms |
| SPEC×4 | 125 KB | 3.53 MB | 114.5 ms | 58.2 ms |
| SPEC×8 | 250 KB | 3.95 MB | 184.0 ms | 93.6 ms |

線性乾淨：**固定 ~16 ms ＋ 0.31 ms/KB**。固定項是字體 base64 內嵌——
`src/render/fonts.js:93` 每次呼叫都重讀 woff2 重編碼，**無 cache**。

### 1.2 CLI 端到端（每次新 node process，N=5 中位數）

| 指令 | 中位數 | 區間 |
|---|---|---|
| node 空啟動 | 17 ms | 16–19 |
| `--version`（純 CLI 啟動稅） | 208 ms | 198–274 |
| `render demo.md` | 239 ms | 231–276 |
| `render SPEC.md` | 395 ms | 291–434 |
| `lint demo.html` | 310 ms | 296–334 |
| `lint SPEC.html` | 288 ms | 265–296 |

- **~190 ms 是 CLI 啟動稅，不是渲染。** `src/cli/index.js` 頂層 eager import 全部 17 個 command；
  單 `src/render/compile.js` 的 import 就佔 ~93 ms。
- playwright（單獨 import 340 ms）**未**被拖進啟動路徑——`export`／`snapshot` 是 lazy 的，這點是對的。
- **改善點**：把 render 以外的 command 改 lazy import，`lint`／`list`／`open`／`debug`
  這類輕指令可省下大半啟動稅。

### 1.3 與 commit 112097b 「210ms」的關係

本機重測 SPEC.md 為 291–434 ms（中位 395）。**該 210 量的是哪個邊界未查證**——
in-process compile 是 34 ms、CLI wall 是 395 ms，210 夾在中間。
**建議日後在 commit／報告裡標注量測邊界**，否則會被誤讀成回歸。

### 1.5 啟動稅的第二個受害者：測試套件本身

本機在 `112097b`（工作區 `src`／`tests`／`templates` 與 commit **完全一致**，`git diff --stat` 為空）
跑 `npm test` 的結果是 **177 passed / 9 failed（共 186）**，與 AGENTS.md 宣稱的「186 測試綠」不符。

**但 9 個失敗全部是 `Test timed out in 5000ms`，沒有一個是斷言失敗**，且失敗的清一色是會
spawn CLI 子行程的測試（`a7-cli-contract`、`b5-open`、`b7-chain`、`d7-conventions`、
`e5-list-human`、`c7-example-schema`、`c2-meta-date`）。

- 平行跑時 `tests 459.21s` vs wall `86.09s`——高度平行，每次 spawn 被拉長。
- **序列重跑**（`--no-file-parallelism`）三個失敗檔：**12/13 通過**，只剩最重的
  `test_formatter_shared_both_paths` 仍逾時（該測試連續 spawn CLI 4 次以上，
  本機單次 `render fixtures/book-sample.md` 實測 **317 ms**）。
- `vitest.config.js` **未設 `testTimeout`**，用 vitest 預設 5000 ms。

**判定：不是回歸，也不是未 commit 的本機修改，是「CLI 啟動稅 × 每測試 spawn 次數」
撞上 5 s 預設預算的環境敏感問題。** 兩個獨立的修法，任一即可：

- **修因**：§1.2 的 lazy import——啟動稅從 ~208 ms 降下來，spawn 密集的測試自然回到預算內。
- **修症**：`vitest.config.js` 設一個明確的 `testTimeout`（並在註解寫明為何要比預設寬）。

**建議修因**，因為同一個啟動稅同時在傷 agent 的使用體感與 CI 穩定度。
在修好之前，「186 測試全綠」這句在文件裡應標注**機器敏感**，否則換一台就變成假紅。

### 1.4 產物組成

| | demo.html | SPEC.html |
|---|---|---|
| 總計 | 2,339,320 B | 3,221,399 B |
| 內嵌字體 | 2,272,304 B（**97.1%**） | 3,038,920 B（**94.3%**） |
| 內嵌 IR | 3,023 B（0.13%） | 52,642 B（1.63%） |
| HTML+CSS+JS 本體 | 63,993 B | 129,837 B |

字體已依 unicode-range 子集化（`fonts.js:selectFaces`），但繁中文件觸及的 chunk 過多，
實務上等同整包嵌入。**產物大小 ≈ 與內容無關的常數項。**

---

## 二、Token 成本（A／B 對照實驗）

**方法**：同一份來源（`AGENTS.md`，12,245 B 繁中技術文件）、同一交付目標
（單檔可瀏覽器開啟、含多層標題／表格／程式碼／提示框／流程圖），
兩個 general-purpose subagent、同模型、同時起跑。
A 組只准走 kamishibai CLI 且不得手寫 CSS/HTML；B 組全手寫且不得碰本專案。

| 指標 | A：kamishibai | B：手寫 HTML | 比值 |
|---|---|---|---|
| **output tokens（agent 實際產出）** | **8,557** | **21,465** | **2.51×** |
| cache_write | 86,858 | 180,735 | 2.08× |
| cache_read | 700,405 | 748,910 | 1.07× |
| billable in | 787,301 | 929,681 | 1.18× |
| harness 回報 subagent_tokens | 49,069 | 62,846 | 1.28× |
| assistant turns | 18 | 17 | — |
| tool uses | 9 | 7 | — |
| harness duration | 183.8 s | 370.8 s | **2.02×** |
| 自報 wall | 111.6 s | 214.1 s | 1.92× |

### 2.1 交付物與品質閘

| | A：kamishibai | B：手寫 |
|---|---|---|
| 產物 | 2.97 MB（字體內嵌） | 35.4 KB（無字體，靠系統 font stack） |
| agent 手打的字 | 12,401 B md ／ 4,353 tok | 35,404 B html ／ 12,267 tok |
| 品質閘 | `lint` exit 0，**首發即過、零重試**（已獨立重驗） | 無；agent 自己 grep 自檢 |
| 離線字體保真 | 是 | **否**（依賴讀者機器裝了什麼字體） |

### 2.2 手寫路徑的 token 花在哪

| 區塊 | tokens | 佔比 |
|---|---|---|
| `<style>` CSS 設計系統（約 260 行） | 3,373 | 27% |
| inline SVG（手算 20 節點座標） | 1,545 | 13% |
| 內容 markup | 7,349 | 60% |

對照 A 組：`diagram` fence 宣告只花 **271 tok**（vs 手畫 SVG 1,545，**5.7×**），CSS **0 tok**，
內容本身 4,082 tok（vs 7,349，**1.8×**——markdown 超集比 HTML 標籤便宜）。

> **關鍵**：手寫路徑的 CSS+SVG 共 4,918 tok（**40%**）是**每份新文件都要重付的固定成本**，
> 且不跨文件複用。SDK 把這 40% 一次性搬進確定性渲染，這就是價值命題的量化形式。

### 2.3 SDK 渲染本身的 LLM token = 0

全程確定性，無模型參與。token 只花在 agent 著作 IR。

---

## 三、觀察到的 agent 行為：為什麼它去讀 source code

A 組 9 次工具呼叫中，唯一一次碰 source code 是
`sed -n '1,60p' src/core/scan.js` ＋ `grep -rn BANNED_FONT src/`，
目的是確認 `KSB_BANNED_FONT` 掃描範圍是全文還是只有 CSS。

**該資訊已在它讀過的 `AGENTS.md:119-121` 明文寫出，它仍去驗證。** 三個原因：

1. **AGENTS.md 自己指路到 code**：`AGENTS.md:121` 寫「改動這條前先讀 `src/core/scan.js` 的模組註解」。
   該句原意是給改規則的人看的，但 agent 不做這個區分——文件裡出現指向 source 的指標，它就會走過去。
2. **成本不對稱**：猜錯＝lint fail ＋ 整份 md 重寫（數千 token）；驗證＝一次 grep（數百 token）。
   **驗證是理性行為，不是浪費。**
3. **CLI 沒有規則自省出口**——這是最該修的一項：

| 表面 | 是否揭露 scope |
|---|---|
| `lint --help` | 完全不列規則 |
| `schema` | 只給 IR schema，與 lint 規則無關 |
| lint 失敗訊息 | `產物含禁用字串 \`TsangerJinKai\`（未取得再散布授權的字體）`——**不提 scope** |
| `src/core/lint.js:33` | `scope: 'css'`，且有完整模組註解說明理由 |

**唯一的權威只存在 source code 裡；而且就算撞到 lint fail，錯誤訊息也教不會它。**

### 建議（低成本、高回報）

- **R1**：新增 `kamishibai lint --rules --json` → `[{code, needle, scope, why}]`。
  把探路從「讀 source」降為一次確定性 CLI 呼叫，且與實作同步、不會像文件那樣漂。
- **R2**：失敗訊息帶上 scope
  （`…；本規則只掃 CSS 區域，正文提及不受限`），讓 lint 就地教會 agent。

> **通則**：agent 願意付 token 去確認的，都是「賭錯要重做」的事。
> 每把一條這種知識從 source code 搬到 CLI 的確定性出口上，就少一次探路。
> 這對一個公開發佈的 SDK 尤其重要——外部使用者沒有 repo 可讀。

---

## 四、能力缺口

### 4.1 diagram v1 的表達力

`src/core/schema.js:18-29` 對節點／邊是 `additionalProperties: false`：

```
diagramNode = { id, label }              // 就這兩個
diagramEdge = { from, to, label? }
kind        = enum ['graph']             // v1 只有一種
```

因此**不支援**：節點副標、節點語意 variant、邊的虛實線、邊的顏色、群組容器框、
圖說 caption（`templates/kami/shared/blocks.js:108` 產 `<figure>` 但無 `<figcaption>`）。

版面：`assignLayers` 是破環後的 longest-path 分層（`findBackEdges`），**層往下、同層往右**，
`NODE_W = 180` 固定。無法產生「第一列往右、第二列往左」的蛇行迴路版面。

**逃生艙**：`raw-html` island 可手貼 SVG，是 IR 裡的 block 所以 replay 得回來，
但**不會重新排版、換模板即失效**。價碼已量到：手畫 SVG 1,545 tok vs `diagram` fence 271 tok。

> **重要**：這些缺的東西**不該塞進 core diagram schema**。
> `SPEC.md:122` 明寫「`diagram` — 結構化圖表 spec，**由 plugin 承載**；book 18 圖型收編起點」，
> `core/diagram.js` 註解亦寫「The 18-diagram-type taxonomy is later work」。
> **核心的 `graph` 保持窄是對的**；帶群組／語意色／虛線的流程圖是另一個 kind，屬第三層。

### 4.2 版面：沒有座標系

`templates/kami/long-form/styles.css` **與** `templates/kami/slides/styles.css` 的 `grid` 出現次數皆為 **0**。
long-form 的 root 是單欄置中：

```js
// templates/kami/long-form/components.js
h('article', {class:'paper'}, [ Masthead, h('main',{class:'doc-body'}, …), footer ])
// styles.css:12  --measure: 740px;   styles.css:40  max-width: var(--measure); margin: 0 auto;
```

對照組手寫的 agent 用一行 CSS 就做出右側目次欄：
`display:grid; grid-template-columns:minmax(0,1fr) 232px`。

#### 24 格座標系（討論結論：支持，但有耦合要一起解）

24 格 row/col 是一組**受限的整數詞彙**，不是自由 CSS，因此過得了「語意進 IR、外觀留模板」這條線：
進 IR 是整數（replay 確定性成立）、模板可重新詮釋同一組座標、export 不構成約束
（`src/export/pptx.js` v1 是每頁全出血截圖，CSS 能做的都會變成像素存活——
**先前以 pptx 表達力反對多欄的理由不成立**）。

**必須一起處理的耦合**：

- `src/core/diagram.js` 的幾何綁死在 740px 上。模組註解自陳
  「an artifact's SVG is scaled to the text measure (**740px in long-form**)」，`NODE_W = 180` 照此調校。
  **一旦 block 只佔 24 格中的 8 格，diagram 會在它不知道寬度的格子裡被壓扁。**
  24 格制落地時，diagram layout 必須從「假設 740」改成「收一個可用寬度參數」。
- `--measure: 740px` 現為字級節奏基準常數，24 格制下須變成「格寬 × 跨格數」的推導值，兩套不可並存。

---

## 五、三層架構歸位

使用者提出的切法（**SDK ＝ 讓所有功能正常的骨架 → template ＝ 骨架之上換肉換皮 → plugin/slot ＝ 擴充**）
與 `SPEC.md:77-81` 已載的三層互補模型一致：

> - **island**（raw 逃生艙）／**slot**（模板側具名槽位，book `data-slot` 為雛形）／
>   **plugin**（渲染器側擴充，把反覆出現的島嶼模式升格為結構化 block 類型）
> - **演化路徑**：raw 島嶼是起點逃生艙，plugin 讓島嶼逐步轉正

`SPEC.md` §12 連升格機制都已定死：遙測寫 `~/.kamishibai/telemetry/slot-reports-{YYYY-MM}.jsonl`、
`report slots` 跨專案聚類、**≥3 份產物或 ≥2 專案 → plugin 候選**、`init --plugin` 生骨架、
歷史島嶼直接成為 test fixtures、plugin block 帶 `x-*` 前綴與核心隔離。

### 5.1 實作歸位表（2026-08-19 實測）

| 層 | 應該有的 | 現況 |
|---|---|---|
| **骨架 SDK** | parser / core / render / delivery / export / serve / CLI | ✅ 到位 |
| | block→markup 對應 | ⚠️ **錯放**在 `templates/kami/shared/blocks.js`（211 行，兩模板共用，與 kami namespace 無關） |
| | deck 播放語意（鍵盤翻頁／fullscreen／進度／無 JS 降級） | ⚠️ **錯放**在 `templates/kami/slides/playback.js`（63 行） |
| | 版面座標系 | ❌ 不存在 |
| **換皮 template** | styles.css ＋ manifest ＋ 版面包殼 | ✅ 但包殼仍是 Vue code（long-form 20 行／slides 50 行） |
| | 可從 `~/.kamishibai/templates/` 載入 | ❌ **登記得了、載不了**（見 5.2） |
| **擴充 plugin/slot** | slot 具名槽位 | ❌ grep 全 `src/`＋`templates/` 零命中 |
| | `x-*` plugin block | ❌ `core/blocks.js`／`schema.js`／`vocabulary.js` 零命中 |
| | 島嶼遙測 ＋ 升格通道 | ❌ 無 telemetry 目錄、無寫入點；CLI 15 指令無 `init`、無 `report` |

註：`src/parser/container.js:15` 的 `containerPlugin` 是 markdown-it plugin，與本層無關。

另有一處數字對不上：`SPEC.md:95` 稱「核心詞彙表共 **17 種** block」，
實作 `BLOCK_TYPES` 為 **11 種**（section / prose / quote / callout / code / table / raw / list / deck / slide / diagram）。

### 5.2 模板抽換能力：實測

放一份 `~/.kamishibai/templates/acme/deck/manifest.toml` 後：

```
$ kamishibai templates --json
[{"namespace":"acme","name":"deck","version":"1.0.0","root":""}, …]        ← 列得出來

$ kamishibai render demo.md -t acme/deck
{"ok":false,"errors":[{"code":"KSB_TEMPLATE_NOT_FOUND",
  "message":"unknown template \"acme/deck\"; available: kami/long-form, kami/slides"}]}   ← exit 1
```

**中央儲存庫的 template namespace 目前只是登記簿，不是載入點。**
`src/render/templates.js` 的 REGISTRY 是靜態 Map，`resolveTemplate` 無 store fallback。
這是「模板可抽換」的真正阻擋點——**不是型別問題**。

### 5.3 關於「改 TS 抽 interface」

介面**已經存在且已被 duck-typed 消費**：`{ manifest, key, root, language, fonts, styles(), script?() }`
（`src/render/index.js` 甚至已在處理選配成員：`typeof template.script === 'function'`）。
唯一硬指到具體模板的是 `src/render/templates.js:1-9`，而那是 `SPEC §6.1` 定義的**出廠註冊表，本來就該硬寫**。

扣掉要收回 SDK 的 `shared/blocks.js` 與 `playback.js` 後，**一個模板剩下的程式碼只有 20–50 行版面包殼**，
在 24 格制下正好等於「哪個區塊放哪幾格」——**可宣告化**。
模板一旦是純資料（manifest ＋ CSS ＋ 宣告式版面），載入就不涉及任意程式碼執行。

**結論**：要凍結的不是「帶 Vue component 的 duck-typed 物件」，而是**一個 schema**；
而本 repo 凍結 schema 的既有機制是 `core/schema.js` 的 JSON Schema ＋ `kamishibai schema` 指令。
模板包走同一套，`templates` 指令即可驗證第三方模板包，與 `lint` 驗 IR 同機制、同 `KSB_` 錯誤碼系。
TS／`.d.ts` 仍值得做（給 embed 本 library 的人），但**不在模板抽換的關鍵路徑上**。

### 5.4 menu（目次）與 slot 的關係

**目次今天就能做，不需要等座標系進骨架——因為它不是 slot 的形狀。**

`templates/kami/shared/blocks.js:86` 已把標題樹與錨點放進 DOM：

```js
h('section', { class: `section section-l${level}`, id: props.block.id }, [
  h(`h${level}`, { class: 'section-title' }, props.block.title), … ])
```

IR 側 `core/blocks.js:26` 的 `section = ({title, level, children})` 帶得動，replay 也回得來。
**目次是從這棵樹推導的，不是作者寫的**——它與 `Masthead`、`colophon` 同類（模板自算的 chrome，
long-form 的 root 已經有兩個）。位置也只需模板自己的 CSS，**模板用 CSS grid ≠ 骨架有座標系**。
順帶：走 chrome 路線它不計入 §12 的島嶼佔比遙測，這是對的——它不是自訂內容。

**但「可攜的 slot」確實要等座標系進骨架。** `SPEC.md:79` 給 slot 的定義是
「**自訂內容**可以出現的位置」。若 slot 只是模板自己 CSS 裡挖的洞，slot 名字就跨不了模板——
`replay -t` 換皮時，塞在 `kami/long-form` 的 `rail` 裡的東西，到了沒有 rail 的模板就消失，
而那正是 replay 的賣點所在。要讓 slot 屬於第二層而非每個模板的私有洞，
就需要一組**跨模板共通的位置詞彙**——24 格座標系就是那組詞彙。

> 精確說法：**menu 不用等 grid；slot 要可攜才要等 grid。**
> 這也是為什麼順序是「骨架補齊 → slot」而非反過來——slot 先做，會做出一堆綁死在 long-form 上的洞。

---

## 六、未定決策（建議開票）

以下四項在討論中浮現、**尚未定案**，不要在票面之外腦補：

| # | 問題 | 為何重要 |
|---|---|---|
| U1 | **diagram 的擴充欄位走語意還是外觀？** | 既有前例 `callout` 是 `variant: note\|warn`（語意）而非「黃色框」。走語意則 replay 換模板會跟著換皮；走外觀則版面跑進 IR，與 `issues/02` 刀口衝突。牽動 §4.1 那五樣缺口該進 core 還是 plugin。 |
| U2 | **24 格座標系的詞彙形狀，以及 `--measure` / diagram 寬度假設的遷移** | 兩者不可分開做（見 §4.2）。 |
| U3 | **模板包格式：宣告式 schema 的欄位集，以及 loader 的信任邊界** | 決定 §5.2 的 loader 長什麼樣；模板若為純資料則無程式碼執行問題。 |
| U4 | **slot 遙測的隱私與預設值** | `SPEC §12.1` 要求每次 `render`/`lint` 往 `~/.kamishibai/telemetry/` append **跨專案**資料。公開發佈的 MIT SDK 需決定預設開／關、寫入內容、告知義務。**現在還沒實作，是最便宜的決定時機。** |

另建議修正兩處文件事實：`SPEC.md:95` 的「17 種 block」與實作的 11 種不符（§5.1）；
commit／報告中的 ms 數字應標注量測邊界（§1.3）。

---

## 七、建議順序

1. **骨架歸位** — `shared/blocks.js` ＋ `playback.js` 收回 SDK；deck 的 DOM 契約
   （`.deck`／`.slide`／`.is-current`／`.deck-progress`）寫進 SPEC。
   **注意**：playback 上升為 SDK 供應後，`render/index.js` 目前的 per-template optional
   `script` 分支形狀會變，且模板將失去 opt-out 能力——要不要保留 opt-out 需拍板。
2. **骨架補齊** — 24 格座標系，同時解掉 `diagram` 對 740px 的假設（U2）。
3. **第二層打通** — 模板包 schema ＋ loader（此時包殼已可宣告化，載入的是資料）（U3）。
4. **第三層開工** — **slot 先於 plugin**（沒有槽位，plugin 沒地方插；沒有遙測，升格條款沒資料）（U4）。

在第 4 步之前，圖表類需求就老實用 `raw-html` island，**並在 `intent` 裡寫清楚**——
那些 intent 就是將來 `report slots` 的原料。

低成本可先做、不擋路的：**R1 / R2（lint 規則自省出口）**、
**CLI lazy import**（§1.2）、**目次 chrome**（§5.4）。

---

## 附錄：復現方式

```bash
zsh -lic 'npm install && node ./src/cli/index.js setup --json'
zsh -lic 'node ./src/cli/index.js example doc > /tmp/demo.md'
zsh -lic 'node ./src/cli/index.js render /tmp/demo.md -o /tmp/demo.html --json'
zsh -lic 'node ./src/cli/index.js lint /tmp/demo.html --json'   # exit 0 才算數
```

- CLI 端到端計時：對每個指令跑 5 次新 process，取 `date +%s%N` 差值中位數。
- in-process 計時：直接 import `src/render/compile.js`，同一 source 連跑 N 次，
  首次與其餘分開報（首次含 module 圖 warm-up）。
- token 對照：兩個 subagent 同來源同目標，用量自 subagent JSONL transcript 的
  `.message.usage` 逐筆加總（input／output／cache_creation／cache_read）。
- 文字 token 估計用 `tiktoken` o200k_base；**繁中文本的估值僅供路徑間相對比較**，
  絕對值與 Anthropic tokenizer 不同。

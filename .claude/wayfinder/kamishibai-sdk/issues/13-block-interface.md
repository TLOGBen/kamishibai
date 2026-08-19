# Block 標準轉換接口與模板職責邊界

Status: open
Type: grilling
Blocked by: 03, 11

## Question

一個 block 型別的「標準轉換」接口該長什麼樣，模板在它之上負責到哪裡為止？

這張票的觸發點是一個可量測的事實：**現在一個 block 型別散在 11 個檔案裡。**

```
callout → core/blocks.js  core/schema.js  core/example.js
          parser/tokens.js  parser/container.js  parser/index.js
          templates/kami/shared/blocks.js
          long-form/manifest.js  long-form/styles.css
          slides/manifest.js     slides/styles.css

diagram → 同樣 11 個（多 core/diagram.js、render/index.js；少 container 兩個）
```

現行切片維度是**層**（issues/08 要求的 parser／core／render／delivery 單向依賴），
對**管線**是正確的。但擴充的單位是 **block**，而 block 橫跨每一層。

**結論：第三方要新增一個 block，必須改 SDK 內部 11 個檔案。**
SPEC §11–§12 的 plugin（`x-*` block）**不是「還沒實作」，是在結構上不可能**——
在切片維度轉過來之前做不了。

### 待裁決的子問題

1. **接口欄位集**——一個 block 模組該自帶哪些東西？候選：
   `type` / `syntax`（在 Markdown 超集裡如何被辨識）/ `schema`（JSON Schema 片段，併入 IR schema）/
   `example`（餵 `kamishibai example <kind>`）/ `validate?`（schema 之外，如 `assertDiagrams`）/
   `render`（block → markup）/ `styleHooks`（它吐出哪些 class）。
2. **`render` 的回傳型別**——見下方「已識別的硬約束」，這題會連鎖決定 plugin 能不能是資料。
3. **模板職責的三分**——paint（對 hook 上色）／chrome（附加定義）／准入與配置，
   邊界畫在哪、各自是資料還是 code。
4. **`layout` 排除後 `diagram` 怎麼辦**——使用者已定調 layout 屬更上層圖層，
   但 `Diagram` 的 render 目前直接呼叫 `layoutGraph`。
5. **與 03 的關係**——見下方「與既有定案的衝突面」。

## Answer

**未定。** 2026-08-19 由使用者提出，待其研究後裁決。**不要在此腦補實作。**

## Comments

### 這條線 code 已經在遵守了，只是沒有名字

`templates/kami/shared/blocks.js` 共 211 行，掃過後**只有一處裝飾洩漏到轉換裡**：

```js
const CALLOUT_LABELS = Object.freeze({ note: 'NOTE', warn: 'WARNING' })
```

`'NOTE'` / `'WARNING'` 是使用者看得見的英文字，寫死在 zh-TW 模板家族的共用轉換裡；
模板要換成「注意」／icon／拿掉，只能 fork 共用元件。依本票的切法它屬於**裝飾**。

其餘全部是乾淨的轉換（`.prose` 依 HTML 合法性選 `<p>`/`<div>`、`.quote`、`.code` +
`language-*`、`.table-wrap`/`.table`、`.island` + `data-intent`、`.list`、
`.section .section-l{n}` + `id`、`.diagram` + `data-diagram-kind`）。

而且**同一條規則已經被寫下來兩次，都寫在註解裡**：

- `templates/kami/long-form/styles.css:266`
  > 以欄數選取而非新增 class——Table 元件只吐 `.table-wrap` / `.table` 兩個 hook，
  > **模板樣式不得要求 IR 多帶資訊。**
- `templates/kami/shared/blocks.js:96`
  > The geometry deliberately lives outside the template …
  > **What a template may still own is the paint** — the classes below are styled
  > by each stylesheet's own palette variables.

**所以本票不是引入新原則，是把一條已在運作的隱性不變式提成有型別、可驗、
可被第三方實作的接口。**

### 已識別的硬約束：`render` 不能回傳 Vue vnode

現況：

```js
const Callout = (props) => h('aside', { class: `callout callout-${props.block.variant}` }, [...])
export const RENDERERS = Object.freeze({ section: Section, prose: Prose, … })
renderChildren → h(RENDERERS[block.type], { key: block.id, block })
```

`h` 來自 Vue。若接口的 `render` 是這個形狀，連鎖三件事：

1. 每個第三方 plugin 硬相依 Vue 3
2. 模板永遠不可能是純資料——與「模板本身不需要獨立執行，產出才要」直接衝突
3. `x-*` plugin block 會夾帶可執行 Vue 元件 → 載入第三方 plugin 等於任意程式碼執行

**候選解**：`render` 吐中性元素樹（`{tag, attrs, children}`），由 render 層接到 SSR 後端上，
Vue 退回成 render 層的實作細節而非 plugin 契約的公開 API。
如此則模板可以是資料、plugin 可以是資料、載入不需要信任邊界（連動 U3）。

### 模板職責三分的現況盤點

| 模板負責 | 現在在哪 | 資料 or code |
|---|---|---|
| **paint** — 對著 hook 上色 | `styles.css` | 資料 |
| **chrome（附加定義）** — 不屬於任何 block、由 meta／結構推導：`Masthead`、`colophon`、slides `DeckChrome`／進度條、（未來）目次 | `components.js` | **code**，20（long-form）／50（slides）行 |
| **准入與配置** — `manifest.blocks`、`root` 形態、`fonts`、（未來）24 格擺位 | `manifest.js` | 資料 |

三份裡兩份已是資料；剩下 20–50 行在 24 格 ＋ slot 模型下多半也會變成
「哪個 chrome 擺在哪幾格」。**「模板 = 純資料」在此模型下是算術結果，不是願景。**

### 接口成立後可解鎖的新驗收面

`styleHooks` 一旦是宣告出來的資料（現在只靠註解守），可 lint 兩件目前完全看不見的事：

- 模板 CSS 引用了沒有任何 block 宣告的 hook → **死樣式**
- block 吐了模板沒上色的 hook → **產物沒壞、`lint` exit 0、`replay` 正常，但視覺崩掉**

第二條是這類系統最惡毒的失敗模式，而本 repo 的判準是「exit 0 才算數」。

### 設計時的試金石：`diagram`

`Diagram` 是唯一在 render 裡呼叫 layout 的 block：

```js
const Diagram = (props) => { const layout = layoutGraph(props.block); … }
```

依「layout 屬更上層圖層」，該呼叫不應在 block 的轉換內，layout 結果應由上層餵入。
這同時解掉 `core/diagram.js` 對 `--measure: 740px` 的硬編碼假設（見量測報告 §4.2）。

**設計接口時應以 `diagram` 驗證，而非 `prose`**——簡單 block 不會暴露接口缺陷。

### 與既有定案的衝突面（必讀）

**本票部分重啟 `03-template-language.md` 的定案 2**，該票 Answer 明文寫著：

> 模板＝**Vue 元件家族**＋具名 slot＋token 詞彙＋閘門 manifest

若採「`render` 吐中性元素樹」，則 block 的轉換不再是 Vue 元件，
模板的 chrome 是否仍為 Vue 元件成為獨立的子問題。
依真源優先序（issues `## Answer` > map.md > SPEC.md > AGENTS.md），
**本票裁決後必須回頭修 03 的 Answer 與 SPEC §5／§6，不得只改 SPEC。**

### 對既有工作順序的修正

先前建議的第 1 步是「把 `shared/blocks.js` 收回 SDK」。**照本票的切法那不夠**——
搬過去仍是 211 行單體，只換了地址。正確形狀是**拆成 11 個 block 模組**，各自帶
parse／schema／example／render／styleHooks。

拆解風險：`shared/blocks.js` 內有承重註解（如 `BLOCK_LEVEL_CONTENT` 解釋為何 `prose`
要在 `<p>`／`<div>` 間擇一——`<p>` 包 `<ul>` 會被瀏覽器隱式關閉，實際 DOM 變成兩個空 `<p>`
加一個逃出 `.prose` 樣式範圍的 list）。**這些理由必須隨程式碼搬移，否則拆完即蒸發。**

修正後順序：

1. **本票**（定義 block 接口，拆成 11 個 block 模組）；`playback.js` 收回 SDK 照舊
2. 版面座標系（U2），`diagram` 改為接收上層寬度
3. 模板包 schema ＋ loader（U3）
4. slot → plugin（`x-*` 套用本票的同一接口）

第 4 步之所以會變便宜：本票做完後，**「核心 block」與「plugin block」是同一種東西，
差別只在名字前綴**。

### 相關

- 量測與缺口報告：`.claude/research/2026-08-19-perf-token-benchmark.md`
  （§5 三層歸位、§6 未定決策 U1–U4）
- 本票是 **U1（diagram 擴充走語意或外觀）** 與 **U3（模板包格式與載入信任邊界）** 的共同前提

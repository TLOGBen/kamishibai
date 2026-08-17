# CONTRACT — S3a：list block＋deck/slide 家族＋播放模式最小版

## 目標
IR 詞彙補上 `list` 型別（修復「清單內 callout 拆外框」的既知取捨），並讓同一份
Markdown 超集能渲染成簡報：deck 產物含逐張 slide、內建鍵盤播放，離線單檔照舊。

## 前提（Premises）
- P1 `已驗`：基底＝S2 sealed（commit 3acfcda）、87 測試綠。
- P2 `已驗`：SPEC §3 詞彙表為開放集（`list` 為 v1 未列之擴充，S2 隨行清單載重項）；deck/slide 見 SPEC §3 簡報組。
- P3 `已驗`：播放模式為產物硬能力（SPEC §7.4：全螢幕、方向鍵/空白鍵翻頁、Esc、進度指示；講者備註等進階項不在本片）。
- P4 `已驗`：frontmatter 裸 `date:` 被 gray-matter 解析為 Date 物件後遭 buildMeta 靜默丟棄（S4 delegate 第一手重現）。

## 可斷言條文
G2 陷阱升條文：清單巢狀與 callout-in-list 的歷史取捨（tokens.js 註解明文）→ C1；hr 靜默吞掉 → 本片僅於 deck 模式賦義（C4），文件模式仍列冊。
- [ ] C1 **list block**：`{type:"list", ordered:bool, items:[block[]…]}` 入 IR schema 與 parser——bullet/ordered/巢狀清單成為真 block；**清單內 callout 不再拆外框**（`<ul|ol>` 結構保留、callout 為 item 內子 block，走 Callout 元件含標籤）；純清單不再經 prose html 路徑。既有「來源 ⇔ IR callout 計數對稱」測試照綠。
- [ ] C2 **date 修復**：buildMeta 對 Date 物件轉 `YYYY-MM-DD` 字串；裸 `date: 2026-08-17` 與引號版產出相同 meta（釘死測試含兩形）。
- [ ] C3 模板層：長文模板以 `.prose`-一致樣式渲染 list block（沿用既有清單 CSS）；`test_render_body_blocks` 對稱斷言涵蓋 list。
- [ ] C4 **deck 模式**：frontmatter `template: kami/slides` 時，文件以 `---`（thematic break）為切頁符編為 `{type:"deck", slides:[…]}`；渲染產物每張為 `<section class="slide">`、16:9 版面基準；首張含 title/kicker（frontmatter）；`--json` 輸出增列 `slides:<int>` 頂層鍵（僅 deck 產物）。
- [ ] C5 **播放最小版**：deck 產物內建離線 JS——方向鍵/空白鍵翻頁、Esc 離開全螢幕、`f` 進全螢幕、進度指示（`n/N`）；零外部請求照舊（A3 禁形掃描沿用）；lint 對 deck 產物 exit 0（島嶼掃描不誤殺內建播放 script——它是模板層資產非 raw 島嶼）。
- [ ] C6 IR/replay 一致：deck 產物內嵌 IR 含 deck block tree；`replay` 重繪 byte-identical（KAMISHIBAI_BUILD_TIME 釘死）。
- [ ] C7 回歸：既有 87 測試照綠；`kamishibai example deck` 輸出合法 deck 語料並 round-trip（example 家族擴充）；schema 輸出含 list/deck/slide 定義且 IR 過驗。
- [ ] C8 分層與紀律照舊（單檔 ≤800、cli 禁 vue、--json 慣例、formatter 兩路）。

## 錯不起表面（Surface Inventory）
| 表面 | 格式 | 釘死測試 |
|------|------|----------|
| list 渲染本體 | `<ul>`/`<ol>` 結構保留＋item 內子 block 可辨識；IR⇔body 對稱 | test_render_list_block |
| deck 產物 | 每張 `<section class="slide">`；張數≡`---` 分段數；首張 title | test_render_deck |
| render deck `--json` | 四鍵＋`slides:<int>`（文件產物不帶此鍵） | test_render_json_shape_deck |
| 播放 chrome | 內建 script 存在且含鍵盤處理；lint exit 0 | test_deck_playback_offline |
| example deck | round-trip 回 render exit 0 | test_example_deck_roundtrip |

## Verbatim Constants
```
list IR 欄位:     type:"list", ordered, items
deck 切頁符:      ---（thematic break，僅 template: kami/slides 時生效）
slide 容器:       <section class="slide">
deck --json 增鍵: slides
slides 模板 id:   kami/slides@0.1.0（namespace kami）
播放鍵:           ArrowRight/ArrowLeft/Space=翻頁, f=全螢幕, Esc=離開
date 正規形:      YYYY-MM-DD
```

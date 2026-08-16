# CONTRACT — S1 核心脊椎：IR＋render＋Kami 長文模板＋CLI 基本盤
> STATUS: sealed（2026-08-16）— 五點全符合：A1–A10 逐條過、7 表面全釘死、跨 UI 單一 formatter、九組常數 byte-exact、突變 2/2 被攔（歷三輪 21 findings 修復後 clean）

## 目標
repo 內出現可運作的 SDK 第一片：CLI 能把 Markdown 超集或 block tree JSON 渲染成
離線單檔 HTML（Kami 長文模板、字體子集內嵌、IR 隨行），並以 lint／example／schema
形成 Agent 防試錯迴路。全程 TDD，clean arch 分層。

## 前提（Premises）
- P1 `已驗`：規格真源＝SPEC.md@2919955（本 session 蒸餾並經指揮官逐條驗收）。
- P2 `已驗`：vite-plugin-singlefile@2.3.3 存在且支援 vite ^5.4‖^6‖^7‖^8（registry 實查 2026-08-16）。
- P3 `已驗`：Noto Serif TC（google/fonts ofl 目錄 HTTP 200）與 Maple Mono CN（Maple-font v7.9 release 含 MapleMono-CN.zip）可離線取得、OFL 可散布（實查 2026-08-16）。
- P4 `已驗`：IR 內嵌 type＝`application/kamishibai+json`（issues/11 P4；SPEC §7.3）。

## 可斷言條文
G2：本任務無既有程式面可讀（greenfield），查無程式陷阱；條文僅由 SPEC 推導。
- [ ] A1 `kamishibai render fixtures/book-sample.md -o out/book.html` exit 0，產出恰一個 .html 檔。
- [ ] A2 產物含恰一個 `<script type="application/kamishibai+json">`，JSON 可解析且含全部欄位：`irVersion, engine, template{namespace,name,version}, doc, createdAt, generator`。
- [ ] A3 產物禁出現任何會發外部請求的資源引用：`<link …href=`、`<script …src=`、`<img …src="http`、`@import`、`url(http`（內容文字與 `<a href>` 的外部連結不在此限）。
- [ ] A4 產物內嵌 WOFF2 data URI 字體子集（至少 Noto Serif TC）；**凡 CSS 宣告之具名字族必有對應內嵌 face（宣告即內嵌）**；全檔禁出現字串 `TsangerJinKai`。（seal 補釘：Maple Mono CN 內嵌延至 S3，S1 等寬用 generic monospace）
- [ ] A5 `kamishibai lint <A1產物>` exit 0；對 fixtures/broken/（缺 IR、含外部 `<script src>` 兩案）exit 1，`--json` 錯誤物件含 `path`＋`code`；**增列乾淨案：內容文字含禁形字樣（code block 內 `@import url(https://…)`）之文件、與內容含 `<!--` 之文件，render 後 lint 皆須 exit 0**（seal 補釘 F1/F2）；**增列壞案：raw 島嶼內活 `<style>@import url(https://…)</style>` 與 `style="…url(http://…)"` → lint exit 1 且 code 含 `KSB_EXTERNAL_CSS_IMPORT`／`KSB_EXTERNAL_CSS_URL`**（複驗補釘 F-C）。
- [ ] A6 防試錯自證：`kamishibai example doc | kamishibai render - -o out/e.html` exit 0（example 輸出必為合法輸入）；`kamishibai schema` 輸出合法 JSON Schema 且 A2 之 IR 通過其驗證。
- [ ] A7 **任何呼叫形**（四指令＋無指令＋未知旗標）在 `--json` 下 stdout 恆為單一合法 JSON 物件（成敗皆然）；exit code：0=成功、1=驗證失敗、2=用法錯誤；`--help`/`--version` 僅於明示要求時 exit 0（seal 補釘 F3）；**用法錯誤之 `message` 禁含 commander 內部 token（禁列：`(outputHelp)` 等），且「無指令」之 message 於人類路與 `--json` 路完全相同**（複驗補釘 F-A）。
- [ ] A8 冪等：設 `KAMISHIBAI_BUILD_TIME` 固定時間戳後，同輸入連跑兩次 render 產物 byte-identical。
- [ ] A9 分層：`src/` 下存在 `parser/ core/ render/ delivery/ cli/` 五層目錄；`cli/` 內任何檔案禁 `import`/`require` `vue`；任一源檔 ≤800 行（腳本檢查）。
- [ ] A10 `npm test` exit 0；A1–A9 每條在測試碼中有具名對應測試（見下表）。

## 錯不起表面（Surface Inventory）
| 表面 | 格式 | 釘死測試 |
|------|------|----------|
| render `--json` 成功 | `{"ok":true,"artifact":"<abs path>","bytes":<int>}` 無其他頂層鍵；**`bytes` ≡ 產物檔案真實 UTF-8 byte 長度（與 `statSync(artifact).size` 相等，禁 UTF-16 code unit 數）**（第三輪補釘 F-1） | test_render_json_shape |
| lint `--json` 失敗 | `{"ok":false,"errors":[{"path":"<block path>","code":"<KSB_*>","message":"<非空字串>"}]}`；**每筆 message 長度 > 0，且人類路輸出逐字包含同一 message**（終審補釘 F-1） | test_lint_json_errors |
| example stdout | 即合法輸入本身（round-trip 由 A6 釘） | test_example_roundtrip |
| schema stdout | JSON Schema（draft 2020-12，`$schema` 欄位必在） | test_schema_valid |
| 人類可讀輸出（四指令） | 與 `--json` 共用同一結果物件經單一 formatter 產生；兩路皆有測試（**含 lint 成功路**，seal 補釘 F5）；**錯誤摘要行 `✖ {N} 個問題：` 之 N ≡ errors.length**（複驗補釘 F-D） | test_formatter_shared_both_paths |
| 渲染本體（每個 block 型別） | body 內有可辨識輸出；**IR 有則 body 有**對稱斷言（seal 補釘 F4）；**callout 標籤文字逐 variant 釘死（note→NOTE、warn→WARNING），且 fixture 語料窮舉 `CALLOUT_VARIANTS` 每一項**（終審補釘 F-2）；**`<p class="prose">` 內禁出現 `<ul|ol|div|pre|table|blockquote`（block-level 內容改用 `<div class="prose">` 容器），對稱斷言之 `block.html` 須非空**（第二輪終審補釘 F-A/F-B）；**字體子集有下界：內嵌 face 數 ≡ 依產物正文 codepoints 重算之應選 face 數**（F-C） | test_render_body_blocks |
| `--help --json` / `--version --json` | `{"ok":true,"help":"…"}`（help 非空）/ `{"ok":true,"version":"<semver>"}`（version 比對 engine，頂層鍵恰為所列） | test_a7_explicit_help_and_version_exit_zero |

## Verbatim Constants
```
script type:      application/kamishibai+json
IR 欄位:          irVersion, engine, template.namespace, template.name, template.version, doc, createdAt, generator
env:              KAMISHIBAI_BUILD_TIME
exit codes:       0=成功 1=驗證失敗 2=用法錯誤
錯誤碼前綴:       KSB_
禁字串:           TsangerJinKai
外部資源禁形:     <link …href= / <script …src= / <img …src="http / @import / url(http
字體:             Noto Serif TC（正文襯線）；等寬 S1 用 generic monospace（Maple Mono CN 內嵌列 S3，seal 補釘 F6）
套件名/bin:       @kamishibai/sdk / kamishibai
```

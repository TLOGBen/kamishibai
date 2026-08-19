# kamishibai（紙芝居）

**Agent Presentation SDK** — Agent 著作結構化內容，SDK 確定性地渲染成可單獨生存的離線單檔產物。

> *An agent authors structured content; the SDK deterministically renders it into a self-contained offline artifact.*

---

## 這是什麼

讓 LLM agent 直接手寫 HTML 是昂貴且不可驗收的：它得為每一份文件重新產出一套 CSS、手算 SVG 座標，
而產物沒有任何機器可檢查的品質閘。

kamishibai 把這件事切開：

```
agent 寫 Markdown 超集  →  SDK 解析成 block tree IR  →  確定性渲染成離線單檔 HTML
                                                    ↘  lint 驗收（exit 0 才算數）
```

**Agent 負責內容，SDK 負責版面、遞送與持久化。** 渲染過程沒有模型參與，所以它是確定性的、
可重播的、可驗收的。

### 實測差異

同一份繁中技術文件（12 KB）、同一交付目標，兩個同型號 agent 分別走兩條路：

| | 走 kamishibai | 手寫 HTML |
|---|---|---|
| **agent 產出的 token** | **8,557** | **21,465**（2.51×） |
| 耗時 | 184 s | 371 s（2.02×） |
| 品質閘 | `lint` exit 0，首發即過 | 無 |

手寫路徑的 token 有 **40%** 花在 CSS 設計系統與手算 SVG 座標上——**而那是每份新文件都要重付的**。

量測方法與完整數字：[`.claude/research/2026-08-19-perf-token-benchmark.md`](.claude/research/2026-08-19-perf-token-benchmark.md)

---

## 快速開始

需要 Node.js（ESM）。

```bash
git clone https://github.com/TLOGBen/kamishibai
cd kamishibai
npm install

node ./src/cli/index.js setup --json                              # 建中央儲存庫、確認渲染用瀏覽器
node ./src/cli/index.js example doc > demo.md                     # 要一份合法範例
node ./src/cli/index.js render demo.md -o demo.html --json        # 渲染
node ./src/cli/index.js lint demo.html --json                     # 驗收（exit 0 才算數）
node ./src/cli/index.js snapshot demo.html -o demo.png --json     # 自己看一眼
```

你會得到 `demo.html`（離線單檔、內嵌 IR）、正典副本 `~/.kamishibai/artifacts/<專案>/demo.html`，
以及一張 PNG。

> 用 nvm 管 node 的話，非互動 shell 讀不到 PATH——每一行包 `zsh -lic '...'`。

---

## 產物長什麼樣

- **單檔、離線、零外部請求** — 字體以 unicode-range 子集化後 base64 內嵌；`lint` 會擋下任何外部引用
- **內嵌 IR** — 產物裡帶著自己的 block tree（`<script type="application/kamishibai+json">`），
  所以 `replay` 可以只憑產物換模板、升版、換皮
- **確定性** — 同一份 IR 永遠渲染出同樣的位元組；圖表版面是純整數運算，不量測文字、不用亂數

實測：`example doc`（1.7 KB 來源）→ 2.34 MB HTML，熱身後 **18 ms**；
31 KB 來源 → 3.22 MB HTML，**34 ms**。產物大小主要是內嵌字體的常數項（94–97%）。

---

## 著作格式

帶 frontmatter 的 Markdown 超集：

````markdown
---
title: 範例文件
kicker: KAMISHIBAI EXAMPLE
template: kami/long-form
---

# 第一章

這是 **prose** 區塊，支援行內 Markdown。

:::note
這是 callout。另有 `:::warn`。
:::

```diagram
{
  "kind": "graph",
  "nodes": [{ "id": "ir", "label": "block tree" }, { "id": "out", "label": "離線產物" }],
  "edges": [{ "from": "ir", "to": "out", "label": "render" }]
}
```
````

`diagram` fence 裡是**結構化 spec，不是座標**——版面由 SDK 算，agent 不必手畫。

也可以直接餵 block tree JSON。`kamishibai schema` 會吐出 IR 的 JSON Schema（draft 2020-12），
`kamishibai example <kind>` 會吐出任一 block 的合法範例。

**核心 block 型別**（11 種）：`section` `prose` `quote` `callout` `code` `table` `raw` `list`
`deck` `slide` `diagram`

---

## CLI

| 指令 | 用途 |
|---|---|
| `render <input>` | Markdown 超集／block JSON → 離線單檔 HTML |
| `lint <artifact>` | 驗收：零外部請求、內嵌 IR 齊備且通過 schema |
| `replay <artifact>` | 由產物內嵌 IR 重繪（換模板／升版／換皮） |
| `serve <input>` | 本地預覽，來源檔一變就重繪推播 reload |
| `close` | 終止本 SDK 起的預覽伺服器 |
| `export <artifact>` | document → PDF、deck → PPTX |
| `snapshot <artifact>` | 截成 PNG，讓 agent（與人）看得到視覺效果 |
| `comments <args...>` | 讀寫產物留言，以 block id 錨定 |
| `open <name>` / `list` | 由中央產物庫解析並開啟／列出呈現史 |
| `templates` | 列出中央儲存庫已註冊的模板包 |
| `example [kind]` / `schema` | 輸出合法範例／IR JSON Schema |
| `setup` / `debug` | 初始化環境／診斷 |

所有指令支援 `--json`，供 agent 直接解析。

---

## 出廠模板

| key | root | 用途 |
|---|---|---|
| `kami/long-form` | document | 長文件、報告 |
| `kami/slides` | deck | 簡報（鍵盤翻頁、fullscreen、無 JS 時降級為捲動長文） |

模板決定 `---` 是不是分頁、決定產物長相；同一份 IR 換模板即換皮。

---

## 中央儲存庫

`~/.kamishibai/` 是真實落點——每次 `render` 都會存一份正典副本，
所以「上次那份簡報」永遠找得回來、重繪得出來。

```
~/.kamishibai/
├── artifacts/<專案>/<slug>.html     # 正典產物（與遞送副本位元組相同）
└── templates/<namespace>/<name>/    # 模板包命名空間
```

---

## 專案狀態

**v0.1.0 — 可用，但仍在成形中。** 已封緘的切片：渲染／IR／lint、持久化／replay、
圖表／export／snapshot、serve／comment loop、模板命名空間。

已知未完成（見報告 §5–§6）：

- 中央儲存庫的模板命名空間目前**只是登記簿，還不是載入點**——第三方模板列得出來、還載不進去
- **slot／plugin 擴充層尚未實作**（`SPEC.md` §11–§12 已定義機制）
- diagram v1 只有一種 kind（`graph`），節點語意色／群組框／虛線邊等待 plugin 層
- 沒有版面座標系；自訂版面目前只能走 `raw-html` 逃生艙

---

## 文件

| 檔案 | 給誰看 |
|---|---|
| [`SPEC.md`](SPEC.md) | 實作用規格書 |
| [`AGENTS.md`](AGENTS.md) | 在本 repo 內開發 SDK 的 agent |
| [`.claude/wayfinder/kamishibai-sdk/`](.claude/wayfinder/kamishibai-sdk/) | 決策地圖與 12 張票面（**規格真源**） |
| [`.claude/research/`](.claude/research/) | 查證與量測報告 |

規格衝突時，以票面的 `## Answer` 為準。

---

## License

**尚未授權（`UNLICENSED`）——保留所有權利。**

本專案仍在成形中，v1.0 之前不附授權條款：你可以閱讀原始碼，但未獲授權使用、修改或再散布。

`issues/09-public-packaging.md` 已定案**最終採 MIT**，但要等實作收斂、第三方資產的授權盤點完成（見 `.claude/research/tsanger-jinkai02-license.md`）之後才生效。
屆時會補上 `LICENSE` 與 `THIRD_PARTY_LICENSES`——出廠字體 Noto Serif TC 走 SIL OFL 1.1，須保留自身授權全文，**不得併入 MIT 宣告**。

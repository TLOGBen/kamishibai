import { BLOCK_TYPES } from './blocks.js'

/**
 * The canonical Markdown-superset example. It must always be valid input to
 * `render` — that round-trip is the SDK's anti-trial-and-error guarantee
 * (SPEC §4「CLI 必須提供 example／schema，讓 Agent 免反覆試錯」).
 */
export const EXAMPLE_DOC = `---
title: 範例文件
kicker: KAMISHIBAI EXAMPLE
author: kamishibai
template: kami/long-form
---

# 第一章　散文與引言

這是 **prose** 區塊，支援行內 Markdown：粗體、\`行內程式碼\`、以及[連結](https://example.com/)。

> 這是 quote 區塊：引用一段話。

## 第一節　程式碼、表格與提示框

\`\`\`js
export const hello = (name) => \`你好，\${name}\`
\`\`\`

| block | 用途 |
|-------|------|
| prose | 散文段落 |
| table | 表格資料 |

清單是真正的 \`list\` block——項目內容是子 block，所以清單裡放 callout 不會拆掉外框：

- 項目一
- 項目二
  :::note
  項目內的 callout 仍走同一個 Callout 元件。
  :::
- 項目三

1. 有序項目一
2. 有序項目二

:::note
這是 callout（note 型）。另有 warn 型。
:::

:::warn
警示型 callout 長這樣。
:::

# 第二章　結構化圖表

下面這個 diagram fence 的內容是 **JSON**，欄位就是 IR 的 diagram block；版面由 SDK
算出，不必手畫座標。v1 只有一種 kind：有向的節點邊圖。

\`\`\`diagram
{
  "kind": "graph",
  "nodes": [
    { "id": "input", "label": "來源語料" },
    { "id": "ir", "label": "block tree" },
    { "id": "artifact", "label": "離線產物" }
  ],
  "edges": [
    { "from": "input", "to": "ir", "label": "parse" },
    { "from": "ir", "to": "artifact", "label": "render" },
    { "from": "artifact", "to": "ir", "label": "replay" }
  ]
}
\`\`\`

# 第三章　raw 島嶼

島嶼是逃生艙：模板敘述不出來的東西才手寫，並以 intent 記錄原因。

\`\`\`raw-html intent="示範 raw 島嶼的宣告方式"
<div class="example-island">手寫 HTML 島嶼</div>
\`\`\`
`

/**
 * The canonical deck source. `---` is a page break *only* under the slides
 * template, so the frontmatter is load-bearing — copying the body under
 * `kami/long-form` gives a document with the breaks silently dropped.
 */
export const EXAMPLE_DECK = `---
title: 範例簡報
kicker: KAMISHIBAI EXAMPLE
author: kamishibai
template: kami/slides
---

# 第一張　開場

首張自動帶出 frontmatter 的 title 與 kicker。

---

# 第二張　構件

- 清單、callout、程式碼、表格都與長文模板同源
- \`---\` 前後各留一個空行，否則 Markdown 會把它讀成 setext 標題

:::note
產物內建播放：方向鍵／空白鍵翻頁，f 全螢幕，Esc 離開。
:::

---

# 第三張　收束

\`\`\`js
export const slides = (deck) => deck.slides.length
\`\`\`
`

const BLOCK_EXAMPLES = Object.freeze({
  section: { id: 'b2', type: 'section', title: '章節標題', level: 1, children: [] },
  prose: { id: 'b3', type: 'prose', html: '散文段落，行內 Markdown 已編譯為 HTML。' },
  quote: {
    id: 'b4',
    type: 'quote',
    children: [{ id: 'b5', type: 'prose', html: '被引用的一段話。' }],
  },
  callout: {
    id: 'b6',
    type: 'callout',
    variant: 'note',
    children: [{ id: 'b7', type: 'prose', html: '提示內容。' }],
  },
  code: { id: 'b8', type: 'code', lang: 'js', text: 'export const x = 1' },
  table: { id: 'b9', type: 'table', head: ['欄位', '意義'], rows: [['id', 'block 識別碼']] },
  raw: {
    id: 'b10',
    type: 'raw',
    subtype: 'html',
    intent: '為何需要手寫這塊',
    html: '<div class="island">手寫內容</div>',
  },
  list: {
    id: 'b11',
    type: 'list',
    ordered: false,
    items: [
      [{ id: 'b12', type: 'prose', html: '項目一：每個項目是一組 block。' }],
      [
        { id: 'b13', type: 'prose', html: '項目二：所以項目內可以放別的 block。' },
        {
          id: 'b14',
          type: 'callout',
          variant: 'note',
          children: [{ id: 'b15', type: 'prose', html: '像這個 callout。' }],
        },
      ],
    ],
  },
  slide: {
    id: 'b16',
    type: 'slide',
    children: [{ id: 'b17', type: 'prose', html: '單張投影片的內容。' }],
  },
  diagram: {
    id: 'b18',
    type: 'diagram',
    kind: 'graph',
    nodes: [
      { id: 'input', label: '來源語料' },
      { id: 'ir', label: 'block tree' },
      { id: 'artifact', label: '離線產物' },
    ],
    edges: [
      { from: 'input', to: 'ir', label: 'parse' },
      { from: 'ir', to: 'artifact', label: 'render' },
      { from: 'artifact', to: 'ir', label: 'replay' },
    ],
  },
})

/**
 * Kinds whose example is a whole Markdown-superset source rather than one
 * block: they are the ones that can be piped straight back into `render -`.
 */
const DOC_EXAMPLES = Object.freeze({ doc: EXAMPLE_DOC, deck: EXAMPLE_DECK })

export const EXAMPLE_KINDS = Object.freeze(['doc', ...BLOCK_TYPES])

/**
 * @param {string} kind `doc`/`deck` for the Markdown superset, or a block type name
 * @returns {{kind: string, example: string}|null} null when the kind is unknown
 */
export function exampleFor(kind) {
  const source = DOC_EXAMPLES[kind]
  if (source !== undefined) return { kind, example: source }
  const block = BLOCK_EXAMPLES[kind]
  if (block === undefined) return null
  return { kind, example: JSON.stringify(block, null, 2) }
}

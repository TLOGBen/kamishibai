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

清單也是合法構件——含 block-level 內容的 prose 會以 \`<div class="prose">\` 承載：

- 項目一
- 項目二
- 項目三

1. 有序項目一
2. 有序項目二

:::note
這是 callout（note 型）。另有 warn 型。
:::

:::warn
警示型 callout 長這樣。
:::

# 第二章　raw 島嶼

島嶼是逃生艙：模板敘述不出來的東西才手寫，並以 intent 記錄原因。

\`\`\`raw-html intent="示範 raw 島嶼的宣告方式"
<div class="example-island">手寫 HTML 島嶼</div>
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
})

export const EXAMPLE_KINDS = Object.freeze(['doc', ...BLOCK_TYPES])

/**
 * @param {string} kind `doc` for the Markdown superset, or a block type name
 * @returns {{kind: string, example: string}|null} null when the kind is unknown
 */
export function exampleFor(kind) {
  if (kind === 'doc') return { kind, example: EXAMPLE_DOC }
  const block = BLOCK_EXAMPLES[kind]
  if (block === undefined) return null
  return { kind, example: JSON.stringify(block, null, 2) }
}

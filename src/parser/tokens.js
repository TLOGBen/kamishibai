import * as B from '../core/blocks.js'

const DEFAULT_INTENT = 'unspecified'

const findClose = (tokens, openIndex) => {
  const openType = tokens[openIndex].type
  const closeType = openType.replace(/_open$/, '_close')
  let depth = 0
  for (let i = openIndex; i < tokens.length; i += 1) {
    if (tokens[i].type === openType) depth += 1
    else if (tokens[i].type === closeType) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return tokens.length - 1
}

const rawSubtype = (info) => (info.startsWith('raw-svg') ? 'svg' : 'html')

const intentOf = (info, content) => {
  const fromInfo = /intent=(?:"([^"]*)"|'([^']*)')/.exec(info)
  if (fromInfo) return fromInfo[1] ?? fromInfo[2]
  const fromAttr = /data-intent=(?:"([^"]*)"|'([^']*)')/.exec(content)
  if (fromAttr) return fromAttr[1] ?? fromAttr[2]
  return DEFAULT_INTENT
}

const parseFence = (token) => {
  const info = (token.info ?? '').trim()
  if (/^raw(-html|-svg)?\b/.test(info)) {
    return B.raw({
      subtype: rawSubtype(info),
      intent: intentOf(info, token.content),
      html: token.content.replace(/\n+$/, ''),
    })
  }
  return B.code({ lang: info.split(/\s+/)[0] ?? '', text: token.content.replace(/\n+$/, '') })
}

const parseTable = (tokens, openIndex, inline) => {
  const end = findClose(tokens, openIndex)
  const head = []
  const rows = []
  let currentRow = null
  let inHead = false
  for (let i = openIndex + 1; i < end; i += 1) {
    const t = tokens[i]
    if (t.type === 'thead_open') inHead = true
    else if (t.type === 'thead_close') inHead = false
    else if (t.type === 'tr_open') currentRow = []
    else if (t.type === 'tr_close') {
      if (currentRow !== null && !inHead) rows.push(currentRow)
      currentRow = null
    } else if (t.type === 'th_open' || t.type === 'td_open') {
      const cell = inline(tokens[i + 1])
      if (inHead) head.push(cell)
      else if (currentRow !== null) currentRow.push(cell)
    }
  }
  return { block: B.table({ head, rows }), next: end + 1 }
}

/**
 * Compile one `<ul>`/`<ol>` token run into a real `list` block.
 *
 * S1 flattened lists into a prose HTML string, which meant a callout inside a
 * list item had to be rendered by markdown-it — a second rendering path that
 * disagreed with the Callout component — unless the list frame was thrown away
 * entirely. Both halves of that trade-off are gone once list items carry real
 * blocks: the `<ul>` frame survives *and* every child stays in the block tree.
 */
const parseList = (tokens, openIndex, closeIndex, ctx, ordered) => {
  const items = []
  let i = openIndex + 1
  while (i < closeIndex) {
    if (tokens[i].type !== 'list_item_open') {
      i += 1
      continue
    }
    const itemClose = findClose(tokens, i)
    items.push(walkTokens(tokens.slice(i + 1, itemClose), ctx))
    i = itemClose + 1
  }
  return B.list({ ordered, items })
}

/**
 * Walk a markdown-it token stream into flat block items. Headings become
 * `{kind:'heading'}` markers and thematic breaks `{kind:'hr'}` markers;
 * `nestSections` turns the former into section blocks and drops the latter,
 * while deck compilation (parser/index.js) cuts slides on the latter.
 */
export function walkTokens(tokens, ctx) {
  const { inline } = ctx
  const out = []
  let i = 0

  while (i < tokens.length) {
    const t = tokens[i]
    switch (t.type) {
      case 'heading_open': {
        out.push({
          kind: 'heading',
          level: Number(t.tag.slice(1)),
          title: tokens[i + 1].content,
        })
        i = findClose(tokens, i) + 1
        break
      }
      case 'paragraph_open': {
        const close = findClose(tokens, i)
        out.push(B.prose(inline(tokens[i + 1])))
        i = close + 1
        break
      }
      case 'fence': {
        out.push(parseFence(t))
        i += 1
        break
      }
      case 'blockquote_open': {
        const close = findClose(tokens, i)
        out.push(B.quote(walkTokens(tokens.slice(i + 1, close), ctx)))
        i = close + 1
        break
      }
      case 'kami_container_open': {
        const close = findClose(tokens, i)
        out.push(
          B.callout({
            variant: t.info,
            children: walkTokens(tokens.slice(i + 1, close), ctx),
          }),
        )
        i = close + 1
        break
      }
      case 'table_open': {
        const { block, next } = parseTable(tokens, i, inline)
        out.push(block)
        i = next
        break
      }
      case 'bullet_list_open':
      case 'ordered_list_open': {
        const close = findClose(tokens, i)
        out.push(parseList(tokens, i, close, ctx, t.type === 'ordered_list_open'))
        i = close + 1
        break
      }
      case 'hr': {
        out.push({ kind: 'hr' })
        i += 1
        break
      }
      case 'html_block': {
        out.push(
          B.raw({
            subtype: 'html',
            intent: intentOf('', t.content),
            html: t.content.replace(/\n+$/, ''),
          }),
        )
        i += 1
        break
      }
      default:
        i += 1
    }
  }
  return out
}

/** Recurse into whichever nesting shape a container block uses. */
const nestChildren = (item) => {
  if (Array.isArray(item.items)) return { ...item, items: item.items.map(nestSections) }
  if (Array.isArray(item.children)) return { ...item, children: nestSections(item.children) }
  return item
}

/**
 * Turn flat heading markers into a nested section tree (recursively).
 *
 * `hr` markers are dropped here: in document mode a thematic break carries no
 * block meaning (a pre-existing, inventoried behaviour). Deck mode consumes
 * them *before* calling this, which is the one place they mean anything.
 */
export function nestSections(items) {
  const root = { children: [] }
  const stack = [{ level: 0, node: root }]

  for (const item of items) {
    if (item.kind === 'hr') continue
    if (item.kind === 'heading') {
      while (stack.length > 1 && stack[stack.length - 1].level >= item.level) stack.pop()
      const node = { type: 'section', title: item.title, level: item.level, children: [] }
      stack[stack.length - 1].node.children.push(node)
      stack.push({ level: item.level, node })
      continue
    }
    stack[stack.length - 1].node.children.push(nestChildren(item))
  }
  return root.children
}

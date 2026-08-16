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
 * Walk a markdown-it token stream into flat block items. Headings become
 * `{kind:'heading'}` markers; `nestSections` turns them into section blocks.
 */
export function walkTokens(tokens, ctx) {
  const { inline, renderSlice } = ctx
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
        const slice = tokens.slice(i, close + 1)
        // S1 沒有 list block 型別，所以清單平常整塊編譯成 prose 的 HTML。
        // 但清單裡若有 callout，那條路會把它壓成 prose 內的原始 HTML——
        // IR 就此有損，且 callout 會改由 markdown-it 的 renderer 產出，
        // 形成第二條與 Callout 元件不同源的渲染路徑。寧可拆掉清單外框，
        // 也要讓 callout 以真正的 block 進 block tree。
        if (slice.some((token) => token.type === 'kami_container_open')) {
          out.push(...walkTokens(tokens.slice(i + 1, close), ctx))
        } else {
          out.push(B.prose(renderSlice(slice)))
        }
        i = close + 1
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

/** Turn flat heading markers into a nested section tree (recursively). */
export function nestSections(items) {
  const root = { children: [] }
  const stack = [{ level: 0, node: root }]

  for (const item of items) {
    if (item.kind === 'heading') {
      while (stack.length > 1 && stack[stack.length - 1].level >= item.level) stack.pop()
      const node = { type: 'section', title: item.title, level: item.level, children: [] }
      stack[stack.length - 1].node.children.push(node)
      stack.push({ level: item.level, node })
      continue
    }
    const nested = Array.isArray(item.children)
      ? { ...item, children: nestSections(item.children) }
      : item
    stack[stack.length - 1].node.children.push(nested)
  }
  return root.children
}

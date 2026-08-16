import { CALLOUT_VARIANTS } from '../core/blocks.js'

const COLON = 0x3a

/**
 * markdown-it block rule for the Markdown-superset callout fence:
 *
 *   :::note
 *   body
 *   :::
 *
 * Emits `kami_container_open` / `kami_container_close` tokens carrying the
 * variant in `info`. Modelled on markdown-it-container.
 */
export function containerPlugin(md) {
  const rule = (state, startLine, endLine, silent) => {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false

    let start = state.bMarks[startLine] + state.tShift[startLine]
    let max = state.eMarks[startLine]
    if (start + 3 > max) return false
    if (state.src.charCodeAt(start) !== COLON) return false

    let pos = state.skipChars(start, COLON)
    const markerLen = pos - start
    if (markerLen < 3) return false

    const params = state.src.slice(pos, max).trim()
    const variant = params.split(/\s+/)[0]
    if (!CALLOUT_VARIANTS.includes(variant)) return false
    if (silent) return true

    let nextLine = startLine
    let autoClosed = false
    for (;;) {
      nextLine += 1
      if (nextLine >= endLine) break
      start = state.bMarks[nextLine] + state.tShift[nextLine]
      max = state.eMarks[nextLine]
      if (start < max && state.sCount[nextLine] < state.blkIndent) break
      if (state.src.charCodeAt(start) !== COLON) continue
      if (state.sCount[nextLine] - state.blkIndent >= 4) continue
      pos = state.skipChars(start, COLON)
      if (pos - start < markerLen) continue
      pos = state.skipSpaces(pos)
      if (pos < max) continue
      autoClosed = true
      break
    }

    const oldParent = state.parentType
    const oldLineMax = state.lineMax
    state.parentType = 'kami_container'
    state.lineMax = nextLine

    const open = state.push('kami_container_open', 'div', 1)
    open.markup = ':'.repeat(markerLen)
    open.block = true
    open.info = variant
    open.map = [startLine, nextLine]

    state.md.block.tokenize(state, startLine + 1, nextLine)

    const close = state.push('kami_container_close', 'div', -1)
    close.markup = ':'.repeat(markerLen)
    close.block = true

    state.parentType = oldParent
    state.lineMax = oldLineMax
    state.line = nextLine + (autoClosed ? 1 : 0)
    return true
  }

  md.block.ruler.before('fence', 'kami_container', rule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })

  md.renderer.rules.kami_container_open = (tokens, idx) =>
    `<div class="callout callout-${tokens[idx].info}">`
  md.renderer.rules.kami_container_close = () => '</div>'
}

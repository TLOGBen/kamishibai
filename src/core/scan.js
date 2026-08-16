import { IR_SCRIPT_TYPE } from './ir.js'

/**
 * Structural slicing of an artifact, so the offline rules judge *live markup*
 * rather than content that merely talks about it (CONTRACT A3「內容文字…不在此限」).
 *
 * Two observations make this cheap and precise:
 *
 * 1. Tag forms (`<link href`, `<script src`, `<img src="http`) need a literal
 *    `<`. Rendered content text is entity-escaped (`&lt;script`), so it can
 *    never match — no scrubbing required, and a *raw island*, which is injected
 *    unescaped and really does fire, still matches exactly as it should.
 * 2. CSS forms (`@import`, `url(http`) carry no `<`, so escaping does not
 *    neutralise them. They are only meaningful inside a CSS context, so they
 *    are scanned only there.
 *
 * The embedded IR is inert data, never executed, so it is excluded from both.
 */

const IR_SCRIPT_RE = new RegExp(
  `<script[^>]*type\\s*=\\s*["']${IR_SCRIPT_TYPE.replace('+', '\\+')}["'][^>]*>[\\s\\S]*?<\\/script>`,
  'gi',
)

const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const STYLE_ATTR_RE = /\sstyle\s*=\s*"([^"]*)"|\sstyle\s*=\s*'([^']*)'/gi

/** Markup that the browser will actually act on: everything but the IR payload. */
export function liveMarkup(html) {
  return String(html ?? '').replace(IR_SCRIPT_RE, '')
}

/** Every CSS context in the artifact: <style> blocks plus inline style attributes. */
export function styleRegions(html) {
  const live = liveMarkup(html)
  const regions = []
  for (const m of live.matchAll(STYLE_BLOCK_RE)) regions.push(m[1])
  for (const m of live.matchAll(STYLE_ATTR_RE)) regions.push(m[1] ?? m[2] ?? '')
  return regions.join('\n')
}

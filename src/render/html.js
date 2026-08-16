import { IR_SCRIPT_TYPE } from '../core/ir.js'

export { IR_SCRIPT_TYPE }

const ESCAPES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ESCAPES[c])

/**
 * Serialise the IR for embedding inside a <script> element.
 *
 * Both `</` (ends the element early) and `<!--` (opens an HTML comment state)
 * are hazards, and every one of them starts with `<`. Escaping `<` itself as
 * `<` neutralises the whole class at once — and unlike `\/` or `\!`, it is
 * a legal JSON escape in *any* position, so the payload always parses back.
 * `\!` is not a valid escape at all and silently corrupted the IR (CONTRACT A2).
 */
export const serializeIr = (ir) => JSON.stringify(ir).replace(/</g, '\\u003c')

/** Assemble the single-file artifact. Nothing here depends on file paths (A8). */
export function assembleDocument({ language, title, styles, fontCss, body, ir }) {
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(language)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="generator" content="${escapeHtml(`kamishibai ${ir.engine}`)}">`,
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    fontCss,
    styles,
    '</style>',
    '</head>',
    '<body>',
    body,
    `<script type="${IR_SCRIPT_TYPE}">${serializeIr(ir)}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

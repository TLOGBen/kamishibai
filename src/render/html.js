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

/**
 * Assemble the single-file artifact. Nothing here depends on file paths (A8).
 *
 * `script` is the template's own inlined behaviour (playback chrome, SPEC §7.4).
 * It is emitted without a `src`, so the零外部請求 rules see nothing to flag, and
 * it sits outside the IR payload so `liveMarkup` still judges it as live markup.
 * Templates without behaviour emit no element at all, which is what keeps their
 * artifacts byte-identical to the pre-S3a bytes.
 */
export function assembleDocument({ language, title, styles, fontCss, body, script, ir }) {
  const behaviour = typeof script === 'string' && script.length > 0 ? [`<script>${script}</script>`] : []
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
    ...behaviour,
    `<script type="${IR_SCRIPT_TYPE}">${serializeIr(ir)}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

import { CODES, ROOT_PATH } from './errors.js'
import { validateIr } from './validate.js'
import { liveMarkup, styleRegions } from './scan.js'

/**
 * CONTRACT 外部資源禁形 — every artifact must be able to live offline.
 * `scope` picks the region each rule is judged against (see ./scan.js).
 *
 * Exported as the single source of truth: the A3 test asserts against these
 * very rules rather than transcribing its own copy, so the禁形 list can never
 * drift between the linter and the criterion that motivates it.
 */
export const EXTERNAL_RULES = Object.freeze([
  { re: /<link\b[^>]*\bhref\s*=/i, code: CODES.EXTERNAL_STYLESHEET, what: '<link …href=', scope: 'markup' },
  { re: /<script\b[^>]*\bsrc\s*=/i, code: CODES.EXTERNAL_SCRIPT, what: '<script …src=', scope: 'markup' },
  { re: /<img\b[^>]*\bsrc\s*=\s*["']?http/i, code: CODES.EXTERNAL_IMAGE, what: '<img …src="http', scope: 'markup' },
  { re: /@import/i, code: CODES.EXTERNAL_CSS_IMPORT, what: '@import', scope: 'css' },
  { re: /url\(\s*["']?http/i, code: CODES.EXTERNAL_CSS_URL, what: 'url(http', scope: 'css' },
])

/**
 * CONTRACT 禁用字串 — strings whose mere presence means the artifact is
 * *shipping* something it has no licence to ship.
 *
 * `scope` follows the same rule as EXTERNAL_RULES, and for the same reason
 * (CONTRACT A3「內容文字…不在此限」): a font is redistributed by being
 * *declared or embedded in CSS*, never by being named in body text. Scanning
 * the raw document instead would fail any document that writes about the ban —
 * the project's own SPEC.md, which records the TsangerJinKai02 licence NO-GO,
 * is exactly such a document.
 */
const BANNED_STRINGS = Object.freeze([
  { needle: 'TsangerJinKai', code: CODES.BANNED_FONT, why: '未取得再散布授權的字體', scope: 'css' },
])

const finding = (code, message, path = ROOT_PATH) => ({ path, code, message })

/** The regions every scoped rule is judged against (see ./scan.js). */
const scanRegions = (html) => ({ markup: liveMarkup(html), css: styleRegions(html) })

const lintExternalResources = (regions) =>
  EXTERNAL_RULES.filter(({ re, scope }) => re.test(regions[scope])).map(({ code, what }) =>
    finding(code, `產物含外部資源引用形 \`${what}\`，違反零外部請求`),
  )

const lintBannedStrings = (regions) =>
  BANNED_STRINGS.filter(({ needle, scope }) => regions[scope].includes(needle)).map(
    ({ code, needle, why }) => finding(code, `產物含禁用字串 \`${needle}\`（${why}）`),
  )

const lintEmbeddedIr = (payloads) => {
  if (payloads.length === 0) {
    return [finding(CODES.IR_MISSING, '產物缺少內嵌 IR（<script type="application/kamishibai+json">）')]
  }
  if (payloads.length > 1) {
    return [finding(CODES.IR_DUPLICATE, `產物含 ${payloads.length} 份內嵌 IR，應恰為一份`)]
  }
  let ir
  try {
    ir = JSON.parse(payloads[0])
  } catch (cause) {
    return [finding(CODES.IR_UNPARSABLE, `內嵌 IR 不是合法 JSON：${cause.message}`)]
  }
  return validateIr(ir).errors
}

/**
 * Lint a rendered artifact: offline rules + embedded-IR schema conformance.
 * The caller supplies the already-extracted IR payloads so that this module
 * stays in the dependency-free core layer.
 *
 * @param {{html: string, irPayloads: string[]}} input
 * @returns {Array<{path: string, code: string, message: string}>} findings, empty when clean
 */
export function lintArtifact({ html, irPayloads }) {
  const regions = scanRegions(html)
  return [
    ...lintExternalResources(regions),
    ...lintBannedStrings(regions),
    ...lintEmbeddedIr(irPayloads),
  ]
}

import { pathToFileURL } from 'node:url'
import { CODES, EXIT, KsbError } from '../core/errors.js'

/**
 * The one place the SDK talks to a real browser.
 *
 * Export and snapshot cannot be faked: a PDF, a PPTX slide image and a PNG all
 * require something that actually lays out CSS. So the browser is a hard
 * dependency — and the *honest* way to carry a hard dependency is to name it
 * when it is missing, with the exact command that fixes it (CONTRACT D4).
 * Anything softer (a blank PDF, a stub PNG, a silent exit 0) would hand back a
 * file that looks like a deliverable and is not one.
 */

/** Verbatim CONTRACT constant — the exact setup command, quoted in the error. */
export const BROWSER_SETUP_COMMAND = 'npx playwright install chromium'
/** Verbatim CONTRACT constant — disposable cache, never a protected asset. */
export const BROWSER_CACHE_DIR = '~/.cache/ms-playwright'
/** WSL + nvm convention (SPEC §10.3): npm/npx must run through a login shell. */
export const BROWSER_SETUP_SHELL_HINT = `zsh -lic '${BROWSER_SETUP_COMMAND}'`

/** Playwright's own words when the binary is absent, in either channel. */
const MISSING_SIGNS = Object.freeze([
  /Executable doesn't exist/i,
  /Looks like Playwright was just installed/i,
  /ENOENT/,
])

export const browserMissingError = (detail) =>
  new KsbError({
    code: CODES.BROWSER_MISSING,
    message:
      `找不到可用的瀏覽器：${detail}。` +
      `export／snapshot 需要真的 Chromium 才能排版，請先執行 \`${BROWSER_SETUP_COMMAND}\`` +
      `（WSL ＋ nvm 請包成 ${BROWSER_SETUP_SHELL_HINT}）。` +
      `二進位檔落在 ${BROWSER_CACHE_DIR}，是可丟棄的快取，隨時可刪掉重抓。`,
    exitCode: EXIT.VALIDATION,
  })

const exportFailedError = (detail) =>
  new KsbError({
    code: CODES.EXPORT_FAILED,
    message: `瀏覽器操作失敗：${detail}`,
    exitCode: EXIT.VALIDATION,
  })

/** Absence and breakage are different diagnoses; never report one as the other. */
const asBrowserError = (cause) => {
  const detail = String(cause?.message ?? cause).split('\n')[0]
  return MISSING_SIGNS.some((re) => re.test(String(cause?.message ?? cause)))
    ? browserMissingError(detail)
    : exportFailedError(detail)
}

const loadChromium = async () => {
  try {
    const { chromium } = await import('playwright')
    return chromium
  } catch (cause) {
    throw browserMissingError(`playwright 套件無法載入（${cause.message}）`)
  }
}

/**
 * Viewport used for every export. A deck slide is 16:9 at 1120px measure
 * (kami/slides), so 1280×720 renders one slide near 1:1 without scaling.
 */
export const EXPORT_VIEWPORT = Object.freeze({ width: 1280, height: 720 })

/**
 * Open an artifact in a real browser and hand the page to `visit`.
 *
 * JavaScript is **off** on purpose. The deck template's playback script hides
 * every slide but the current one, so a JS-enabled page would export a deck of
 * blank pages. Without JS the artifact degrades to the scrolling document the
 * template already promises is fully readable — which is exactly the form a
 * PDF/PPTX should capture.
 */
export async function withArtifactPage(artifactPath, visit) {
  const chromium = await loadChromium()
  let browser
  try {
    browser = await chromium.launch()
  } catch (cause) {
    throw asBrowserError(cause)
  }
  try {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { ...EXPORT_VIEWPORT },
    })
    const page = await context.newPage()
    // Print media, chosen by the *template*, is the export form.
    //
    // kami/slides paints its playback chrome with `position: fixed`, so a
    // per-slide element screenshot came back with a dark band across the bottom
    // of every slide — chrome that belongs to the on-screen deck, not to the
    // slide. The stylesheet already says what the printed form is (`@media
    // print` hides the chrome and the shadows), so the exporter asks for that
    // form instead of hard-coding a template's class names here.
    await page.emulateMedia({ media: 'print' })
    await page.goto(pathToFileURL(artifactPath).href, { waitUntil: 'load' })
    return await visit(page)
  } catch (cause) {
    if (cause instanceof KsbError) throw cause
    throw asBrowserError(cause)
  } finally {
    await browser.close().catch(() => {})
  }
}

/**
 * Is a usable browser actually there? Answered by launching one, because that
 * is the only question that matters — a present-but-unlaunchable binary is
 * absent for every practical purpose.
 *
 * @returns {Promise<{available: boolean, reason: string, command: string}>}
 */
export async function probeBrowser() {
  try {
    const chromium = await loadChromium()
    const browser = await chromium.launch()
    await browser.close()
    return { available: true, reason: '', command: BROWSER_SETUP_COMMAND }
  } catch (cause) {
    const error = cause instanceof KsbError ? cause : asBrowserError(cause)
    return { available: false, reason: error.message, command: BROWSER_SETUP_COMMAND }
  }
}

/**
 * Fallback capture for the OLD system's reference exemplar.
 *
 * `kamishibai snapshot` refuses this file (KSB_IR_MISSING) — it is a
 * hand-authored HTML document with no embedded kamishibai IR, which is
 * precisely the "old world" property the comparison is about. So the same
 * capture parameters the SDK itself uses (src/export/browser.js) are
 * reproduced here verbatim: JS off, 1280x720 viewport, print media, fullPage.
 */
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'

const [, , input, out] = process.argv
const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 720 },
  })
  const page = await context.newPage()
  await page.emulateMedia({ media: 'print' })
  await page.goto(pathToFileURL(input).href, { waitUntil: 'load' })
  await page.screenshot({ type: 'png', fullPage: true, path: out })
  const buf = await page.screenshot({ type: 'png', fullPage: true })
  console.log(JSON.stringify({ ok: true, artifact: out, bytes: buf.length }))
} finally {
  await browser.close()
}

import { CODES, EXIT, KsbError } from '../core/errors.js'

/**
 * Verbatim CONTRACT constant — a deck slide *is* `<section class="slide">`.
 * The exporter counts the same containers the template emits, so "one slide per
 * section" is checked against the rendered DOM rather than assumed.
 */
export const SLIDE_SELECTOR = 'section.slide'

const exportFailed = (message) =>
  new KsbError({ code: CODES.EXPORT_FAILED, message, exitCode: EXIT.VALIDATION })

/**
 * Every slide container in a rendered deck, in document order.
 *
 * `expected` is the slide count the artifact's own embedded IR claims. The two
 * must agree: a DOM that drew fewer sections than the IR carries means the
 * export would silently lose pages, which is precisely the class of failure
 * that motivated the template vocabulary guard in S3a.
 */
export async function slideHandles(page, expected) {
  const handles = await page.locator(SLIDE_SELECTOR).all()
  if (handles.length === 0) {
    throw exportFailed(`產物內找不到任何 \`${SLIDE_SELECTOR}\`，無法逐張匯出`)
  }
  if (Number.isInteger(expected) && handles.length !== expected) {
    throw exportFailed(
      `產物的 ${SLIDE_SELECTOR} 數（${handles.length}）與內嵌 IR 的張數（${expected}）不符；` +
        '匯出會漏頁，故不產出檔案',
    )
  }
  return handles
}

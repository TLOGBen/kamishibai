import { CODES, EXIT, KsbError } from '../core/errors.js'

/**
 * Document artifact → PDF, printed by the browser that already knows how to lay
 * the artifact out. Nothing is re-implemented here: the template's own
 * `@media print` rules are what shape the page.
 */

/** Verbatim PDF file signature. */
export const PDF_MAGIC = '%PDF-'

const PAGE_FORMAT = 'A4'
const MARGIN = Object.freeze({ top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' })

export async function renderPdf(page) {
  const buffer = await page.pdf({ format: PAGE_FORMAT, printBackground: true, margin: MARGIN })
  if (buffer.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC) {
    throw new KsbError({
      code: CODES.EXPORT_FAILED,
      message: `瀏覽器回傳的不是 PDF（開頭應為 ${PDF_MAGIC}）`,
      exitCode: EXIT.VALIDATION,
    })
  }
  return buffer
}

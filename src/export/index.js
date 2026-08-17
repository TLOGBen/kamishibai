import { basename, extname, join } from 'node:path'
import { findDeck } from '../core/blocks.js'
import { CODES, EXIT, KsbError, usageError } from '../core/errors.js'
import { readArtifact } from '../delivery/read.js'
import { writeBytes } from '../delivery/write.js'
import { readEmbeddedIr } from '../parser/artifact.js'
import { withArtifactPage } from './browser.js'
import { renderPdf } from './pdf.js'
import { renderPptx } from './pptx.js'
import { readPngSize } from './png.js'
import { renderSnapshot } from './snapshot.js'

export { BROWSER_SETUP_COMMAND, BROWSER_CACHE_DIR, probeBrowser } from './browser.js'
export { DEFAULT_SLIDE } from './snapshot.js'

/** Verbatim CONTRACT constants — the two附屬格式 and the root each one needs. */
export const EXPORT_FORMATS = Object.freeze(['pdf', 'pptx'])
export const FORMAT_ROOT = Object.freeze({ pdf: 'document', pptx: 'deck' })
export const SNAPSHOT_EXT = 'png'

/** Where a deliverable lands when the caller gave no `-o` (mirrors `render`). */
const defaultOut = (artifactPath, ext) =>
  join('out', `${basename(artifactPath, extname(artifactPath))}.${ext}`)

/**
 * What an artifact *is*, read from its own embedded IR rather than its markup.
 *
 * The root form decides which export formats are even meaningful, so it must
 * come from the record the artifact carries — grepping for slide markup would
 * make a document that merely *mentions* a slide class exportable as a deck.
 *
 * @returns {{path: string, html: string, root: 'document'|'deck', slides: number|undefined}}
 */
export function artifactShape(target) {
  const { html, path } = readArtifact(target)
  const ir = readEmbeddedIr(html, path)
  const deck = findDeck(ir.doc)
  return {
    path,
    html,
    root: deck === undefined ? 'document' : 'deck',
    slides: deck === undefined ? undefined : deck.slides.length,
  }
}

const formatMismatch = (format, root, path) =>
  new KsbError({
    code: CODES.EXPORT_FORMAT_MISMATCH,
    message:
      `--to ${format} 只適用於 ${FORMAT_ROOT[format]} 根形的產物，但 ${path} 是 ${root} 產物。` +
      `文體轉換不是匯出：deck 請用 --to pptx，document 請用 --to pdf。`,
    exitCode: EXIT.VALIDATION,
  })

/**
 * `export <artifact> --to pdf|pptx` (CONTRACT D3).
 *
 * The pairing is checked *before* the browser is launched: a wrong `--to` is an
 * authoring mistake, and answering it with a 5-second browser start-up followed
 * by the same rejection would only teach callers that export is slow.
 *
 * @returns {Promise<{result: {ok: true, artifact: string, format: string}, exitCode: number}>}
 */
export async function exportArtifact({ target, format, out }) {
  if (!EXPORT_FORMATS.includes(format)) {
    throw usageError(`--to 必須是 ${EXPORT_FORMATS.join(' 或 ')}，收到 ${JSON.stringify(format)}`)
  }
  const shape = artifactShape(target)
  if (shape.root !== FORMAT_ROOT[format]) throw formatMismatch(format, shape.root, shape.path)

  const buffer = await withArtifactPage(shape.path, async (page) =>
    format === 'pdf' ? await renderPdf(page) : (await renderPptx(page, shape.slides)).buffer,
  )

  const { path } = writeBytes(out ?? defaultOut(shape.path, format), buffer)
  return { result: { ok: true, artifact: path, format }, exitCode: EXIT.OK }
}

/**
 * `snapshot <artifact> -o out.png [--slide N]` (CONTRACT D5).
 *
 * The reported dimensions are read back out of the PNG header, so the result
 * describes the file on disk rather than the request that produced it.
 *
 * @returns {Promise<{result: {ok: true, artifact: string, width: number, height: number},
 *   exitCode: number}>}
 */
export async function snapshotArtifact({ target, out, slide }) {
  const shape = artifactShape(target)
  const buffer = await withArtifactPage(shape.path, async (page) =>
    await renderSnapshot(page, { slide, deckSlides: shape.slides }),
  )
  const { width, height } = readPngSize(buffer)
  const { path } = writeBytes(out ?? defaultOut(shape.path, SNAPSHOT_EXT), buffer)
  return { result: { ok: true, artifact: path, width, height }, exitCode: EXIT.OK }
}

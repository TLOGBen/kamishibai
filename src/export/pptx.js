import PptxGenJS from 'pptxgenjs'
import { CODES, EXIT, KsbError } from '../core/errors.js'
import { slideHandles } from './slides.js'

/**
 * Deck artifact → PPTX, one slide per `<section class="slide">`.
 *
 * v1 puts a **screenshot** on each slide. That is a deliberate floor, not an
 * oversight: the alternative — re-deriving PowerPoint shapes from the block tree
 * — is a second renderer, and a second renderer is a second answer to "what does
 * this deck look like". A picture of the real artifact cannot disagree with the
 * artifact. The price is honest and stated: the text is not selectable in
 * PowerPoint. Structured shapes are later work, driven by the IR.
 */

/** 16:9, matching the kami/slides `--slide-ratio`. */
const LAYOUT = 'LAYOUT_16x9'
const FULL_BLEED = Object.freeze({ x: 0, y: 0, w: '100%', h: '100%' })

export async function renderPptx(page, expectedSlides) {
  const handles = await slideHandles(page, expectedSlides)

  const shots = []
  for (const handle of handles) {
    shots.push(await handle.screenshot({ type: 'png' }))
  }

  const pptx = new PptxGenJS()
  pptx.layout = LAYOUT
  for (const shot of shots) {
    pptx.addSlide().addImage({
      ...FULL_BLEED,
      data: `data:image/png;base64,${shot.toString('base64')}`,
    })
  }

  const written = await pptx.write({ outputType: 'nodebuffer' })
  const buffer = Buffer.isBuffer(written) ? written : Buffer.from(written)
  // A PPTX is a ZIP container; `PK` is the local file header signature.
  if (buffer.subarray(0, 2).toString('latin1') !== 'PK') {
    throw new KsbError({
      code: CODES.EXPORT_FAILED,
      message: 'pptx 產出不是合法的 OOXML 容器（開頭應為 PK）',
      exitCode: EXIT.VALIDATION,
    })
  }
  return { buffer, slides: handles.length }
}

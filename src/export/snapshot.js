import { usageError } from '../core/errors.js'
import { slideHandles, SLIDE_SELECTOR } from './slides.js'

/**
 * Artifact → PNG, so an Agent can *see* what it rendered (SPEC §10.1).
 *
 * A deck is snapshotted one slide at a time (CONTRACT D5: slide 1 by default),
 * because a full-page shot of a deck is a column of thumbnails — technically an
 * image, useless as a look at the deck.
 */

/** Verbatim CONTRACT constant — deck snapshots default to the first slide. */
export const DEFAULT_SLIDE = 1

export async function renderSnapshot(page, { slide, deckSlides } = {}) {
  const isDeck = Number.isInteger(deckSlides)

  if (!isDeck) {
    if (slide !== undefined) {
      throw usageError(
        `--slide 只適用於 deck 產物；這份是 document 產物（沒有 ${SLIDE_SELECTOR}）`,
      )
    }
    return await page.screenshot({ type: 'png', fullPage: true })
  }

  const handles = await slideHandles(page, deckSlides)
  const wanted = slide === undefined ? DEFAULT_SLIDE : slide
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > handles.length) {
    throw usageError(`--slide 必須是 1…${handles.length} 之間的整數，收到 ${JSON.stringify(slide)}`)
  }
  return await handles[wanted - 1].screenshot({ type: 'png' })
}

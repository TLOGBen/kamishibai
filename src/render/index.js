import { buildIr } from '../core/ir.js'
import { findDeck } from '../core/blocks.js'
import { assertTemplateVocabulary } from '../core/vocabulary.js'
import { resolveTemplate } from './templates.js'
import { renderBody } from './ssr.js'
import { collectCodepoints, embedFontSubset } from './fonts.js'
import { assembleDocument } from './html.js'

export { resolveTemplate, listTemplateKeys } from './templates.js'
export { IR_SCRIPT_TYPE } from './html.js'

/**
 * Render a canonical doc block tree into a self-contained single-file artifact.
 * Pure with respect to the filesystem destination — nothing about the output
 * path enters the artifact, which is what keeps renders byte-identical (A8).
 *
 * `slides` is present only for deck artifacts, and is read off the block tree
 * rather than off the parse: `replay` rebuilds from the embedded IR alone, so a
 * count derived from the source would simply vanish on the replay path.
 *
 * @returns {Promise<{html: string, ir: object, fonts: {embedded: number, available: number},
 *   slides: number|undefined}>}
 */
export async function renderArtifact({ doc, templateKey, createdAt, generator }) {
  const template = resolveTemplate(templateKey)
  // Before a single byte is drawn: a template that cannot express this document
  // must fail loudly. Skipping unknown types is what a renderer does; doing it
  // as the *only* answer turns a wrong `-t` into a silently empty artifact (C4).
  assertTemplateVocabulary({ doc, manifest: template.manifest })
  const ir = buildIr({ doc, template: template.manifest, createdAt, generator })

  const body = await renderBody(template, doc)
  const styles = template.styles()
  const script = typeof template.script === 'function' ? template.script() : undefined

  const codepoints = collectCodepoints(body, styles, script, doc.meta?.title, doc.meta?.kicker)
  const { css: fontCss, embedded, available } = embedFontSubset(template.fonts, codepoints)

  const html = assembleDocument({
    language: template.language,
    title: doc.meta?.title ?? 'Untitled',
    styles,
    fontCss,
    body,
    script,
    ir,
  })

  const deck = findDeck(doc)

  return {
    html,
    ir,
    fonts: { embedded, available },
    slides: deck === undefined ? undefined : deck.slides.length,
  }
}

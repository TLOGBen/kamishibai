import { buildIr } from '../core/ir.js'
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
 * @returns {Promise<{html: string, ir: object, fonts: {embedded: number, available: number}}>}
 */
export async function renderArtifact({ doc, templateKey, createdAt, generator }) {
  const template = resolveTemplate(templateKey)
  const ir = buildIr({ doc, template: template.manifest, createdAt, generator })

  const body = await renderBody(template, doc)
  const styles = template.styles()

  const codepoints = collectCodepoints(body, styles, doc.meta?.title, doc.meta?.kicker)
  const { css: fontCss, embedded, available } = embedFontSubset(template.fonts, codepoints)

  const html = assembleDocument({
    language: template.language,
    title: doc.meta?.title ?? 'Untitled',
    styles,
    fontCss,
    body,
    ir,
  })

  return { html, ir, fonts: { embedded, available } }
}

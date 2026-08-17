/**
 * Template package descriptor (SPEC §5.2 `[template]` section) for the deck
 * family. `---` only becomes a page break under this key (CONTRACT C4).
 */
export const manifest = Object.freeze({
  namespace: 'kami',
  name: 'slides',
  version: '0.1.0',
  description: 'Kami 簡報模板 — 16:9 單張版面，內建離線播放',
  language: 'zh-TW',
  /**
   * Required root form (CONTRACT C4). `blocks` cannot express this: every
   * long-form type below is legal *inside* a slide, so a flat document tree
   * passes the type check while this template draws only `deck.slides` — the
   * whole document silently disappears. The root form is a separate claim.
   */
  root: 'deck',
  blocks: Object.freeze([
    'doc',
    'deck',
    'slide',
    'section',
    'prose',
    'list',
    'quote',
    'callout',
    'code',
    'table',
    'raw',
  ]),
})

export const templateKey = `${manifest.namespace}/${manifest.name}`

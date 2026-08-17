/**
 * Template package descriptor (SPEC §5.2 `[template]` section).
 * S1 ships it as a module; the TOML manifest lands with the template
 * authoring slice (S7).
 */
export const manifest = Object.freeze({
  namespace: 'kami',
  name: 'long-form',
  version: '0.1.0',
  description: 'Kami 長文模板 — 紙感單欄閱讀版面',
  language: 'zh-TW',
  /** No required root form: this template renders whatever sits under `doc`. */
  root: null,
  blocks: Object.freeze([
    'doc',
    'section',
    'prose',
    'list',
    'quote',
    'callout',
    'code',
    'table',
    'raw',
    'diagram',
  ]),
})

export const templateKey = `${manifest.namespace}/${manifest.name}`

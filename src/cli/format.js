/**
 * The single formatter. Both output paths (`--json` and human-readable) consume
 * the *same* result object: `--json` serialises it, humans get this rendering.
 * Nothing may be computed here that the JSON path cannot show.
 */

const formatErrors = (errors) =>
  [
    `✖ ${errors.length} 個問題：`,
    ...errors.map((e) => `  - [${e.code}] ${e.path}: ${e.message}`),
  ].join('\n')

/** `render` / `replay` share one result shape, so they share one rendering. */
const formatDelivery = (verb) => (r) =>
  [`✔ 已${verb} → ${r.artifact}（${r.bytes} bytes）`, `  正本 → ${r.archived}`].join('\n')

const formatListEntry = (e) =>
  [
    `• ${e.name}　${e.template}　${e.createdAt}　${e.generator}`,
    `  正本 → ${e.artifact}`,
    ...e.copies.map((copy) => `  副本 → ${copy}`),
  ].join('\n')

const formatList = (entries) =>
  entries.length === 0 ? '（此專案尚無產物）' : entries.map(formatListEntry).join('\n')

const RENDERERS = Object.freeze({
  render: formatDelivery('渲染'),
  replay: formatDelivery('重繪'),
  lint: (r) => `✔ lint 通過：${r.artifact}`,
  example: (r) => r.example,
  schema: (r) => JSON.stringify(r, null, 2),
  list: formatList,
  open: (r) => r.path,
})

export function formatResult(command, result) {
  if (result && result.ok === false) return formatErrors(result.errors ?? [])
  const renderer = RENDERERS[command]
  return renderer ? renderer(result) : JSON.stringify(result, null, 2)
}

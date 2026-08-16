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

const RENDERERS = Object.freeze({
  render: (r) => `✔ 已渲染 → ${r.artifact}（${r.bytes} bytes）`,
  lint: (r) => `✔ lint 通過：${r.artifact}`,
  example: (r) => r.example,
  schema: (r) => JSON.stringify(r, null, 2),
})

export function formatResult(command, result) {
  if (result && result.ok === false) return formatErrors(result.errors ?? [])
  const renderer = RENDERERS[command]
  return renderer ? renderer(result) : JSON.stringify(result, null, 2)
}

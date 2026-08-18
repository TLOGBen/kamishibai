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

/**
 * `render` / `replay` share one result shape, so they share one rendering.
 * Every extension key has to surface here too — a key that lives only in
 * `--json` is exactly the two-path drift this formatter exists to prevent.
 */
const formatDelivery = (verb) => (r) =>
  [
    `✔ 已${verb} → ${r.artifact}（${r.bytes} bytes${
      Number.isInteger(r.slides) ? `，${r.slides} 張` : ''
    }）`,
    `  正本 → ${r.archived}`,
  ].join('\n')

const formatListEntry = (e) =>
  [
    `• ${e.name}　${e.template}　${e.createdAt}　${e.generator}`,
    `  正本 → ${e.artifact}`,
    ...e.copies.map((copy) => `  副本 → ${copy}`),
  ].join('\n')

const formatList = (entries) =>
  entries.length === 0 ? '（此專案尚無產物）' : entries.map(formatListEntry).join('\n')

/** Every key of the pinned export/snapshot shapes has to reach human output too. */
const formatExport = (r) => `✔ 已匯出 ${r.format} → ${r.artifact}`
const formatSnapshot = (r) => `✔ 已截圖 → ${r.artifact}（${r.width}×${r.height}）`
const formatSetup = (r) =>
  [
    `✔ 中央儲存庫 → ${r.home}`,
    `  瀏覽器：${r.browser}（安裝指令：${r.command}）`,
  ].join('\n')

/**
 * S5 surfaces. Every key of each pinned JSON shape has to appear here too —
 * the `--json` path and the human path are the same result object rendered
 * twice, and a key that only one of them shows is the drift this file exists
 * to prevent.
 */
const formatServe = (r) =>
  [
    `✔ 預覽伺服器 → ${r.url}`,
    `  pid ${r.pid}　port ${r.port}`,
    `  正本 → ${r.artifact}`,
  ].join('\n')

const formatClose = (r) =>
  [
    r.closed.length === 0 ? '✔ 沒有執行中的預覽伺服器' : `✔ 已終止 ${r.closed.join('、')}`,
    ...(r.stale.length === 0 ? [] : [`  已清掉的殘留紀錄：${r.stale.join('、')}`]),
  ].join('\n')

const formatCommentEntry = (e) => `• [${e.status}] ${e.id}　${e.blockId}　${e.ts}\n  ${e.text}`

/** `comments` lists an array; `comments add|resolve` answer with one entry. */
const formatComments = (result) => {
  if (!Array.isArray(result)) return formatCommentEntry(result)
  return result.length === 0 ? '（此產物尚無留言）' : result.map(formatCommentEntry).join('\n')
}

const formatTemplateEntry = (t) =>
  `• ${t.namespace}/${t.name}@${t.version}　root=${t.root === '' ? '（不限）' : t.root}`

const formatTemplates = (entries) =>
  entries.length === 0 ? '（尚未註冊任何模板包）' : entries.map(formatTemplateEntry).join('\n')

const formatDebug = (r) =>
  [
    `✔ 中央儲存庫 → ${r.home}`,
    `  模板包：${r.templates}`,
    `  瀏覽器：${r.browser}`,
    `  引擎：${r.engine}`,
    `  執行中的預覽伺服器：${r.servers}`,
  ].join('\n')

const RENDERERS = Object.freeze({
  render: formatDelivery('渲染'),
  replay: formatDelivery('重繪'),
  export: formatExport,
  snapshot: formatSnapshot,
  setup: formatSetup,
  lint: (r) => `✔ lint 通過：${r.artifact}`,
  example: (r) => r.example,
  schema: (r) => JSON.stringify(r, null, 2),
  list: formatList,
  open: (r) => r.path,
  serve: formatServe,
  close: formatClose,
  comments: formatComments,
  templates: formatTemplates,
  debug: formatDebug,
})

export function formatResult(command, result) {
  if (result && result.ok === false) return formatErrors(result.errors ?? [])
  const renderer = RENDERERS[command]
  return renderer ? renderer(result) : JSON.stringify(result, null, 2)
}

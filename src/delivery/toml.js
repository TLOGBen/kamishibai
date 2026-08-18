import { CODES, EXIT, KsbError } from '../core/errors.js'

/**
 * A deliberately tiny TOML writer/reader for template package manifests
 * (CONTRACT E3, SPEC §5.2「描述檔格式定為 TOML」).
 *
 * Scope is the whole point: the manifest is a *flat* table of strings and
 * string arrays, so a full TOML implementation would be several hundred lines
 * of surface that nothing in this SDK exercises — and a dependency whose
 * formatting choices we do not control would break the byte-consistency claim
 * the manifest is pinned on. What is written here is read back here, and both
 * halves are asserted against the JS manifest they mirror.
 *
 * Determinism: key order is the caller's insertion order, arrays keep their
 * element order, and no value is ever re-wrapped or re-flowed. The same
 * manifest therefore serialises to the same bytes on every machine, which is
 * what lets `registerTemplatePackage` skip an identical rewrite.
 */

/** Only these two value shapes are legal in a manifest table. */
const isStringArray = (value) => Array.isArray(value) && value.every((v) => typeof v === 'string')

const manifestError = (message) =>
  new KsbError({
    code: CODES.PARSE_FAILED,
    message,
    exitCode: EXIT.VALIDATION,
  })

/** TOML basic string: only the escapes the manifest alphabet can actually need. */
const quote = (value) =>
  `"${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}"`

const unquote = (raw) => {
  const body = raw.slice(1, -1)
  return body.replace(/\\(.)/g, (_, c) => {
    if (c === 'n') return '\n'
    if (c === 'r') return '\r'
    if (c === 't') return '\t'
    return c
  })
}

const formatValue = (value) => {
  if (typeof value === 'string') return quote(value)
  if (isStringArray(value)) return `[${value.map(quote).join(', ')}]`
  throw manifestError(`manifest value must be a string or a string array, got ${typeof value}`)
}

/**
 * Serialise a flat table to TOML.
 * @param {Record<string, string|string[]>} table
 * @returns {string} newline-terminated TOML text
 */
export function stringifyToml(table) {
  const lines = Object.entries(table).map(([key, value]) => `${key} = ${formatValue(value)}`)
  return `${lines.join('\n')}\n`
}

const KEY_LINE = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/
const STRING_VALUE = /^"(?:[^"\\]|\\.)*"$/

const parseValue = (raw, key) => {
  const text = raw.trim()
  if (STRING_VALUE.test(text)) return unquote(text)
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim()
    if (inner.length === 0) return []
    const parts = inner.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
    for (const part of parts) {
      if (!STRING_VALUE.test(part)) throw manifestError(`array entry of "${key}" is not a string: ${part}`)
    }
    return parts.map(unquote)
  }
  throw manifestError(`value of "${key}" is neither a string nor a string array: ${text}`)
}

/**
 * Parse a flat TOML table. Anything this writer cannot have produced is a
 * hard error rather than a silently dropped key — a manifest that half-parses
 * is exactly the "template resolves to something unexpected" failure E3 exists
 * to make impossible.
 *
 * @param {string} text
 * @returns {Record<string, string|string[]>}
 */
export function parseToml(text) {
  const table = {}
  for (const [index, line] of String(text ?? '').split('\n').entries()) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue
    const match = KEY_LINE.exec(trimmed)
    if (match === null) throw manifestError(`line ${index + 1} is not a key/value pair: ${trimmed}`)
    table[match[1]] = parseValue(match[2], match[1])
  }
  return table
}

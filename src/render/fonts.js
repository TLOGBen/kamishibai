import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)

const FACE_RE = /@font-face\s*\{([^}]*)\}/g
const DECL = (body, prop) => {
  const m = new RegExp(`${prop}\\s*:\\s*([^;]+);`).exec(body)
  return m ? m[1].trim() : null
}

const parseUnicodeRange = (spec) =>
  spec
    .split(',')
    .map((chunk) => chunk.trim().replace(/^U\+/i, ''))
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const [lo, hi] = chunk.split('-')
      return { lo: parseInt(lo, 16), hi: parseInt(hi ?? lo, 16) }
    })
    .filter((r) => Number.isFinite(r.lo) && Number.isFinite(r.hi))

/** Parse a @fontsource stylesheet into ordered face descriptors. */
export function parseFontFaces(cssPath) {
  const css = readFileSync(cssPath, 'utf8')
  const baseDir = dirname(cssPath)
  const faces = []
  let m
  while ((m = FACE_RE.exec(css)) !== null) {
    const body = m[1]
    const unicodeRange = DECL(body, 'unicode-range')
    const src = DECL(body, 'src')
    if (unicodeRange === null || src === null) continue
    const woff2 = /url\(([^)]+\.woff2)\)/.exec(src)
    if (woff2 === null) continue
    faces.push({
      index: faces.length,
      family: (DECL(body, 'font-family') ?? "'sans-serif'").replace(/^['"]|['"]$/g, ''),
      style: DECL(body, 'font-style') ?? 'normal',
      weight: DECL(body, 'font-weight') ?? '400',
      display: DECL(body, 'font-display') ?? 'swap',
      unicodeRange,
      ranges: parseUnicodeRange(unicodeRange),
      file: resolve(baseDir, woff2[1]),
    })
  }
  return faces
}

/** Distinct code points used by a rendered document. */
export function collectCodepoints(...texts) {
  const points = new Set()
  for (const text of texts) {
    if (typeof text !== 'string') continue
    for (const char of text) points.add(char.codePointAt(0))
  }
  return points
}

const buildIndex = (faces) => {
  const entries = []
  for (const face of faces) {
    for (const range of face.ranges) entries.push({ ...range, face: face.index })
  }
  return entries.sort((a, b) => a.lo - b.lo || a.hi - b.hi)
}

const lookup = (index, cp) => {
  let lo = 0
  let hi = index.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (cp < index[mid].lo) hi = mid - 1
    else if (cp > index[mid].hi) lo = mid + 1
    else return index[mid].face
  }
  return -1
}

/** Faces whose unicode-range intersects the used code points, in file order. */
export function selectFaces(faces, codepoints) {
  const index = buildIndex(faces)
  const used = new Set()
  for (const cp of codepoints) {
    const hit = lookup(index, cp)
    if (hit !== -1) used.add(hit)
  }
  return faces.filter((face) => used.has(face.index))
}

const faceCss = (face) => {
  const data = readFileSync(face.file).toString('base64')
  return [
    '@font-face{',
    `font-family:'${face.family}';`,
    `font-style:${face.style};`,
    `font-display:${face.display};`,
    `font-weight:${face.weight};`,
    `src:url(data:font/woff2;base64,${data}) format('woff2');`,
    `unicode-range:${face.unicodeRange};`,
    '}',
  ].join('')
}

/**
 * Build the @font-face CSS for a template's font specs, embedding only the
 * subset chunks whose unicode-range intersects the document's characters.
 *
 * @param {Array<{package: string, weights: string[]}>} specs
 * @param {Set<number>} codepoints
 * @returns {{css: string, embedded: number, available: number}}
 */
export function embedFontSubset(specs, codepoints) {
  const parts = []
  let embedded = 0
  let available = 0
  for (const spec of specs) {
    for (const weight of spec.weights) {
      const cssPath = require.resolve(`${spec.package}/${weight}.css`)
      const faces = parseFontFaces(cssPath)
      available += faces.length
      const selected = selectFaces(faces, codepoints)
      embedded += selected.length
      for (const face of selected) parts.push(faceCss(face))
    }
  }
  return { css: parts.join('\n'), embedded, available }
}

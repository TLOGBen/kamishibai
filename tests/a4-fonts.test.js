import { readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir } from './helpers.js'

const require = createRequire(import.meta.url)
const OUT_DIR = outDir('a4')
const ARTIFACT = `${OUT_DIR}/book.html`

const countFaces = (text) => (text.match(/@font-face/g) ?? []).length

/** Total subset chunks shipped by @fontsource for the weights we embed. */
const availableChunks = () =>
  ['400', '700']
    .map((w) => countFaces(readFileSync(require.resolve(`@fontsource/noto-serif-tc/${w}.css`), 'utf8')))
    .reduce((a, b) => a + b, 0)

describe('A4 字體子集內嵌', () => {
  let html

  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT]).code).toBe(0)
    html = readFileSync(ARTIFACT, 'utf8')
  })

  it('test_a4_woff2_data_uri_embedded: 內嵌 Noto Serif TC 的 WOFF2 data URI', () => {
    expect(html).toContain("font-family:'Noto Serif TC'")
    expect(html).toMatch(/src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]+\) format\('woff2'\)/)
  })

  it('test_a4_only_used_chunks_embedded: 只嵌 unicode-range 有交集的 chunk（真子集）', () => {
    const embedded = (html.match(/url\(data:font\/woff2;base64,/g) ?? []).length
    const available = availableChunks()
    expect(embedded).toBeGreaterThan(0)
    expect(available).toBeGreaterThan(100)
    expect(embedded).toBeLessThan(available / 2)
    // 每個內嵌 @font-face 都保留自己的 unicode-range
    expect(countFaces(html)).toBe(embedded)
    expect((html.match(/unicode-range:/g) ?? []).length).toBe(embedded)
  })

  it('test_a4_no_tsanger_font_shipped: 全檔不得出現 TsangerJinKai', () => {
    expect(html).not.toContain('TsangerJinKai')
  })

  it('test_a4_declared_families_are_embedded: 產物 CSS 宣告的具名字族皆有內嵌 face', () => {
    const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
    const embedded = new Set(
      [...css.matchAll(/@font-face\{font-family:'([^']+)'/g)].map((m) => m[1]),
    )
    expect(embedded.size).toBeGreaterThan(0)

    // CSS 泛用關鍵字不是具名字族，不需內嵌
    const GENERIC = new Set([
      'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
      'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji',
      'fangsong', 'inherit', 'initial', 'unset', 'revert', 'revert-layer',
    ])

    // 不列舉變數名：任何自訂屬性只要「長得像字族堆疊」就一起檢查，
    // 否則新增一個 --display 變數就能繞過整條規則。
    const looksLikeFontStack = (value) =>
      /['"]/.test(value) || value.split(',').some((p) => GENERIC.has(p.trim()))

    const namesIn = (value) =>
      value
        .split(',')
        .map((p) => p.trim().replace(/^['"]|['"]$/g, ''))
        .filter((name) => name.length > 0 && !GENERIC.has(name))

    const declaredNames = new Set()
    let inspected = 0

    for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      const value = m[1].trim()
      inspected += 1
      if (value.startsWith('var(')) continue // 由該變數自己的宣告負責
      for (const name of namesIn(value)) declaredNames.add(name)
    }

    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
      const value = m[2].trim()
      if (value.startsWith('var(') || !looksLikeFontStack(value)) continue
      inspected += 1
      for (const name of namesIn(value)) declaredNames.add(name)
    }

    expect(inspected, '應至少檢查到 font-family 與字族變數各若干條').toBeGreaterThan(1)
    expect(declaredNames.size, '應至少辨識出一個具名字族').toBeGreaterThan(0)

    const orphans = [...declaredNames].filter((name) => !embedded.has(name))
    expect(orphans, `宣告了卻未內嵌的字族：${orphans.join(', ')}`).toEqual([])
  })

  it('test_a4_font_stacks_declared: 襯線宣告 Noto Serif TC；等寬為 generic monospace', () => {
    expect(html).toContain("--serif: 'Noto Serif TC', serif")
    expect(html).toMatch(/--mono:\s*monospace/)
    // S1 不內嵌 Maple（延至 S3），因此也不得宣告它（CONTRACT A4「宣告即內嵌」）
    expect(html).not.toContain('Maple Mono')
  })
})

import { readFileSync, rmSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir } from './helpers.js'
import { EXTERNAL_RULES } from '../src/core/lint.js'
import { liveMarkup, styleRegions } from '../src/core/scan.js'

const OUT_DIR = outDir('a3')
const ARTIFACT = `${OUT_DIR}/book.html`

describe('A3 零外部請求', () => {
  let html

  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT]).code).toBe(0)
    html = readFileSync(ARTIFACT, 'utf8')
  })

  it('test_a3_no_external_resource_forms: 產物不含任何外部資源引用形', () => {
    // 禁形清單直接引用 lint 的單一真源，不另謄一份（避免兩處定義漂移）
    expect(EXTERNAL_RULES).toHaveLength(5)
    const regions = { markup: liveMarkup(html), css: styleRegions(html) }
    const hits = EXTERNAL_RULES.filter(({ re, scope }) => re.test(regions[scope])).map(
      ({ what }) => what,
    )
    expect(hits).toEqual([])
  })

  it('test_a3_content_external_links_survive: 內容中的外部 <a href> 不受影響', () => {
    expect(html).toContain('<a href="https://openslide.org/">')
  })
})

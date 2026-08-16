import { readFileSync, rmSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, extractIrScripts } from './helpers.js'

const OUT_DIR = outDir('a2')
const ARTIFACT = `${OUT_DIR}/book.html`

describe('A2 IR 隨行', () => {
  let html

  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    const r = runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT])
    expect(r.code).toBe(0)
    html = readFileSync(ARTIFACT, 'utf8')
  })

  it('test_a2_embedded_ir_fields: 恰一個 kamishibai+json script，可解析且欄位齊全', () => {
    const scripts = extractIrScripts(html)
    expect(scripts).toHaveLength(1)

    const ir = JSON.parse(scripts[0])
    expect(Object.keys(ir).sort()).toEqual(
      ['createdAt', 'doc', 'engine', 'generator', 'irVersion', 'template'].sort(),
    )
    expect(typeof ir.irVersion).toBe('string')
    expect(typeof ir.engine).toBe('string')
    expect(Object.keys(ir.template).sort()).toEqual(['name', 'namespace', 'version'])
    expect(ir.template.namespace).toBe('kami')
    expect(ir.template.name).toBe('long-form')
    expect(ir.doc.type).toBe('doc')
    expect(typeof ir.createdAt).toBe('string')
    expect(typeof ir.generator).toBe('string')
  })

  it('test_a2_ir_carries_full_block_tree: 島嶼、表格、callout 都在 block tree 內', () => {
    const ir = JSON.parse(extractIrScripts(html)[0])
    const types = new Set()
    const walk = (node) => {
      types.add(node.type)
      for (const child of node.children ?? []) walk(child)
    }
    walk(ir.doc)
    for (const t of ['doc', 'section', 'prose', 'quote', 'callout', 'code', 'table', 'raw']) {
      expect(types.has(t)).toBe(true)
    }
  })
})

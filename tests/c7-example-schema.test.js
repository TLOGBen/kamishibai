import { readFileSync, rmSync } from 'node:fs'
import Ajv2020Module from 'ajv/dist/2020.js'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, extractIrScripts } from './helpers.js'
import { EXAMPLE_KINDS } from '../src/core/example.js'

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module
const OUT_DIR = outDir('c7')
const NEW_TYPES = Object.freeze(['list', 'deck', 'slide'])

describe('C7 example／schema 家族擴充', () => {
  beforeAll(() => rmSync(OUT_DIR, { recursive: true, force: true }))

  it('test_example_deck_roundtrip: example deck 輸出合法 deck 語料並可餵回 render', () => {
    const example = runCli(['example', 'deck'])
    expect(example.code, `example exit（stderr: ${example.stderr}）`).toBe(0)
    expect(example.stdout.trimStart().startsWith('---'), 'deck 語料應是 Markdown 超集').toBe(true)
    expect(example.stdout, 'deck 語料必須自帶 slides 模板').toContain('template: kami/slides')
    expect(example.stdout, 'deck 語料必須示範切頁符').toMatch(/^-{3,}\s*$/m)

    const artifact = `${OUT_DIR}/example-deck.html`
    const rendered = runCli(['render', '-', '-o', artifact, '--json'], { input: example.stdout })
    expect(rendered.code, `render exit（stderr: ${rendered.stderr}）`).toBe(0)

    const out = JSON.parse(rendered.stdout)
    const breaks = example.stdout
      .replace(/^---\n[\s\S]*?\n---\n/, '')
      .split('\n')
      .filter((line) => /^-{3,}\s*$/.test(line)).length
    expect(breaks, '教材至少要示範兩次切頁').toBeGreaterThanOrEqual(2)
    expect(out.slides, '教材的張數須等於切頁符段數').toBe(breaks + 1)

    expect(runCli(['lint', artifact]).code, '教材產物必須 lint 通過').toBe(0)
    expect(extractIrScripts(readFileSync(artifact, 'utf8'))).toHaveLength(1)
  })

  it('test_c7_every_example_kind_resolves: EXAMPLE_KINDS 每一項都真的有範例', () => {
    expect(EXAMPLE_KINDS).toEqual(expect.arrayContaining(NEW_TYPES))
    for (const kind of EXAMPLE_KINDS) {
      const r = runCli(['example', kind, '--json'])
      expect(r.code, `example ${kind} exit`).toBe(0)
      const out = JSON.parse(r.stdout)
      expect(out.ok).toBe(true)
      expect(out.kind).toBe(kind)
      expect(out.example.length, `example ${kind} 不得為空`).toBeGreaterThan(0)
    }
  })

  it('test_schema_defines_list_deck_slide: schema 含三個新型別的定義且 deck IR 過驗', () => {
    const schemaRun = runCli(['schema'])
    expect(schemaRun.code).toBe(0)
    const schema = JSON.parse(schemaRun.stdout)

    const enumerated = schema.$defs.block.properties.type.enum
    for (const type of NEW_TYPES) {
      expect(enumerated, `schema 的 block 型別集缺 ${type}`).toContain(type)
    }

    // 光在 enum 裡不算「有定義」：每個型別都要有自己的 if/then 分支釘住欄位
    const branches = schema.$defs.block.allOf
    const branchFor = (type) =>
      branches.find((b) => b.if?.properties?.type?.const === type)?.then
    expect(branchFor('list').required.sort()).toEqual(['items', 'ordered'])
    expect(branchFor('list').properties.ordered).toEqual({ type: 'boolean' })
    expect(branchFor('deck').required).toEqual(['slides'])
    expect(branchFor('slide').required).toEqual(['children'])

    const artifact = `${OUT_DIR}/schema-deck.html`
    expect(
      runCli(['render', 'fixtures/slides-sample.md', '-o', artifact]).code,
      'deck 語料 render 失敗',
    ).toBe(0)
    const ir = JSON.parse(extractIrScripts(readFileSync(artifact, 'utf8'))[0])

    const ajv = new Ajv2020({ allErrors: true, strict: false })
    const validate = ajv.compile(schema)
    const valid = validate(ir)
    expect(validate.errors ?? []).toEqual([])
    expect(valid).toBe(true)
  })

  it('test_c7_schema_rejects_malformed_new_blocks: 缺欄位／型別錯誤的新 block 須被擋下', () => {
    const schema = JSON.parse(runCli(['schema']).stdout)
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    const validate = ajv.compile(schema)

    const envelope = (children) => ({
      irVersion: '1',
      engine: '0.1.0',
      template: { namespace: 'kami', name: 'slides', version: '0.1.0' },
      doc: { id: 'b1', type: 'doc', meta: { title: 't' }, children },
      createdAt: '2026-08-17T00:00:00.000Z',
      generator: 'test',
    })

    // 合法的對照組——否則下面每一條「應為 false」都可能只是別的欄位在報錯
    expect(
      validate(
        envelope([
          {
            id: 'b2',
            type: 'list',
            ordered: true,
            items: [[{ id: 'b3', type: 'prose', html: 'x' }]],
          },
        ]),
      ),
    ).toBe(true)

    expect(validate(envelope([{ id: 'b2', type: 'list', items: [] }])), 'list 缺 ordered').toBe(false)
    expect(
      validate(envelope([{ id: 'b2', type: 'list', ordered: 'yes', items: [] }])),
      'ordered 非 boolean',
    ).toBe(false)
    expect(
      validate(envelope([{ id: 'b2', type: 'list', ordered: true, items: [{ id: 'b3' }] }])),
      'items 必須是 block 陣列的陣列',
    ).toBe(false)
    expect(validate(envelope([{ id: 'b2', type: 'deck' }])), 'deck 缺 slides').toBe(false)
    expect(validate(envelope([{ id: 'b2', type: 'slide' }])), 'slide 缺 children').toBe(false)
  })
})

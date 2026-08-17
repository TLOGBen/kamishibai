import { readFileSync, rmSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, extractIrScripts, repoRoot } from './helpers.js'

const OUT_DIR = outDir('c1')
const SAMPLE = `${repoRoot}/fixtures/book-sample.md`
const ARTIFACT = `${OUT_DIR}/book.html`

const bodyOf = (html) => html.slice(html.indexOf('<body>'), html.indexOf('<script type='))

/** Depth-first over every nesting shape (children / slides / items). */
const collect = (node, acc = []) => {
  acc.push(node)
  for (const child of node.children ?? []) collect(child, acc)
  for (const slide of node.slides ?? []) collect(slide, acc)
  for (const item of node.items ?? []) for (const child of item) collect(child, acc)
  return acc
}

const irOf = (path) => JSON.parse(extractIrScripts(readFileSync(path, 'utf8'))[0])

describe('C1 list block', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    expect(runCli(['render', SAMPLE, '-o', ARTIFACT]).code).toBe(0)
  })

  it('test_render_list_block: 清單成為 list block，外框保留、項目內容是子 block', () => {
    const ir = irOf(ARTIFACT)
    const body = bodyOf(readFileSync(ARTIFACT, 'utf8'))
    const blocks = collect(ir.doc)
    const lists = blocks.filter((b) => b.type === 'list')

    // 語料必須同時涵蓋兩種清單，否則條件窄化成只認其中一種也會全綠
    expect(lists.length, '語料應含多個 list block').toBeGreaterThan(1)
    expect(lists.some((l) => l.ordered === true), '語料缺有序清單').toBe(true)
    expect(lists.some((l) => l.ordered === false), '語料缺無序清單').toBe(true)

    for (const list of lists) {
      expect(typeof list.ordered, 'ordered 必須是 boolean').toBe('boolean')
      expect(Array.isArray(list.items), 'items 必須是陣列').toBe(true)
      expect(list.items.length, 'list 不得沒有項目').toBeGreaterThan(0)
      expect(typeof list.id).toBe('string')
      for (const item of list.items) {
        // 每個項目是一組 block，不是字串——這正是 C1 的形狀
        expect(Array.isArray(item), 'item 必須是 block 陣列').toBe(true)
        expect(item.length, '空項目代表內容遺失').toBeGreaterThan(0)
        for (const block of item) {
          expect(typeof block.type, 'item 內必須是 block').toBe('string')
          expect(typeof block.id, 'item 內的 block 也必須有 id').toBe('string')
        }
      }
    }

    // id 全域唯一：items 若沒被 withIds 走到，項目內的 block 會共用 undefined
    const ids = blocks.map((b) => b.id)
    expect(new Set(ids).size, 'block id 必須全域唯一').toBe(ids.length)

    // <ul>/<ol> 結構保留，而且是 list block 自己的外框
    expect(body).toMatch(/<ul class="list">/)
    expect(body).toMatch(/<ol class="list">/)
    const framesInBody = (body.match(/<(?:ul|ol) class="list">/g) ?? []).length
    expect(framesInBody, 'body 的清單外框數須等於 IR 的 list block 數').toBe(lists.length)
  })

  it('test_c1_list_no_longer_goes_through_prose: 純清單不再經 prose html 路徑', () => {
    const body = bodyOf(readFileSync(ARTIFACT, 'utf8'))
    const ir = irOf(ARTIFACT)
    for (const block of collect(ir.doc).filter((b) => b.type === 'prose')) {
      expect(/<(?:ul|ol)\b/i.test(block.html), `prose 仍夾帶清單 HTML：${block.html}`).toBe(false)
    }
    expect(body, '清單不得再被 prose 容器包住').not.toMatch(/class="prose">\s*<[uo]l>/)
  })

  it('test_c1_nested_list_is_a_child_block: 巢狀清單是外層項目的子 block', () => {
    const source = [
      '---',
      'title: 巢狀清單',
      '---',
      '',
      '# 章節',
      '',
      '- 外層一',
      '  - 內層一',
      '  - 內層二',
      '- 外層二',
    ].join('\n')

    const artifact = `${OUT_DIR}/nested.html`
    expect(runCli(['render', '-', '-o', artifact], { input: source }).code).toBe(0)
    const ir = irOf(artifact)
    const lists = collect(ir.doc).filter((b) => b.type === 'list')
    expect(lists, '巢狀清單應產生兩個 list block').toHaveLength(2)

    const outer = lists.find((l) => l.items.some((item) => item.some((b) => b.type === 'list')))
    expect(outer, '內層清單必須掛在外層項目底下，而非與它平列').toBeDefined()
    expect(outer.items).toHaveLength(2)

    const body = bodyOf(readFileSync(artifact, 'utf8'))
    expect(body, '巢狀清單的 <ul> 必須真的巢在 <li> 裡').toMatch(/<li>[\s\S]*?<ul class="list">/)
    expect(runCli(['lint', artifact]).code).toBe(0)
  })
})

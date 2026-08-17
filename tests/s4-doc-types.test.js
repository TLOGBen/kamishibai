import { readFileSync, rmSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, repoRoot, extractIrScripts } from './helpers.js'

const OUT_DIR = outDir('s4')
const PROOFREAD_SRC = `${repoRoot}/fixtures/proofread-sample.md`
const JOURNAL_SRC = `${repoRoot}/fixtures/journal-sample.md`
const PROJECT = 's4-doc-types'

/**
 * S4 錯字修改表的六欄表頭 —— verbatim。baransu `/write` Proofread 原型以欄名
 * 為鍵做比對與統計，改一個字下游就對不上，所以這裡逐字釘死而非只驗欄數。
 */
const FINDINGS_HEAD = Object.freeze([
  '頁數',
  '段落上下文',
  '原文內容',
  '錯誤類型',
  '建議修正',
  '修改原因',
])

/** 走 runCli（helpers 注入 KAMISHIBAI_HOME）——絕不觸真實 ~/.kamishibai。 */
const render = (source, name) =>
  runCli(['render', source, '-o', `${OUT_DIR}/${name}.html`, '--project', PROJECT, '--json'])

const lint = (name) => runCli(['lint', `${OUT_DIR}/${name}.html`, '--json'])

/** 由產物取回內嵌 IR；恰一份是 A2/A5 已有的條件，這裡順帶再斷言一次。 */
const irOf = (name) => {
  const payloads = extractIrScripts(readFileSync(`${OUT_DIR}/${name}.html`, 'utf8'))
  expect(payloads.length, `${name} 內嵌 IR 份數`).toBe(1)
  return JSON.parse(payloads[0])
}

/** 深度優先蒐集所有指定型別的 block。 */
const collect = (node, type, acc = []) => {
  if (node?.type === type) acc.push(node)
  if (Array.isArray(node?.children)) for (const c of node.children) collect(c, type, acc)
  return acc
}

describe('S4 文件類輕客戶：既有管線承載兩種文件形態', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
  })

  describe('錯字修改表', () => {
    it('test_s4_proofread_renders_and_lints_clean: render/lint 皆 exit 0', () => {
      const rendered = render(PROOFREAD_SRC, 'proofread')
      expect(rendered.code, `render exit（stderr: ${rendered.stderr}）`).toBe(0)
      expect(JSON.parse(rendered.stdout).ok).toBe(true)

      const linted = lint('proofread')
      expect(linted.code, `lint exit（stderr: ${linted.stderr}）`).toBe(0)
      expect(JSON.parse(linted.stdout).errors).toEqual([])
    })

    it('test_s4_proofread_findings_table_head_verbatim: IR 含 table block 且六欄表頭逐字正確', () => {
      const ir = irOf('proofread')
      const tables = collect(ir.doc, 'table')
      expect(tables.length, 'findings 表應恰為一個 table block').toBe(1)
      expect(tables[0].head).toEqual(FINDINGS_HEAD)
      expect(tables[0].head.length).toBe(6)
      expect(tables[0].rows.length, 'findings 至少三列').toBeGreaterThanOrEqual(3)
      for (const row of tables[0].rows) {
        expect(row.length, '每列欄數必須與表頭一致').toBe(FINDINGS_HEAD.length)
      }
    })

    it('test_s4_proofread_has_frontmatter_and_lead_prose: frontmatter 進 meta、表前有說明散文', () => {
      const ir = irOf('proofread')
      expect(ir.doc.meta.title).toBe('錯字修改表　試樣')
      expect(typeof ir.doc.meta.date, 'date 必須是字串才會進 meta').toBe('string')

      const section = ir.doc.children.find((b) => b.type === 'section')
      expect(section, 'doc 下應有 section').toBeDefined()
      const tableIndex = section.children.findIndex((b) => b.type === 'table')
      expect(tableIndex, 'table 之前必須有內容').toBeGreaterThan(0)
      expect(section.children.slice(0, tableIndex).some((b) => b.type === 'prose')).toBe(true)
    })
  })

  describe('工作日誌', () => {
    it('test_s4_journal_renders_and_lints_clean: render/lint 皆 exit 0', () => {
      const rendered = render(JOURNAL_SRC, 'journal')
      expect(rendered.code, `render exit（stderr: ${rendered.stderr}）`).toBe(0)
      expect(JSON.parse(rendered.stdout).ok).toBe(true)

      const linted = lint('journal')
      expect(linted.code, `lint exit（stderr: ${linted.stderr}）`).toBe(0)
      expect(JSON.parse(linted.stdout).errors).toEqual([])
    })

    it('test_s4_journal_two_sections_with_callout_in_log: IR 含兩個 section，執行日誌內含 callout', () => {
      const ir = irOf('journal')
      const sections = collect(ir.doc, 'section')
      expect(sections.length, 'IR 應恰含兩個 section block').toBe(2)
      expect(sections.map((s) => s.title)).toEqual(['原始輸出', '執行日誌'])

      const [rawOutput, log] = sections

      // 原始輸出：至少一段散文＋一個 code block
      expect(rawOutput.children.some((b) => b.type === 'prose'), '原始輸出缺散文').toBe(true)
      const codes = collect(rawOutput, 'code')
      expect(codes.length, '原始輸出缺 code block').toBeGreaterThanOrEqual(1)
      expect(codes[0].text.length).toBeGreaterThan(0)

      // 執行日誌：callout 必須是真的 block，不是被壓進 prose 的原始 HTML
      const callouts = collect(log, 'callout')
      expect(callouts.length, '執行日誌缺 callout block').toBeGreaterThanOrEqual(1)
      expect(callouts.some((c) => c.variant === 'warn'), 'callout 應有 warn 變體').toBe(true)
      // 「殘留」有兩種形：未被消化的容器標記，或第二條渲染路徑吐出的 callout 標記。
      // 只看 section 的直屬 prose——callout 自己的 body 允許用行內程式碼談論容器語法。
      for (const { html } of log.children.filter((b) => b.type === 'prose')) {
        expect(/:{3,}\s*(?:note|warn)/.test(html), `prose 殘留未消化的容器標記：${html}`).toBe(false)
        expect(/class=["']?callout/.test(html), `prose 內出現第二條 callout 渲染路徑：${html}`).toBe(
          false,
        )
      }
    })

    it('test_s4_journal_log_entries_newest_first: 執行日誌至少三條時間條目且新在上', () => {
      const ir = irOf('journal')
      const log = collect(ir.doc, 'section').find((s) => s.title === '執行日誌')

      const stamps = []
      for (const { html } of collect(log, 'prose')) {
        for (const m of html.matchAll(/<li>\s*<strong>(\d{2}:\d{2})<\/strong>/g)) stamps.push(m[1])
      }
      expect(stamps.length, '時間條目至少三條').toBeGreaterThanOrEqual(3)

      const descending = [...stamps].sort().reverse()
      expect(stamps, '執行日誌必須新在上').toEqual(descending)
    })
  })

  it('test_s4_doc_types_reuse_existing_block_vocabulary: 兩份文件的 block 型別皆屬既有詞彙', async () => {
    const { BLOCK_TYPES } = await import('../src/core/blocks.js')
    const seen = new Set()
    for (const name of ['proofread', 'journal']) {
      const walk = (node) => {
        if (node.type !== 'doc') seen.add(node.type)
        if (Array.isArray(node.children)) node.children.forEach(walk)
      }
      walk(irOf(name).doc)
    }
    expect([...seen].filter((t) => !BLOCK_TYPES.includes(t)), '出現詞彙外的 block 型別').toEqual([])
    // 兩種文件形態合計必須真的用到 table 與 callout——否則本檔什麼也沒證明
    expect(seen.has('table')).toBe(true)
    expect(seen.has('callout')).toBe(true)
  })
})

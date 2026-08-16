import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { describe, it, expect, beforeEach } from 'vitest'
import { runCli, outDir, extractIrScripts } from './helpers.js'

const OUT_DIR = outDir('a1')
const ARTIFACT = `${OUT_DIR}/book.html`

/** Body markup between </head> and the embedded IR script. */
const bodyOf = (html) => html.slice(html.indexOf('<body>'), html.indexOf('<script type='))

/** Decode the entity escaping Vue applies to text nodes, for content comparison. */
const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

const collect = (node, out = []) => {
  out.push(node)
  for (const child of node.children ?? []) collect(child, out)
  return out
}

/** Per block type: a marker that must appear in the body when the type is present. */
const TYPE_MARKERS = Object.freeze({
  section: 'class="section',
  prose: 'class="prose"',
  quote: 'class="quote"',
  callout: 'class="callout',
  code: 'class="code"',
  table: 'class="table"',
  raw: 'class="island"',
})

describe('A1 render 基本行為', () => {
  beforeEach(() => rmSync(OUT_DIR, { recursive: true, force: true }))

  it('test_render_exit0_single_html: render fixture 成功且恰產出一個 .html 檔', () => {
    const r = runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT])
    expect(r.code).toBe(0)
    expect(existsSync(ARTIFACT)).toBe(true)
    const htmlFiles = readdirSync(OUT_DIR).filter((f) => f.endsWith('.html'))
    expect(htmlFiles).toHaveLength(1)
  })

  it('test_render_escapes_document_metadata: meta 中的 HTML 特殊字元須轉義，不得注入標記', () => {
    const source = [
      '---',
      'title: \'標題含 <script> 與 "引號" & 符號\'',
      '---',
      '',
      '# 章節',
      '',
      '內文。',
    ].join('\n')

    const artifact = `${OUT_DIR}/escaped.html`
    expect(runCli(['render', '-', '-o', artifact], { input: source }).code).toBe(0)
    const html = readFileSync(artifact, 'utf8')

    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toContain('<title>')
    // 標題原樣落進 <title> 會提前結束元素／注入標記
    expect(head).not.toContain('<script>')
    expect(head).toMatch(/&lt;script&gt;/)
    expect(head).toContain('&quot;')
    expect(head).toContain('&amp;')

    // 轉義過的產物仍須自洽：lint 通過、IR 保留原始字面值
    expect(runCli(['lint', artifact]).code).toBe(0)
    const ir = JSON.parse(extractIrScripts(html)[0])
    expect(ir.doc.meta.title).toContain('<script>')
  })

  it('test_render_unknown_template_is_validation_error: 未知模板 → exit 1 KSB_TEMPLATE_NOT_FOUND', () => {
    const r = runCli([
      'render',
      'fixtures/book-sample.md',
      '-t',
      'ghost/does-not-exist',
      '-o',
      `${OUT_DIR}/never.html`,
      '--json',
    ])
    expect(r.code).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors.map((e) => e.code)).toContain('KSB_TEMPLATE_NOT_FOUND')
    expect(existsSync(`${OUT_DIR}/never.html`)).toBe(false)
  })

  it('test_render_body_blocks: 每個 block 型別在 body 有可辨識輸出，且「IR 有則 body 有」', () => {
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT]).code).toBe(0)
    const html = readFileSync(ARTIFACT, 'utf8')
    const body = bodyOf(html)
    const ir = JSON.parse(extractIrScripts(html)[0])
    const blocks = collect(ir.doc)

    // fixture 必須真的覆蓋全部型別，否則這條測試會空轉
    const present = new Set(blocks.map((b) => b.type))
    for (const type of Object.keys(TYPE_MARKERS)) {
      expect(present.has(type), `fixture 應含 ${type} block`).toBe(true)
    }

    // 對稱斷言：IR 裡有的型別，body 必須有對應輸出
    for (const type of present) {
      const marker = TYPE_MARKERS[type]
      if (marker === undefined) continue
      expect(body, `${type} 在 IR 中存在，body 卻無 ${marker}`).toContain(marker)
    }

    // 逐 block 內容對稱：光有容器標籤不算，內容也要真的渲染出來
    const decoded = decode(body)
    for (const block of blocks) {
      switch (block.type) {
        case 'section':
          expect(decoded, `section 標題遺失：${block.title}`).toContain(block.title)
          expect(body, `section 應有錨點 id=${block.id}`).toContain(`id="${block.id}"`)
          break
        case 'prose':
          expect(body, `prose 內容遺失：${block.html}`).toContain(block.html)
          break
        case 'code':
          expect(decoded, `code 內容遺失：${block.text.slice(0, 30)}`).toContain(block.text)
          break
        case 'table':
          for (const cell of [...block.head, ...block.rows.flat()]) {
            expect(decoded, `table 儲存格遺失：${cell}`).toContain(cell)
          }
          break
        case 'raw':
          expect(body, `raw 島嶼內容遺失`).toContain(block.html)
          expect(body, `raw 島嶼 intent 遺失`).toContain(block.intent)
          break
        case 'callout':
          expect(body).toContain(`callout-${block.variant}`)
          break
        default:
          break
      }
    }

    // masthead 與 colophon 屬模板本體，同樣不得靜默消失
    expect(decoded).toContain(ir.doc.meta.title)
    expect(body).toContain('class="masthead"')
    expect(body).toContain('class="colophon"')
  })
})

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { runCli, outDir, extractIrScripts, repoRoot } from './helpers.js'
import { CALLOUT_VARIANTS } from '../src/core/blocks.js'

/**
 * Verbatim label text per callout variant. Deliberately re-stated here rather
 * than imported from the template: importing the template's own map would make
 * a swapped mapping agree with itself and prove nothing.
 */
const CALLOUT_LABEL_TEXT = Object.freeze({ note: 'NOTE', warn: 'WARNING' })

/** `:::<variant>` opening markers in the source Markdown (closing `:::` excluded). */
const countCalloutOpeners = (markdown) => {
  const opener = new RegExp(`^\\s*:{3,}\\s*(?:${CALLOUT_VARIANTS.join('|')})\\s*$`)
  return markdown.split('\n').filter((line) => opener.test(line)).length
}

/**
 * Renderer-agnostic guard: one `:::variant` in the source must produce exactly
 * one callout block in the IR. Matching on rendered markup instead would only
 * ever catch the leak shape it was written against — the earlier
 * `<div class="callout"` fingerprint went blind the moment the leak changed to
 * markdown-it's default bare `<div>`. Counting from the source cannot go blind.
 */
const expectCalloutSymmetry = (source, blocks) => {
  const inSource = countCalloutOpeners(source)
  const inIr = blocks.filter((b) => b.type === 'callout').length
  expect(inSource, '語料應至少含一個 callout，否則這條斷言是空轉的').toBeGreaterThan(0)
  expect(inIr, `原始 Markdown 有 ${inSource} 個 callout，IR 卻只有 ${inIr} 個`).toBe(inSource)
}

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

  // 每種清單語法各自成案：條件若窄化成只認其中一種，另一種就會靜靜退回
  // prose 路徑（callout 降格、IR 有損），而這在單一語法的測試裡看不見。
  const LIST_FLAVOURS = [
    { name: 'bullet', items: ['- 第一項', '- 第二項：', '- 第三項'] },
    { name: 'ordered', items: ['1. 第一項', '2. 第二項：', '3. 第三項'] },
  ]

  for (const flavour of LIST_FLAVOURS) {
    it(`test_render_callout_in_list_enters_block_tree: ${flavour.name} 清單內的 callout 須進 block tree 且走同一渲染路徑`, () => {
      const [first, second, third] = flavour.items
      const source = [
        '---',
        `title: ${flavour.name} 清單內的 callout`,
        '---',
        '',
        '# 章節',
        '',
        first,
        second,
        '   :::warn',
        '   清單內的警示。',
        '   :::',
        third,
      ].join('\n')

      const artifact = `${OUT_DIR}/list-callout-${flavour.name}.html`
      expect(runCli(['render', '-', '-o', artifact], { input: source }).code).toBe(0)
      const html = readFileSync(artifact, 'utf8')
      const body = bodyOf(html)
      const blocks = collect(JSON.parse(extractIrScripts(html)[0]).doc)

      // 來源 ⇔ IR 的計數對稱：與 renderer 無關，任何路徑的 callout 洩漏
      // （不論洩成 <div class="callout"> 還是 markdown-it 預設的裸 <div>）
      // 都會讓這個數字對不上。
      expectCalloutSymmetry(source, blocks)

      const callouts = blocks.filter((b) => b.type === 'callout')
      expect(callouts, `${flavour.name} 清單內的 callout 未進 block tree`).toHaveLength(1)
      expect(callouts[0].variant).toBe('warn')

      // 單一渲染路徑：標記必須就是 Callout 元件那一套（含標籤）
      expect(body).toMatch(
        /<aside class="callout callout-warn"[^>]*>\s*<span class="callout-label">WARNING<\/span>/,
      )

      // 清單本文不得遺失
      for (const text of ['第一項', '第二項', '第三項', '清單內的警示']) {
        expect(decode(body), `清單內容遺失：${text}`).toContain(text)
      }
    })
  }

  it('test_render_prose_container_is_valid_html: prose 容器不得包 block-level 內容', () => {
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT]).code).toBe(0)
    const html = readFileSync(ARTIFACT, 'utf8')
    const body = bodyOf(html)

    // <p> 不能包 flow content：瀏覽器 tree construction 會隱式關閉 p，
    // 實際 DOM 變成「空 p ＋ 脫離 .prose 樣式域的清單 ＋ 空 p」。
    for (const [, inner] of body.matchAll(/<p class="prose">([\s\S]*?)<\/p>/g)) {
      const hit = /<(ul|ol|div|pre|table|blockquote)\b/i.exec(inner)
      expect(hit, `<p class="prose"> 內出現 block-level <${hit?.[1]}>`).toBeNull()
    }

    // 無序與有序清單都必須換成 <div> 容器——容器選擇不能只認其中一種
    expect(body, '含 ul 的 prose 應以 <div class="prose"> 承載').toMatch(/<div class="prose">\s*<ul>/)
    expect(body, '含 ol 的 prose 應以 <div class="prose"> 承載').toMatch(/<div class="prose">\s*<ol>/)
    expect(decode(body)).toContain('純清單項目一')
    expect(decode(body)).toContain('純清單項目二')
    expect(decode(body)).toContain('有序項目一')

    // 純 phrasing 的散文仍應維持 <p>，不得一律改成 div
    expect(body).toMatch(/<p class="prose">/)

    // 清單必須有樣式規則，不能落回 UA 預設。選擇器後面要求 , 或 {，
    // 否則 `.prose ul-removed` 這種掏空也會被誤判為還在。
    const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
    expect(css, '.prose ul 缺少樣式規則').toMatch(/\.prose\s+ul\s*[,{]/)
    expect(css, '.prose ol 缺少樣式規則').toMatch(/\.prose\s+ol\s*[,{]/)
    expect(css, '.prose li 缺少樣式規則').toMatch(/\.prose\s+li\s*[,{]/)
    // 行高必須與 .prose 一致（1.55），不能只留個空殼選擇器
    const listRule = /\.prose\s+(?:ul|ol)\s*[,{][^}]*\}/.exec(css)?.[0] ?? ''
    expect(listRule, '清單樣式應與 .prose 同行高').toContain('1.55')
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
          // 空字串會讓下面的 containment 恆真——先擋掉「內容被清空」這種退化
          expect(block.html.length, 'prose block 的 html 不得為空').toBeGreaterThan(0)
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

    // callout：逐 variant 釘死標籤，且語料必須窮舉 CALLOUT_VARIANTS 每一項。
    // 標籤要綁在自己的容器上——只檢查「NOTE 與 WARNING 都出現過」的話，
    // 把兩個標籤對調仍然兩個都在，測不出來。
    for (const variant of CALLOUT_VARIANTS) {
      const label = CALLOUT_LABEL_TEXT[variant]
      expect(label, `CALLOUT_VARIANTS 新增了 ${variant}，測試未定義其標籤文字`).toBeDefined()

      const inCorpus = blocks.some((b) => b.type === 'callout' && b.variant === variant)
      expect(inCorpus, `fixture 語料未涵蓋 callout variant：${variant}`).toBe(true)

      const bound = new RegExp(
        `<aside class="callout callout-${variant}"[^>]*>\\s*<span class="callout-label">${label}</span>`,
      )
      expect(body, `callout-${variant} 的標籤必須是 ${label}`).toMatch(bound)
    }

    // 反向對稱：body 有 callout 標記 ⇒ IR 必有對應的 callout block。
    // 只有 IR→body 方向的話，「第二條渲染路徑」——parser 自己吐出 callout HTML、
    // IR 卻沒有那個 block——完全看不見。
    for (const variant of CALLOUT_VARIANTS) {
      const inBody = (body.match(new RegExp(`class="callout callout-${variant}"`, 'g')) ?? []).length
      const inIr = blocks.filter((b) => b.type === 'callout' && b.variant === variant).length
      expect(inBody, `callout-${variant}：body 標記數須等於 IR block 數`).toBe(inIr)
    }
    // 來源 ⇔ IR 的計數對稱：語料裡每個 `:::variant` 都必須成為一個 callout
    // block。這條與 renderer 無關，任何洩漏形都會讓數字對不上。
    expectCalloutSymmetry(readFileSync(join(repoRoot, 'fixtures/book-sample.md'), 'utf8'), blocks)

    // masthead 與 colophon 屬模板本體，同樣不得靜默消失
    expect(decoded).toContain(ir.doc.meta.title)
    expect(body).toContain('class="masthead"')
    expect(body).toContain('class="colophon"')
  })
})

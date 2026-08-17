import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, extractIrScripts, repoRoot } from './helpers.js'
import { manifest as longFormManifest } from '../templates/kami/long-form/manifest.js'
import { manifest as slidesManifest } from '../templates/kami/slides/manifest.js'

const OUT_DIR = outDir('d1')
const SAMPLE = `${repoRoot}/fixtures/diagram-sample.md`
const PROJECT = 'd1-diagram'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-17T00:00:00.000Z' }

/** CONTRACT Verbatim Constants — copied by hand, never imported from source. */
const DIAGRAM_TYPE = 'diagram'
const DIAGRAM_KIND = 'graph'
const FENCE_TAG = 'diagram'
const CODE_DIAGRAM_INVALID = 'KSB_DIAGRAM_INVALID'
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
/** 箭頭 marker id 由 block id 派生，所以同一份產物內兩張圖不會互搶箭頭。 */
const ARROW_ID_PREFIX = 'ksb-arrow-'
const normaliseArrowIds = (svg) => svg.replace(/ksb-arrow-b\d+/g, `${ARROW_ID_PREFIX}X`)

const svgOf = (html) => {
  const start = html.indexOf('<svg')
  const end = html.indexOf('</svg>')
  return start === -1 || end === -1 ? '' : html.slice(start, end + '</svg>'.length)
}

const countOf = (haystack, needle) => haystack.split(needle).length - 1

/** The diagram spec read out of the fixture, so counts are never hand-copied. */
const fixtureSpec = () => {
  const source = readFileSync(SAMPLE, 'utf8')
  const fence = new RegExp('```' + FENCE_TAG + '\\n([\\s\\S]*?)```', 'm').exec(source)
  expect(fence, `語料缺少 \`\`\`${FENCE_TAG} fence`).not.toBeNull()
  return JSON.parse(fence[1])
}

const docWith = (block) =>
  JSON.stringify({
    template: 'kami/long-form',
    doc: { type: 'doc', meta: { title: 'diagram 邊界' }, children: [block] },
  })

const renderJson = (input, name, extra = []) => {
  const inputPath = `${OUT_DIR}/${name}.json`
  writeFileSync(inputPath, input, 'utf8')
  return runCli(
    ['render', inputPath, '-o', `${OUT_DIR}/${name}.html`, '--project', PROJECT, '--json', ...extra],
    { env: PINNED },
  )
}

describe('D1/D2 diagram block v1', () => {
  let html
  let spec

  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
    spec = fixtureSpec()
    const r = runCli(['render', SAMPLE, '-o', `${OUT_DIR}/doc.html`, '--project', PROJECT], {
      env: PINNED,
    })
    expect(r.code, `render exit（stderr: ${r.stderr}）`).toBe(0)
    html = readFileSync(`${OUT_DIR}/doc.html`, 'utf8')
  })

  it('test_diagram_svg_deterministic: 節點／邊逐一落地、佈局確定性、SVG 無外部引用、lint 綠', () => {
    expect(spec.nodes.length, '語料至少要有三個節點').toBeGreaterThan(2)
    expect(spec.edges.length, '語料至少要有三條邊').toBeGreaterThan(2)

    const svg = svgOf(html)
    expect(svg, '產物內應有 inline SVG').not.toBe('')

    // 每個 node id 恰好被畫出一次
    for (const node of spec.nodes) {
      expect(
        countOf(svg, `data-node-id="${node.id}"`),
        `node ${node.id} 應恰好畫出一次`,
      ).toBe(1)
      expect(svg, `node ${node.id} 的 label 未落地`).toContain(node.label)
    }
    expect(countOf(svg, 'class="diagram-node"'), '畫出的節點數須等於 nodes[]').toBe(
      spec.nodes.length,
    )

    // 每條邊恰好被畫出一次
    for (const edge of spec.edges) {
      expect(
        countOf(svg, `data-edge-from="${edge.from}" data-edge-to="${edge.to}"`),
        `edge ${edge.from}→${edge.to} 應恰好畫出一次`,
      ).toBe(1)
    }
    expect(countOf(svg, 'class="diagram-edge"'), '畫出的邊數須等於 edges[]').toBe(
      spec.edges.length,
    )
    // 連接器是真的幾何，不是空殼
    expect(countOf(svg, '<path'), '每條邊都要有 path（外加一個箭頭 marker）').toBeGreaterThanOrEqual(
      spec.edges.length,
    )

    // SVG 內零外部引用。`xmlns` 是命名空間名而非請求目標，所以先摘掉它再判——
    // 摘掉的同時逐字確認它就是 SVG 命名空間，不是被偷換成別的 URL。
    expect(svg, 'xmlns 必須恰為 SVG 命名空間').toContain(`xmlns="${SVG_NAMESPACE}"`)
    const refs = svg.split(`xmlns="${SVG_NAMESPACE}"`).join('')
    expect(refs, 'SVG 內不得有 http 引用').not.toMatch(/http/i)
    expect(refs, 'SVG 不得含 href／xlink:href').not.toMatch(/href/i)
    expect(refs, 'SVG 不得含 src=').not.toMatch(/\bsrc\s*=/i)
    expect(refs, 'SVG 不得嵌外部 image').not.toMatch(/<image\b/i)
    // 箭頭 marker 是唯一的 url()，且只能指向同一份文件內的錨點
    for (const url of svg.match(/url\([^)]*\)/g) ?? []) {
      expect(url, 'url() 只允許同文件錨點').toMatch(/^url\(#/)
    }

    // 佈局確定性：同輸入、同 BUILD_TIME → 同位元組
    const again = `${OUT_DIR}/again.html`
    expect(
      runCli(['render', SAMPLE, '-o', again, '--project', PROJECT], { env: PINNED }).code,
    ).toBe(0)
    expect(readFileSync(again, 'utf8'), '同輸入的第二次渲染須位元組相同').toBe(html)

    expect(runCli(['lint', `${OUT_DIR}/doc.html`]).code, 'diagram 產物必須 lint 通過').toBe(0)

    // IR 層：diagram block 以結構化 spec 存活，replay 才有東西可重繪
    const ir = JSON.parse(extractIrScripts(html)[0])
    const found = JSON.stringify(ir.doc)
    expect(found, 'IR 內應留有 diagram block').toContain(`"type":"${DIAGRAM_TYPE}"`)
    expect(found, 'IR 內應留有 kind').toContain(`"kind":"${DIAGRAM_KIND}"`)
  })

  it('test_diagram_both_templates_draw_identically: 兩套模板共用同一張 SVG', () => {
    const block = {
      type: DIAGRAM_TYPE,
      kind: DIAGRAM_KIND,
      nodes: [
        { id: 'a', label: '甲' },
        { id: 'b', label: '乙' },
      ],
      edges: [{ from: 'a', to: 'b', label: '流向' }],
    }
    const docTree = {
      template: 'kami/long-form',
      doc: { type: 'doc', meta: { title: '同圖' }, children: [block] },
    }
    const deckTree = {
      template: 'kami/slides',
      doc: {
        type: 'doc',
        meta: { title: '同圖' },
        children: [{ type: 'deck', slides: [{ type: 'slide', children: [block] }] }],
      },
    }

    const docRun = renderJson(JSON.stringify(docTree), 'same-doc')
    expect(docRun.code, `long-form render exit（stderr: ${docRun.stderr}）`).toBe(0)
    const deckRun = renderJson(JSON.stringify(deckTree), 'same-deck')
    expect(deckRun.code, `slides render exit（stderr: ${deckRun.stderr}）`).toBe(0)

    const docSvg = svgOf(readFileSync(`${OUT_DIR}/same-doc.html`, 'utf8'))
    const deckSvg = svgOf(readFileSync(`${OUT_DIR}/same-deck.html`, 'utf8'))
    expect(docSvg, 'long-form 未畫出 SVG').not.toBe('')
    // 只正規化 marker id：它綁 block id，而 deck 樹多了 deck/slide 兩層，
    // 文件順序本來就不同。幾何、標記、類名一個位元都不許差。
    expect(normaliseArrowIds(deckSvg), '兩套模板必須畫出同一張 SVG').toBe(
      normaliseArrowIds(docSvg),
    )

    // 上色也必須同源：兩套 stylesheet 的 diagram 段落逐字相同
    const cssOf = (file) => {
      const html = readFileSync(file, 'utf8')
      const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
      const start = css.indexOf('.diagram {')
      return css.slice(start, css.indexOf('.diagram-edge-label', start))
    }
    const docCss = cssOf(`${OUT_DIR}/same-doc.html`)
    expect(docCss.length, 'long-form 缺 diagram 樣式').toBeGreaterThan(0)
    expect(cssOf(`${OUT_DIR}/same-deck.html`), '兩套模板的 diagram 樣式須逐字相同').toBe(docCss)
  })

  it('test_diagram_arrow_ids_are_unique: 同一份產物內兩張圖各有自己的箭頭 marker', () => {
    const graph = (suffix) => ({
      type: DIAGRAM_TYPE,
      kind: DIAGRAM_KIND,
      nodes: [
        { id: `a${suffix}`, label: `甲${suffix}` },
        { id: `b${suffix}`, label: `乙${suffix}` },
      ],
      edges: [{ from: `a${suffix}`, to: `b${suffix}` }],
    })
    const r = renderJson(
      JSON.stringify({
        template: 'kami/long-form',
        doc: { type: 'doc', meta: { title: '兩張圖' }, children: [graph('1'), graph('2')] },
      }),
      'two-diagrams',
    )
    expect(r.code, `render exit（stderr: ${r.stderr}）`).toBe(0)
    const html = readFileSync(`${OUT_DIR}/two-diagrams.html`, 'utf8')
    const ids = [...html.matchAll(/marker id="([^"]+)"/g)].map((m) => m[1])
    expect(ids, '兩張圖應各有一個 marker').toHaveLength(2)
    expect(new Set(ids).size, 'marker id 不得重複，否則第二張搶走第一張的箭頭').toBe(2)
    for (const id of ids) {
      expect(id.startsWith(ARROW_ID_PREFIX), `marker id 形不對：${id}`).toBe(true)
      expect(countOf(html, `url(#${id})`), `marker ${id} 應被自己那條邊引用`).toBe(1)
    }
  })

  it('test_diagram_in_both_manifests: diagram 入兩套模板的詞彙表', () => {
    expect(longFormManifest.blocks).toContain(DIAGRAM_TYPE)
    expect(slidesManifest.blocks).toContain(DIAGRAM_TYPE)
  })

  it('test_diagram_fence_invalid: fence 內容不是合法 JSON → exit 1 ＋ 錯誤碼 ＋ block path', () => {
    const source = `---\ntitle: 壞圖\n---\n\n\`\`\`${FENCE_TAG}\n{ "kind": "graph", nodes: [] }\n\`\`\`\n`
    const inputPath = `${OUT_DIR}/bad-fence.md`
    writeFileSync(inputPath, source, 'utf8')
    const r = runCli(['render', inputPath, '-o', `${OUT_DIR}/bad-fence.html`, '--json'], {
      env: PINNED,
    })
    expect(r.code, 'fence 內容壞掉必須 exit 1').toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors[0].code).toBe(CODE_DIAGRAM_INVALID)
    expect(out.errors[0].path, '錯誤須指到 block path').toMatch(/^doc\./)
  })

  it('test_diagram_unknown_kind: 未知 kind → exit 1 ＋ 錯誤碼 ＋ block path', () => {
    const r = renderJson(
      docWith({
        type: DIAGRAM_TYPE,
        kind: 'mindmap',
        nodes: [{ id: 'a', label: '甲' }],
        edges: [],
      }),
      'bad-kind',
    )
    expect(r.code, '未知 kind 必須 exit 1').toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.errors[0].code).toBe(CODE_DIAGRAM_INVALID)
    expect(out.errors[0].path).toMatch(/^doc\./)
    expect(out.errors[0].message, '訊息須點出未知的 kind').toContain('mindmap')
  })

  it('test_diagram_dangling_edge: 邊的端點不存在 → exit 1 ＋ 錯誤碼 ＋ 端點名', () => {
    const r = renderJson(
      docWith({
        type: DIAGRAM_TYPE,
        kind: DIAGRAM_KIND,
        nodes: [{ id: 'a', label: '甲' }],
        edges: [{ from: 'a', to: 'ghost' }],
      }),
      'dangling',
    )
    expect(r.code, '懸空端點必須 exit 1').toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.errors[0].code).toBe(CODE_DIAGRAM_INVALID)
    expect(out.errors[0].path).toMatch(/^doc\./)
    expect(out.errors[0].message, '訊息須點出懸空的端點').toContain('ghost')
  })

  it('test_diagram_duplicate_node_id: 重複 node id → exit 1（否則「恰好一次」失去意義）', () => {
    const r = renderJson(
      docWith({
        type: DIAGRAM_TYPE,
        kind: DIAGRAM_KIND,
        nodes: [
          { id: 'a', label: '甲' },
          { id: 'a', label: '甲之二' },
        ],
        edges: [],
      }),
      'dup-node',
    )
    expect(r.code, '重複 id 必須 exit 1').toBe(1)
    expect(JSON.parse(r.stdout).errors[0].code).toBe(CODE_DIAGRAM_INVALID)
  })

  it('test_diagram_empty_nodes: 空 nodes → exit 1，而不是一張空 SVG', () => {
    const r = renderJson(
      docWith({ type: DIAGRAM_TYPE, kind: DIAGRAM_KIND, nodes: [], edges: [] }),
      'empty-nodes',
    )
    expect(r.code, '空 nodes 必須 exit 1').toBe(1)
    expect(JSON.parse(r.stdout).errors[0].code).toBe(CODE_DIAGRAM_INVALID)
  })

  it('test_diagram_example_roundtrip: example diagram 的輸出餵回 render 就過', () => {
    // fence 形也必須從教材通道學得到，否則 Agent 只會用 block JSON 那條路
    const docExample = runCli(['example', 'doc'])
    expect(docExample.code).toBe(0)
    expect(docExample.stdout, 'example doc 應示範 diagram fence').toContain('```diagram\n')
    const fenceBody = new RegExp('```' + FENCE_TAG + '\\n([\\s\\S]*?)```', 'm').exec(
      docExample.stdout,
    )
    expect(() => JSON.parse(fenceBody[1]), '教材裡的 fence 內容必須是合法 JSON').not.toThrow()

    const example = runCli(['example', DIAGRAM_TYPE, '--json'])
    expect(example.code, `example exit（stderr: ${example.stderr}）`).toBe(0)
    const block = JSON.parse(JSON.parse(example.stdout).example)
    expect(block.type).toBe(DIAGRAM_TYPE)
    expect(block.kind).toBe(DIAGRAM_KIND)

    const r = renderJson(docWith(block), 'example-roundtrip')
    expect(r.code, `教材餵回 render 失敗（stderr: ${r.stderr}）`).toBe(0)
    const out = `${OUT_DIR}/example-roundtrip.html`
    expect(runCli(['lint', out]).code, '教材產物必須 lint 通過').toBe(0)
    expect(svgOf(readFileSync(out, 'utf8')), '教材必須真的畫出圖').not.toBe('')
  })

  it('test_diagram_schema_pins_fields: schema 有 diagram 分支且擋下壞 block', async () => {
    const Ajv2020Module = await import('ajv/dist/2020.js')
    const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module
    const schema = JSON.parse(runCli(['schema']).stdout)
    expect(schema.$defs.block.properties.type.enum).toContain(DIAGRAM_TYPE)
    const branch = schema.$defs.block.allOf.find(
      (b) => b.if?.properties?.type?.const === DIAGRAM_TYPE,
    )?.then
    expect(branch, 'schema 缺 diagram 分支').toBeDefined()
    expect([...branch.required].sort()).toEqual(['edges', 'kind', 'nodes'])

    const ajv = new Ajv2020({ allErrors: true, strict: false })
    const validate = ajv.compile(schema)
    const envelope = (children) => ({
      irVersion: '1',
      engine: '0.1.0',
      template: { namespace: 'kami', name: 'long-form', version: '0.1.0' },
      doc: { id: 'b1', type: 'doc', meta: { title: 't' }, children },
      createdAt: '2026-08-17T00:00:00.000Z',
      generator: 'test',
    })
    const good = {
      id: 'b2',
      type: DIAGRAM_TYPE,
      kind: DIAGRAM_KIND,
      nodes: [{ id: 'a', label: '甲' }],
      edges: [{ from: 'a', to: 'a' }],
    }
    expect(validate(envelope([good])), '合法 diagram 應過驗').toBe(true)
    expect(
      validate(envelope([{ ...good, nodes: [{ id: 'a' }] }])),
      'node 缺 label 應被擋',
    ).toBe(false)
    expect(
      validate(envelope([{ ...good, edges: [{ from: 'a' }] }])),
      'edge 缺 to 應被擋',
    ).toBe(false)
    expect(validate(envelope([{ ...good, kind: 'mindmap' }])), '未知 kind 應被擋').toBe(false)
  })
})

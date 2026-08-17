import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, extractIrScripts, repoRoot } from './helpers.js'
import { EXTERNAL_RULES } from '../src/core/lint.js'
import { liveMarkup, styleRegions } from '../src/core/scan.js'

const OUT_DIR = outDir('c4')
const SAMPLE = `${repoRoot}/fixtures/slides-sample.md`
const DECK = `${OUT_DIR}/deck.html`
const PROJECT = 'c4-deck'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-17T00:00:00.000Z' }

/** CONTRACT Verbatim Constants — copied by hand, never imported from the template. */
const SLIDE_CONTAINER = '<section class="slide">'
const DECK_TEMPLATE_ID = 'kami/slides@0.1.0'
/** 進度指示形：`{n} / {N}`（帶空格）。 */
const PROGRESS_SEPARATOR = ' / '
const progressForm = (n, total) => `${n}${PROGRESS_SEPARATOR}${total}`
/** 播放提示文字，逐字。 */
const PLAYBACK_HINT = '方向鍵／空白鍵翻頁 · F 全螢幕 · Esc 離開'

const bodyOf = (html) => html.slice(html.indexOf('<body>'), html.indexOf('<script type='))
const irOf = (html) => JSON.parse(extractIrScripts(html)[0])

/** Source segments cut by `---`, counted from the Markdown rather than the IR. */
const sourceSegments = () => {
  const source = readFileSync(SAMPLE, 'utf8')
  const content = source.replace(/^---\n[\s\S]*?\n---\n/, '')
  return content.split('\n').filter((line) => /^-{3,}\s*$/.test(line)).length + 1
}

describe('C4/C5/C6 deck 模式與播放', () => {
  let html

  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
    const r = runCli(['render', SAMPLE, '-o', DECK, '--project', PROJECT], { env: PINNED })
    expect(r.code, `render exit（stderr: ${r.stderr}）`).toBe(0)
    html = readFileSync(DECK, 'utf8')
  })

  it('test_render_deck: 每張為 <section class="slide">，張數≡`---` 分段數，首張含 title/kicker', () => {
    const body = bodyOf(html)
    const ir = irOf(html)

    const segments = sourceSegments()
    expect(segments, '語料至少要有兩段，否則切頁符沒被測到').toBeGreaterThan(1)

    // 標記層：容器逐字相符，張數對得上來源分段
    const containers = body.split(SLIDE_CONTAINER).length - 1
    expect(containers, `body 的 ${SLIDE_CONTAINER} 數須等於來源分段數`).toBe(segments)

    // IR 層：deck block tree 承載同一個張數
    const deck = ir.doc.children.find((b) => b.type === 'deck')
    expect(deck, 'doc 下應有 deck block').toBeDefined()
    expect(deck.slides, 'deck.slides 必須是陣列').toBeInstanceOf(Array)
    expect(deck.slides).toHaveLength(segments)
    for (const slide of deck.slides) {
      expect(slide.type).toBe('slide')
      expect(Array.isArray(slide.children), 'slide 必須有 children').toBe(true)
    }

    // 首張帶出 frontmatter 的 title 與 kicker；其餘張不得重複掛 masthead
    const slides = body.split(SLIDE_CONTAINER).slice(1)
    expect(slides[0]).toContain(ir.doc.meta.title)
    expect(slides[0]).toContain(ir.doc.meta.kicker)
    expect(slides[0], '首張應有 masthead').toContain('class="slide-masthead"')
    for (const later of slides.slice(1)) {
      expect(later, '只有首張帶 masthead').not.toContain('class="slide-masthead"')
    }

    // 16:9 版面基準
    const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
    expect(css, '缺少 16:9 版面基準').toMatch(/--slide-ratio:\s*16\s*\/\s*9/)
    expect(css, '.slide 未套用版面比例').toMatch(/\.slide\s*\{[^}]*aspect-ratio:\s*var\(--slide-ratio\)/)

    // 模板身分逐字
    expect(`${ir.template.namespace}/${ir.template.name}@${ir.template.version}`).toBe(
      DECK_TEMPLATE_ID,
    )
  })

  it('test_c4_hr_stays_inert_in_document_mode: 同一份內容在文件模板下 `---` 仍靜默吞掉', () => {
    const body = ['# 一', '', '甲。', '', '---', '', '# 二', '', '乙。'].join('\n')
    const asDoc = `${OUT_DIR}/as-doc.html`
    const asDeck = `${OUT_DIR}/as-deck.html`

    expect(
      runCli(['render', '-', '-o', asDoc], {
        input: ['---', 'title: 文件模式', 'template: kami/long-form', '---', '', body].join('\n'),
      }).code,
    ).toBe(0)
    expect(
      runCli(['render', '-', '-o', asDeck], {
        input: ['---', 'title: 簡報模式', 'template: kami/slides', '---', '', body].join('\n'),
      }).code,
    ).toBe(0)

    const docIr = irOf(readFileSync(asDoc, 'utf8'))
    const docBody = bodyOf(readFileSync(asDoc, 'utf8'))
    expect(docIr.doc.children.some((b) => b.type === 'deck'), '文件模式不得產生 deck').toBe(false)
    expect(docBody, '文件模式的 hr 仍應靜默吞掉').not.toContain('<hr')
    expect(docBody).not.toContain(SLIDE_CONTAINER)

    const deckIr = irOf(readFileSync(asDeck, 'utf8'))
    const deck = deckIr.doc.children.find((b) => b.type === 'deck')
    expect(deck.slides, '同一份內容在 deck 模板下應切成兩張').toHaveLength(2)
  })

  it('test_render_json_shape_deck: deck 的 --json 為四鍵＋slides:<int>；文件產物不帶此鍵', () => {
    const deckOut = JSON.parse(
      runCli(['render', SAMPLE, '-o', `${OUT_DIR}/j.html`, '--project', PROJECT, '--json'], {
        env: PINNED,
      }).stdout,
    )
    expect(Object.keys(deckOut).sort()).toEqual(['archived', 'artifact', 'bytes', 'ok', 'slides'])
    expect(deckOut.ok).toBe(true)
    expect(Number.isInteger(deckOut.slides), 'slides 必須是整數').toBe(true)
    expect(deckOut.slides).toBe(sourceSegments())
    expect(isAbsolute(deckOut.artifact)).toBe(true)

    const docOut = JSON.parse(
      runCli([
        'render',
        `${repoRoot}/fixtures/book-sample.md`,
        '-o',
        `${OUT_DIR}/doc.html`,
        '--project',
        PROJECT,
        '--json',
      ]).stdout,
    )
    expect(Object.keys(docOut).sort(), '文件產物不得帶 slides 鍵').toEqual([
      'archived',
      'artifact',
      'bytes',
      'ok',
    ])
  })

  it('test_c4_deck_formatter_shared_both_paths: slides 擴充鍵兩路同源', () => {
    // 語料的張數刻意取 7：三張的舊語料讓「3」在時戳／路徑裡到處都是，
    // 於是 toContain(String(slides)) 恆真——把整段張數輸出砍掉照樣全綠。
    // 這裡連格式一起釘（`，7 張`），數字本身也不與其他欄位撞。
    const source = ['---', 'title: 張數對帳', 'template: kami/slides', '---', '']
      .concat(Array.from({ length: 7 }, (_, i) => `# 第 ${i + 1} 頁\n\n內容。\n`).join('\n---\n\n'))
      .join('\n')
    const input = `${OUT_DIR}/seven.md`
    writeFileSync(input, source, 'utf8')

    const json = JSON.parse(
      runCli(['render', input, '-o', `${OUT_DIR}/f.html`, '--project', PROJECT, '--json'], {
        env: PINNED,
      }).stdout,
    )
    expect(json.slides, '語料應為七張').toBe(7)
    const human = runCli(['render', input, '-o', `${OUT_DIR}/f.html`, '--project', PROJECT], {
      env: PINNED,
    })
    expect(human.code).toBe(0)
    expect(human.stdout).toContain(json.artifact)
    expect(human.stdout).toContain(String(json.bytes))
    expect(human.stdout, '人類路必須逐字帶出張數').toContain(`，${json.slides} 張`)

    // 文件產物的人類路不得憑空長出張數欄位
    const docHuman = runCli([
      'render',
      `${repoRoot}/fixtures/book-sample.md`,
      '-o',
      `${OUT_DIR}/fd.html`,
      '--project',
      PROJECT,
    ])
    expect(docHuman.code).toBe(0)
    expect(docHuman.stdout).not.toMatch(/\d+ 張/)
  })

  it('test_deck_playback_offline: 內建播放 script 含鍵盤處理，零外部請求，lint exit 0', () => {
    const linted = runCli(['lint', DECK, '--json'])
    expect(linted.code, `lint exit（stderr: ${linted.stderr}）`).toBe(0)
    expect(JSON.parse(linted.stdout).errors ?? []).toEqual([])

    // 播放 script 是模板層資產：內嵌、無 src，且不是 raw 島嶼
    const scripts = [...html.matchAll(/<script(?![^>]*type=)[^>]*>([\s\S]*?)<\/script>/g)]
    expect(scripts.length, '產物應恰含一段內建播放 script').toBe(1)
    const playback = scripts[0][1]
    expect(scripts[0][0], '播放 script 不得帶 src').not.toMatch(/\bsrc\s*=/)

    // 合約釘死的四組鍵
    for (const key of ['ArrowRight', 'ArrowLeft', 'Escape']) {
      expect(playback, `播放 script 缺少 ${key} 處理`).toContain(key)
    }
    expect(playback, '播放 script 缺少空白鍵處理').toMatch(/=== ' '/)
    // Verbatim：f=全螢幕（大小寫皆收）
    expect(playback, '播放 script 缺少小寫 f 全螢幕處理').toContain("=== 'f'")
    expect(playback, '播放 script 缺少大寫 F 全螢幕處理').toContain("=== 'F'")
    expect(playback, '播放 script 缺少 keydown 綁定').toContain("addEventListener('keydown'")
    expect(playback, '播放 script 缺少全螢幕呼叫').toContain('requestFullscreen')
    expect(playback, '播放 script 缺少離開全螢幕呼叫').toContain('exitFullscreen')

    // 進度指示形錨在合約字面（`{n} / {N}`，帶空格）：伺服器端先渲染首張，JS 再更新
    const body = bodyOf(html)
    const total = irOf(html).doc.children.find((b) => b.type === 'deck').slides.length
    expect(body, `進度指示須為合約字面 ${progressForm('{n}', '{N}')}`).toContain(
      `class="deck-progress">${progressForm(1, total)}<`,
    )
    expect(playback, '播放 script 未更新進度指示').toContain('deck-progress')
    expect(playback, '播放 script 的進度分隔符須與合約字面同形').toContain(
      `'${PROGRESS_SEPARATOR}'`,
    )

    // 播放提示文字逐字釘死：這串是使用者唯一看得到的操作說明，改一個字就沒人知道怎麼翻頁
    expect(body, '播放提示文字與合約字面不符').toContain(
      `class="deck-hint">${PLAYBACK_HINT}<`,
    )

    // 島嶼掃描不得誤殺：播放 script 不在任何 .island 容器內
    const islands = [...body.matchAll(/<(div|figure) class="island"[\s\S]*?<\/\1>/g)].map((m) => m[0])
    for (const island of islands) {
      expect(island, '島嶼內不得出現 script（SPEC §11）').not.toContain('<script')
    }

    // A3 的禁形掃描沿用同一組規則，deck 產物照樣零外部請求
    const regions = { markup: liveMarkup(html), css: styleRegions(html) }
    const hits = EXTERNAL_RULES.filter(({ re, scope }) => re.test(regions[scope])).map((r) => r.what)
    expect(hits).toEqual([])
  })

  it('test_c6_deck_replay_byte_identical: deck 產物 replay 逐位元相同且 IR 仍帶 deck tree', () => {
    const replayed = `${OUT_DIR}/replayed.html`
    const r = runCli(['replay', DECK, '-o', replayed, '--project', PROJECT, '--json'], {
      env: PINNED,
    })
    expect(r.code, `replay exit（stderr: ${r.stderr}）`).toBe(0)

    const out = JSON.parse(r.stdout)
    expect(Object.keys(out).sort()).toEqual(['archived', 'artifact', 'bytes', 'ok', 'slides'])
    expect(out.slides, 'replay 的張數必須由內嵌 IR 推出').toBe(sourceSegments())

    expect(readFileSync(replayed).equals(readFileSync(DECK)), 'replay 須逐位元相同').toBe(true)

    const replayedIr = irOf(readFileSync(replayed, 'utf8'))
    const deck = replayedIr.doc.children.find((b) => b.type === 'deck')
    expect(deck, 'replay 後的 IR 仍須帶 deck block tree').toBeDefined()
    expect(deck.slides).toHaveLength(sourceSegments())
    expect(runCli(['lint', replayed]).code).toBe(0)
  })
})

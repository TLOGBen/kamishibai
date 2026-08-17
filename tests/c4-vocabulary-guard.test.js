import { readFileSync, rmSync, existsSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, extractIrScripts, repoRoot } from './helpers.js'

const OUT_DIR = outDir('c4g')
const DECK_SRC = `${repoRoot}/fixtures/slides-sample.md`
const DOC_SRC = `${repoRoot}/fixtures/book-sample.md`
const DECK = `${OUT_DIR}/deck.html`
const DOC = `${OUT_DIR}/doc.html`
const PROJECT = 'c4g-guard'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-17T00:00:00.000Z' }

/** CONTRACT C4 — the code a vocabulary violation must carry, verbatim. */
const GUARD_CODE = 'KSB_TEMPLATE_BLOCK_UNSUPPORTED'

const bodyOf = (html) => html.slice(html.indexOf('<body>'), html.indexOf('<script type='))

describe('C4 manifest.blocks 守衛（F1）', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    expect(runCli(['render', DECK_SRC, '-o', DECK, '--project', PROJECT], { env: PINNED }).code)
      .toBe(0)
    expect(runCli(['render', DOC_SRC, '-o', DOC, '--project', PROJECT], { env: PINNED }).code)
      .toBe(0)
  })

  it('test_c4_cross_family_replay_is_rejected: deck tree 換長文模板 → exit 1 帶 KSB_ 碼，不得靜默濾除', () => {
    const target = `${OUT_DIR}/cross-replay.html`
    const r = runCli(['replay', DECK, '-t', 'kami/long-form', '-o', target, '--json'])

    // 靜默濾除的病徵：exit 0、內容全滅、slides 照報。任何一項復發這條就紅。
    expect(r.code, `跨家族 replay 必須 exit 1（實得 ${r.code}）`).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors.map((e) => e.code)).toContain(GUARD_CODE)
    expect(out.slides, '失敗路不得回報張數').toBeUndefined()

    // 診斷必須指出是哪個型別、哪個模板，並帶 block path——Agent 靠它定位
    const finding = out.errors.find((e) => e.code === GUARD_CODE)
    expect(finding.message).toContain('deck')
    expect(finding.message).toContain('kami/long-form')
    expect(finding.path.length).toBeGreaterThan(0)

    // 半成品不得落地：擋下的呼叫連檔案都不該寫出來
    expect(existsSync(target), '被擋下的 replay 不得留下產物').toBe(false)
  })

  it('test_c4_cross_family_render_is_rejected: block tree JSON 指定不相容模板 → exit 1', () => {
    const tree = JSON.stringify({
      template: 'kami/long-form',
      doc: {
        type: 'doc',
        meta: { title: '餵錯模板的 deck tree' },
        children: [
          {
            type: 'deck',
            slides: [{ type: 'slide', children: [{ type: 'prose', html: '第一張。' }] }],
          },
        ],
      },
    })
    const target = `${OUT_DIR}/cross-render.html`
    const r = runCli(['render', '-', '-o', target, '--json'], { input: tree })
    expect(r.code).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors.map((e) => e.code)).toContain(GUARD_CODE)
    expect(existsSync(target)).toBe(false)

  })

  /**
   * F6 —— F1 的鏡像。型別檢查對這個方向天生失明：slides 詞彙表**必須**宣告整套
   * 長文型別（prose/list/table… 都是 slide 內的合法子 block），所以 doc 形樹的
   * 每一個型別都在表內、檢查全過，而 SlidesDeck 只畫 `deck.slides`——內容全滅、
   * 進度自打臉地顯示 `1 / 0`、exit 0、lint 0。守衛因此必須同時看**根形**。
   */
  it('test_c4_doc_tree_into_slides_is_rejected: doc 形樹餵簡報模板 → exit 1，不得畫出 1 / 0 空殼', () => {
    const flat = JSON.stringify({
      template: 'kami/slides',
      doc: {
        type: 'doc',
        meta: { title: '沒有 deck 的 slides 產物' },
        children: [
          { type: 'section', title: '一章', level: 1, children: [] },
          { type: 'prose', html: '一段話。' },
        ],
      },
    })
    const flatTarget = `${OUT_DIR}/flat-slides.html`
    const r = runCli(['render', '-', '-o', flatTarget, '--json'], { input: flat })

    expect(r.code, `doc 形樹餵 slides 必須 exit 1（實得 ${r.code}）`).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors.map((e) => e.code)).toContain(GUARD_CODE)
    expect(out.slides, '失敗路不得回報張數').toBeUndefined()
    expect(existsSync(flatTarget), '被擋下的 render 不得留下 1 / 0 空殼').toBe(false)

    // 診斷必須說清楚是「根形不符」，而不是含混地報某個型別不支援
    const finding = out.errors.find((e) => e.code === GUARD_CODE)
    expect(finding.message, '診斷須指出此模板需要的根形').toContain('deck')
    expect(finding.message, '診斷須指出收到的根形').toContain('doc')
    expect(finding.message, '診斷須點明這是文體轉換而非換皮').toContain('文體轉換')
    expect(finding.path.length).toBeGreaterThan(0)
  })

  it('test_c4_doc_artifact_replayed_as_slides_is_rejected: 書產物 replay -t kami/slides → exit 1', () => {
    const target = `${OUT_DIR}/doc-as-slides.html`
    const r = runCli(['replay', DOC, '-t', 'kami/slides', '-o', target, '--json'])
    expect(r.code, `書轉簡報必須 exit 1（實得 ${r.code}）`).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.errors.map((e) => e.code)).toContain(GUARD_CODE)
    expect(out.slides).toBeUndefined()
    expect(existsSync(target)).toBe(false)
  })

  it('test_c4_markdown_entry_into_slides_still_green: `-t kami/slides` 走 Markdown 入口照樣切頁成綠', () => {
    // 這條是守衛的邊界：Markdown 入口在 parse 時就把 `---` 編成 deck，
    // 根形本來就對。守衛若寫成「一律拒絕 -t kami/slides」就會在這裡紅。
    const source = ['# 一', '', '甲。', '', '---', '', '# 二', '', '乙。'].join('\n')
    const target = `${OUT_DIR}/md-entry.html`
    const r = runCli(['render', '-', '-t', 'kami/slides', '-o', target, '--json'], {
      input: `---\ntitle: 以旗標指定簡報\n---\n\n${source}`,
    })
    expect(r.code, `render exit（stderr: ${r.stderr}）`).toBe(0)
    expect(JSON.parse(r.stdout).slides, '旗標入口也必須切頁').toBe(2)
    expect(runCli(['lint', target]).code).toBe(0)
  })

  it('test_c4_same_family_replay_still_green: 同家族 replay 照綠，守衛不得誤殺', () => {
    for (const [source, template] of [
      [DECK, 'kami/slides'],
      [DOC, 'kami/long-form'],
    ]) {
      const target = `${OUT_DIR}/same-${template.split('/')[1]}.html`
      const r = runCli(
        ['replay', source, '-t', template, '-o', target, '--project', PROJECT, '--json'],
        { env: PINNED },
      )
      expect(r.code, `${template} replay exit（stderr: ${r.stderr}）`).toBe(0)
      expect(readFileSync(target).equals(readFileSync(source)), '同家族 replay 須逐位元相同').toBe(
        true,
      )
    }

    // 隱式模板（不帶 -t）同樣不受守衛影響
    const implicit = `${OUT_DIR}/implicit.html`
    expect(
      runCli(['replay', DECK, '-o', implicit, '--project', PROJECT], { env: PINNED }).code,
    ).toBe(0)
    expect(readFileSync(implicit).equals(readFileSync(DECK))).toBe(true)
  })

  it('test_c4_guard_covers_every_declared_vocabulary: 兩個出廠模板的詞彙表都真的被用到', async () => {
    const longForm = (await import('../templates/kami/long-form/manifest.js')).manifest
    const slides = (await import('../templates/kami/slides/manifest.js')).manifest

    // 守衛的前提是宣告完整：長文模板必須宣告 book 語料實際用到的每個型別
    const types = new Set()
    const walk = (node) => {
      types.add(node.type)
      for (const c of node.children ?? []) walk(c)
      for (const s of node.slides ?? []) walk(s)
      for (const item of node.items ?? []) item.forEach(walk)
    }
    walk(JSON.parse(extractIrScripts(readFileSync(DOC, 'utf8'))[0]).doc)
    expect([...types].filter((t) => !longForm.blocks.includes(t)), '長文模板宣告不全').toEqual([])
    expect(types.has('list'), 'book 語料應含 list').toBe(true)

    const deckTypes = new Set()
    const deckWalk = (node) => {
      deckTypes.add(node.type)
      for (const c of node.children ?? []) deckWalk(c)
      for (const s of node.slides ?? []) deckWalk(s)
      for (const item of node.items ?? []) item.forEach(deckWalk)
    }
    deckWalk(JSON.parse(extractIrScripts(readFileSync(DECK, 'utf8'))[0]).doc)
    expect([...deckTypes].filter((t) => !slides.blocks.includes(t)), '簡報模板宣告不全').toEqual([])
    expect(deckTypes.has('deck') && deckTypes.has('slide'), 'deck 語料應含 deck/slide').toBe(true)

    // 長文模板不得宣告 deck/slide——否則 F1 的守衛在最重要的那一格是空的
    expect(longForm.blocks).not.toContain('deck')
    expect(longForm.blocks).not.toContain('slide')

    // 根形宣告是 F6 守衛的唯一資料來源：簡報模板必須要求 deck 根，
    // 長文模板必須不要求（否則書就渲染不出來）。
    expect(slides.root, '簡報模板必須宣告 deck 根形').toBe('deck')
    expect(longForm.root ?? null, '長文模板不得要求特定根形').toBeNull()
    // 簡報模板確實宣告了整套長文詞彙——這正是型別檢查對 F6 失明的原因，
    // 也是根形檢查不可被型別檢查取代的證據。
    for (const type of longForm.blocks) {
      expect(slides.blocks, `簡報模板應宣告 slide 內合法子型別 ${type}`).toContain(type)
    }

    // 守衛擋掉的產物不得留下空殼內容（回歸病徵本身）
    const body = bodyOf(readFileSync(DECK, 'utf8'))
    expect(body).toContain('<section class="slide">')
  })
})

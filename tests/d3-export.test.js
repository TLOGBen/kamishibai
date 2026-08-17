import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, repoRoot, testHome } from './helpers.js'

const OUT_DIR = outDir('d3')
const DOC_SOURCE = `${repoRoot}/fixtures/diagram-sample.md`
const DECK_SOURCE = `${repoRoot}/fixtures/slides-sample.md`
const DOC = `${OUT_DIR}/doc.html`
const DECK = `${OUT_DIR}/deck.html`
const PROJECT = 'd3-export'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-17T00:00:00.000Z' }

/** Browser work is slow by nature; every such test says so out loud. */
const BROWSER_TIMEOUT = 180_000

/** CONTRACT Verbatim Constants — copied by hand, never imported from source. */
const SETUP_COMMAND = 'npx playwright install chromium'
/** 主指示句裡的形（反引號括住），與下面的 WSL 包裝形是兩個不同的斷言點。 */
const SETUP_COMMAND_QUOTED = `\`${SETUP_COMMAND}\``
const SETUP_SHELL_HINT = `zsh -lic '${SETUP_COMMAND}'`
const BROWSER_CACHE_DIR = '~/.cache/ms-playwright'
const CODE_BROWSER_MISSING = 'KSB_BROWSER_MISSING'
const CODE_FORMAT_MISMATCH = 'KSB_EXPORT_FORMAT_MISMATCH'
const CODE_USAGE = 'KSB_USAGE'
const PDF_MAGIC = '%PDF-'
const ZIP_MAGIC = 'PK'
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const BROWSER_STATES = ['present', 'installed', 'missing']

/**
 * The gate is the CLI's own answer, taken once per file: `setup --dry-run`
 * launches a browser and reports what it found, so the tests below never guess
 * at availability from a path on disk.
 */
const gate = JSON.parse(runCli(['setup', '--dry-run', '--json'], { env: PINNED }).stdout)
const hasBrowser = gate.browser === 'present'

/** Every `ppt/slides/slideN.xml` entry named in the PPTX zip directory. */
const pptxSlideNumbers = (file) => {
  const raw = readFileSync(file).toString('latin1')
  return new Set([...raw.matchAll(/ppt\/slides\/slide(\d+)\.xml/g)].map((m) => Number(m[1])))
}

const deckSlideCount = () => {
  const source = readFileSync(DECK_SOURCE, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '')
  return source.split('\n').filter((line) => /^-{3,}\s*$/.test(line)).length + 1
}

describe('D3/D4/D5 export chains、snapshot、瀏覽器誠實性', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
    for (const [source, out] of [
      [DOC_SOURCE, DOC],
      [DECK_SOURCE, DECK],
    ]) {
      const r = runCli(['render', source, '-o', out, '--project', PROJECT], { env: PINNED })
      expect(r.code, `render ${source} exit（stderr: ${r.stderr}）`).toBe(0)
    }
  })

  it('test_export_browser_gate_is_loud: 缺瀏覽器不得靜默——理由與安裝指令都在斷言裡', () => {
    expect(gate.ok, 'setup --dry-run 應成功回報狀態').toBe(true)
    expect(gate.command, '安裝指令必須逐字等於合約常數').toBe(SETUP_COMMAND)
    expect(BROWSER_STATES, `未知的瀏覽器狀態 ${gate.browser}`).toContain(gate.browser)
    // 缺席就紅，而且紅在這一行：下面整組 export／snapshot 測試會被跳過，
    // 「跳過」本身必須有具名理由，不能讓缺席看起來像通過。
    expect(
      gate.browser,
      `[跳過原因] 本機沒有可用瀏覽器，export／snapshot 全組未執行。` +
        `請先執行 \`${SETUP_COMMAND}\`（二進位檔落在 ${BROWSER_CACHE_DIR}，可丟棄的快取）`,
    ).toBe('present')
  })

  it('test_export_requires_browser: 瀏覽器缺席 → exit 1、KSB_ 碼、訊息含安裝指令逐字', () => {
    const emptyCache = mkdtempSync(join(tmpdir(), 'kamishibai-no-browser-'))
    const env = { ...PINNED, PLAYWRIGHT_BROWSERS_PATH: emptyCache }
    const cases = [
      ['export', DOC, '--to', 'pdf', '-o', `${OUT_DIR}/nope.pdf`, '--json'],
      ['snapshot', DOC, '-o', `${OUT_DIR}/nope.png`, '--json'],
    ]
    for (const args of cases) {
      const r = runCli(args, { env })
      expect(r.code, `[${args[0]}] 缺瀏覽器必須 exit 1`).toBe(1)
      const out = JSON.parse(r.stdout)
      expect(out.ok).toBe(false)
      expect(out.errors, `[${args[0]}] 應恰好一個錯誤`).toHaveLength(1)
      expect(out.errors[0].code).toBe(CODE_BROWSER_MISSING)
      expect(out.errors[0].message, '訊息必須含安裝指令逐字').toContain(SETUP_COMMAND)
      // 兩個位置分別斷言：主指示句與 WSL＋nvm 包裝形。少掉任一個，
      // 使用者拿到的就是一句「請安裝瀏覽器」而不是可貼上就跑的指令。
      expect(out.errors[0].message, '訊息缺少主指示句的安裝指令').toContain(
        SETUP_COMMAND_QUOTED,
      )
      expect(out.errors[0].message, '訊息缺少 WSL＋nvm 的 zsh -lic 包裝形').toContain(
        SETUP_SHELL_HINT,
      )
      expect(out.errors[0].message, '訊息應指出快取位置').toContain(BROWSER_CACHE_DIR)
      expect(existsSync(`${OUT_DIR}/nope.pdf`), '失敗不得留下半成品').toBe(false)
      expect(existsSync(`${OUT_DIR}/nope.png`), '失敗不得留下半成品').toBe(false)
    }
    rmSync(emptyCache, { recursive: true, force: true })
  }, BROWSER_TIMEOUT)

  it('test_export_format_mismatch: 格式與根形配錯 → exit 1 ＋ KSB_ 碼（且不啟瀏覽器）', () => {
    const cases = [
      { args: ['export', DECK, '--to', 'pdf', '--json'], why: 'deck 不能出 pdf' },
      { args: ['export', DOC, '--to', 'pptx', '--json'], why: 'document 不能出 pptx' },
    ]
    for (const { args, why } of cases) {
      const r = runCli(args, { env: PINNED })
      expect(r.code, `${why}：應 exit 1`).toBe(1)
      const out = JSON.parse(r.stdout)
      expect(out.ok).toBe(false)
      expect(out.errors[0].code, why).toBe(CODE_FORMAT_MISMATCH)
    }
  })

  it('test_export_rejects_unknown_format: --to 不在 pdf|pptx → exit 2 usage 類', () => {
    const r = runCli(['export', DOC, '--to', 'docx', '--json'], { env: PINNED })
    expect(r.code, '未知格式屬 usage 類，exit 2').toBe(2)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors[0].code).toBe(CODE_USAGE)

    const missing = runCli(['export', DOC, '--json'], { env: PINNED })
    expect(missing.code, '缺 --to 也是 usage 類').toBe(2)
    expect(JSON.parse(missing.stdout).errors[0].code).toMatch(/^KSB_/)
  })

  it.skipIf(!hasBrowser)(
    'test_export_json_shape: export --json 恰為 ok/artifact/format 三鍵，pptx 張數等於 deck 張數',
    async () => {
      const out = `${OUT_DIR}/deck.pptx`
      const r = runCli(['export', DECK, '--to', 'pptx', '-o', out, '--json'], { env: PINNED })
      expect(r.code, `export exit（stderr: ${r.stderr}）`).toBe(0)

      const json = JSON.parse(r.stdout)
      expect(Object.keys(json).sort(), 'export --json 的鍵集被釘住').toEqual([
        'artifact',
        'format',
        'ok',
      ])
      expect(json.ok).toBe(true)
      expect(json.format).toBe('pptx')
      expect(isAbsolute(json.artifact), 'artifact 必須是絕對路徑').toBe(true)
      expect(json.artifact).toBe(out)

      const bytes = readFileSync(out)
      expect(bytes.subarray(0, 2).toString('latin1'), 'pptx 必須是 zip 容器').toBe(ZIP_MAGIC)
      const slides = pptxSlideNumbers(out)
      expect(slides.size, 'pptx 的張數須等於 deck 的張數').toBe(deckSlideCount())
      expect([...slides].sort((a, b) => a - b), '張號應自 1 連號').toEqual(
        Array.from({ length: deckSlideCount() }, (_, i) => i + 1),
      )
    },
    BROWSER_TIMEOUT,
  )

  it.skipIf(!hasBrowser)(
    'test_export_pdf_document: document → pdf 有 magic bytes 且頁數非零',
    async () => {
      const out = `${OUT_DIR}/doc.pdf`
      const r = runCli(['export', DOC, '--to', 'pdf', '-o', out, '--json'], { env: PINNED })
      expect(r.code, `export exit（stderr: ${r.stderr}）`).toBe(0)
      expect(JSON.parse(r.stdout).format).toBe('pdf')

      const bytes = readFileSync(out)
      expect(bytes.subarray(0, PDF_MAGIC.length).toString('latin1')).toBe(PDF_MAGIC)
      expect(bytes.length, 'PDF 不該是空殼').toBeGreaterThan(1000)
      const raw = bytes.toString('latin1')
      expect(raw, 'PDF 至少要有一頁物件').toMatch(/\/Type\s*\/Page[^s]/)
      expect(raw.endsWith('%%EOF\n') || raw.includes('%%EOF'), 'PDF 應有結尾標記').toBe(true)
    },
    BROWSER_TIMEOUT,
  )

  it.skipIf(!hasBrowser)(
    'test_snapshot_json_shape: snapshot --json 恰為 ok/artifact/width/height，尺寸讀自 PNG 標頭',
    async () => {
      const out = `${OUT_DIR}/doc.png`
      const r = runCli(['snapshot', DOC, '-o', out, '--json'], { env: PINNED })
      expect(r.code, `snapshot exit（stderr: ${r.stderr}）`).toBe(0)

      const json = JSON.parse(r.stdout)
      expect(Object.keys(json).sort(), 'snapshot --json 的鍵集被釘住').toEqual([
        'artifact',
        'height',
        'ok',
        'width',
      ])
      expect(json.ok).toBe(true)
      expect(json.artifact).toBe(out)
      expect(Number.isInteger(json.width) && json.width > 0, 'width 須為正整數').toBe(true)
      expect(Number.isInteger(json.height) && json.height > 0, 'height 須為正整數').toBe(true)

      const bytes = readFileSync(out)
      expect(bytes.subarray(0, 8).equals(PNG_MAGIC), 'PNG magic bytes').toBe(true)
      // 回報的尺寸必須就是檔案裡的尺寸，不是「要求的尺寸」
      expect(bytes.readUInt32BE(16), 'width 應讀自 IHDR').toBe(json.width)
      expect(bytes.readUInt32BE(20), 'height 應讀自 IHDR').toBe(json.height)
    },
    BROWSER_TIMEOUT,
  )

  it.skipIf(!hasBrowser)(
    'test_snapshot_deck_slide_selection: deck 預設截第 1 張，--slide N 真的換張',
    async () => {
      const first = `${OUT_DIR}/deck-default.png`
      const explicitFirst = `${OUT_DIR}/deck-1.png`
      const second = `${OUT_DIR}/deck-2.png`
      for (const [out, extra] of [
        [first, []],
        [explicitFirst, ['--slide', '1']],
        [second, ['--slide', '2']],
      ]) {
        const r = runCli(['snapshot', DECK, '-o', out, ...extra, '--json'], { env: PINNED })
        expect(r.code, `snapshot ${extra.join(' ')} exit（stderr: ${r.stderr}）`).toBe(0)
      }

      expect(deckSlideCount(), '語料至少要有兩張，否則選張沒被測到').toBeGreaterThan(1)
      const bytesOf = (f) => readFileSync(f)
      expect(bytesOf(first).equals(bytesOf(explicitFirst)), '預設就是第 1 張').toBe(true)
      expect(bytesOf(second).equals(bytesOf(first)), '--slide 2 必須是另一張').toBe(false)

      const tooFar = runCli(
        ['snapshot', DECK, '-o', `${OUT_DIR}/deck-999.png`, '--slide', '999', '--json'],
        { env: PINNED },
      )
      expect(tooFar.code, '越界的 --slide 屬 usage 類').toBe(2)
      expect(JSON.parse(tooFar.stdout).errors[0].code).toBe(CODE_USAGE)

      const notANumber = runCli(
        ['snapshot', DECK, '-o', `${OUT_DIR}/deck-x.png`, '--slide', 'abc', '--json'],
        { env: PINNED },
      )
      expect(notANumber.code, '非整數的 --slide 屬 usage 類').toBe(2)
      expect(JSON.parse(notANumber.stdout).errors[0].code).toBe(CODE_USAGE)
    },
    BROWSER_TIMEOUT,
  )

  it('test_export_uses_the_print_form: 匯出走模板自己定義的列印形（播放 chrome 不入畫）', () => {
    // 這是兩半的宣稱，兩半都要釘：模板說列印時藏 chrome，匯出層說它要列印形。
    // 少了任一半，每張投影片底部都會壓上一條固定定位的播放列。
    const css = readFileSync(`${repoRoot}/templates/kami/slides/styles.css`, 'utf8')
    const printBlock = css.slice(css.indexOf('@media print'))
    expect(printBlock, '列印形必須藏掉播放 chrome').toMatch(
      /\.deck-chrome\s*\{[^}]*display:\s*none/,
    )
    const browserLayer = readFileSync(`${repoRoot}/src/export/browser.js`, 'utf8')
    expect(browserLayer, '匯出層必須切到列印形').toContain("emulateMedia({ media: 'print' })")
  })

  it.skipIf(!hasBrowser)(
    'test_snapshot_slide_flag_rejected_on_document: document 產物用 --slide 是 usage 錯',
    async () => {
      const r = runCli(
        ['snapshot', DOC, '-o', `${OUT_DIR}/doc-slide.png`, '--slide', '1', '--json'],
        { env: PINNED },
      )
      expect(r.code).toBe(2)
      expect(JSON.parse(r.stdout).errors[0].code).toBe(CODE_USAGE)
    },
    BROWSER_TIMEOUT,
  )

  it('test_setup_reports_store_and_browser: setup 回報儲存庫與瀏覽器，--dry-run 不寫任何東西', () => {
    const probeHome = join(testHome, 'setup-dry-run-home')
    rmSync(probeHome, { recursive: true, force: true })
    const dry = runCli(['setup', '--dry-run', '--json'], {
      env: { ...PINNED, KAMISHIBAI_HOME: probeHome },
    })
    expect(dry.code, `setup --dry-run exit（stderr: ${dry.stderr}）`).toBe(0)
    const out = JSON.parse(dry.stdout)
    expect(Object.keys(out).sort()).toEqual(['browser', 'command', 'home', 'ok'])
    expect(out.home).toBe(probeHome)
    expect(out.command).toBe(SETUP_COMMAND)
    expect(existsSync(probeHome), '--dry-run 不得建立儲存庫').toBe(false)

    // 人讀路與 JSON 路同源：三個欄位都要出現在人讀輸出裡
    const human = runCli(['setup', '--dry-run'], { env: { ...PINNED, KAMISHIBAI_HOME: probeHome } })
    expect(human.code).toBe(0)
    expect(human.stdout).toContain(probeHome)
    expect(human.stdout).toContain(out.browser)
    expect(human.stdout).toContain(SETUP_COMMAND)
  }, BROWSER_TIMEOUT)

  it.skipIf(!hasBrowser)(
    'test_setup_creates_store_root: 非 dry-run 的 setup 會建中央儲存庫，瀏覽器已在則不重裝',
    async () => {
      const realHome = join(testHome, 'setup-real-home')
      rmSync(realHome, { recursive: true, force: true })
      const r = runCli(['setup', '--json'], { env: { ...PINNED, KAMISHIBAI_HOME: realHome } })
      expect(r.code, `setup exit（stderr: ${r.stderr}）`).toBe(0)
      const out = JSON.parse(r.stdout)
      expect(out.home).toBe(realHome)
      expect(out.browser, '瀏覽器已在時不得回報 installed').toBe('present')
      expect(existsSync(realHome), 'setup 應建立儲存庫根').toBe(true)
      expect(existsSync(join(realHome, 'created-by')), 'setup 應寫下建立標記').toBe(true)
    },
    BROWSER_TIMEOUT,
  )
})

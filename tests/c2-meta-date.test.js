import { readFileSync, rmSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, extractIrScripts } from './helpers.js'

const OUT_DIR = outDir('c2')
const DATE = '2026-08-17'

/** Two frontmatter spellings of the same date; YAML resolves them differently. */
const FORMS = Object.freeze([
  { name: 'bare', line: `date: ${DATE}` },
  { name: 'quoted', line: `date: '${DATE}'` },
])

const sourceWith = (line) =>
  ['---', 'title: 日期正規形', line, '---', '', '# 章節', '', '內文。'].join('\n')

const metaOf = (path) => JSON.parse(extractIrScripts(readFileSync(path, 'utf8'))[0]).doc.meta

describe('C2 frontmatter date 正規形', () => {
  beforeAll(() => rmSync(OUT_DIR, { recursive: true, force: true }))

  it('test_meta_date_normalised: 裸 date 與引號版產出相同 meta，皆為 YYYY-MM-DD', () => {
    const metas = FORMS.map(({ name, line }) => {
      const artifact = `${OUT_DIR}/${name}.html`
      const r = runCli(['render', '-', '-o', artifact], { input: sourceWith(line) })
      expect(r.code, `${name} render exit（stderr: ${r.stderr}）`).toBe(0)
      return metaOf(artifact)
    })

    for (const [index, meta] of metas.entries()) {
      // 裸 date 曾被 gray-matter 解析成 Date 物件後靜默丟棄——欄位整個不見
      expect(meta.date, `${FORMS[index].name} 的 date 未進 meta`).toBeDefined()
      expect(typeof meta.date, `${FORMS[index].name} 的 date 必須是字串`).toBe('string')
      expect(meta.date, `${FORMS[index].name} 的 date 非正規形`).toBe(DATE)
      expect(meta.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }

    // 兩形整份 meta 相同，不只是 date 這一欄
    expect(metas[0]).toEqual(metas[1])
  })

  it('test_c2_date_reaches_the_rendered_byline: 正規化後的日期真的出現在版面上', () => {
    const artifact = `${OUT_DIR}/byline.html`
    const source = [
      '---',
      'title: 日期上版',
      'author: vakarve',
      `date: ${DATE}`,
      '---',
      '',
      '# 章節',
      '',
      '內文。',
    ].join('\n')
    expect(runCli(['render', '-', '-o', artifact], { input: source }).code).toBe(0)

    const html = readFileSync(artifact, 'utf8')
    const body = html.slice(html.indexOf('<body>'), html.indexOf('<script type='))
    expect(body, 'byline 應帶出日期').toContain(DATE)
    // 只進 IR、沒進版面，等於使用者仍然看不到日期
    expect(body).toMatch(new RegExp(`class="byline"[^>]*>[^<]*${DATE}`))
  })

  /**
   * F5：`toISOString().slice(0,10)` 是 UTC 切片，會把帶時區偏移的凌晨往前推一天。
   * datetime 形以**本地日曆欄位**取日；date-only 形（YAML 一律解成 UTC 午夜）以
   * UTC 日曆取日，否則負偏移機器上連 `date: 2026-08-17` 都會少一天。
   * 兩條分支各自釘死，且都以 TZ 明示——不靠跑測試那台機器剛好在哪個時區。
   */
  it('test_c2_datetime_uses_local_calendar_day: 帶偏移的凌晨不得跨日退位', () => {
    const line = 'date: 2026-08-18 01:00:00 +08:00'
    const cases = [
      { tz: 'Asia/Taipei', expected: '2026-08-18' },
      { tz: 'UTC', expected: '2026-08-17' },
    ]
    for (const { tz, expected } of cases) {
      const artifact = `${OUT_DIR}/dt-${tz.replace(/\//g, '-')}.html`
      const r = runCli(['render', '-', '-o', artifact], {
        input: sourceWith(line),
        env: { TZ: tz },
      })
      expect(r.code, `TZ=${tz} render exit（stderr: ${r.stderr}）`).toBe(0)
      const meta = metaOf(artifact)
      expect(meta.date, `TZ=${tz} 應以本地日曆取日`).toBe(expected)
      expect(meta.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('test_c2_date_only_is_timezone_stable: date-only 形在任何時區都是同一天', () => {
    const zones = ['Asia/Taipei', 'UTC', 'America/New_York', 'Pacific/Kiritimati']
    for (const tz of zones) {
      const artifact = `${OUT_DIR}/only-${tz.replace(/\//g, '-')}.html`
      const r = runCli(['render', '-', '-o', artifact], {
        input: sourceWith(`date: ${DATE}`),
        env: { TZ: tz },
      })
      expect(r.code, `TZ=${tz} render exit（stderr: ${r.stderr}）`).toBe(0)
      expect(metaOf(artifact).date, `TZ=${tz} 的 date-only 不得漂移`).toBe(DATE)
    }
  })

  it('test_c2_invalid_date_object_is_dropped_not_crashed: 無效日期不得炸開也不得寫進 meta', () => {
    const artifact = `${OUT_DIR}/invalid.html`
    const source = ['---', 'title: 無效日期', 'date: 2026-13-45', '---', '', '內文。'].join('\n')
    const r = runCli(['render', '-', '-o', artifact], { input: source })
    expect(r.code, `render exit（stderr: ${r.stderr}）`).toBe(0)
    const meta = metaOf(artifact)
    if (meta.date !== undefined) expect(meta.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(runCli(['lint', artifact]).code).toBe(0)
  })
})

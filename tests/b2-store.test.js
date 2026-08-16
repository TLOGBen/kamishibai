import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { runCli, outDir, repoRoot, HOME_ENV } from './helpers.js'

const OUT_DIR = outDir('b2')
const ENGINE = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version

/** A store root that does *not* exist yet — the first-touch gate's subject. */
const freshHome = () => join(mkdtempSync(join(tmpdir(), 'kamishibai-b2-')), 'store')

const render = (home, out, project = 'b2-proj') =>
  runCli(
    ['render', 'fixtures/book-sample.md', '-o', out, '--project', project, '--json'],
    { env: { [HOME_ENV]: home } },
  )

describe('B2 首觸安全閘與中央庫佈局', () => {
  it('test_store_layout: 庫根不存在時建立庫並寫 created-by 標記檔，正本落 artifacts/<專案>/<slug>.html', () => {
    const home = freshHome()
    expect(existsSync(home)).toBe(false)

    const r = render(home, `${OUT_DIR}/book.html`)
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)

    const marker = join(home, 'created-by')
    expect(existsSync(marker), 'created-by 標記檔必須存在').toBe(true)
    expect(readFileSync(marker, 'utf8').trim()).toBe(`created-by: kamishibai@${ENGINE}`)

    expect(out.archived).toBe(join(home, 'artifacts', 'b2-proj', 'book-sample.html'))
    expect(existsSync(out.archived)).toBe(true)
  })

  it('test_b2_existing_store_is_only_appended_to: 庫根已存在時不動既有檔案、不補寫標記', () => {
    const home = freshHome()
    mkdirSync(join(home, 'artifacts'), { recursive: true })
    const sentinel = join(home, 'artifacts', 'DO-NOT-TOUCH.txt')
    writeFileSync(sentinel, 'pre-existing\n', 'utf8')

    const r = render(home, `${OUT_DIR}/existing.html`, 'b2-existing')
    expect(r.code).toBe(0)

    expect(readFileSync(sentinel, 'utf8'), '既有檔案不得被改動').toBe('pre-existing\n')
    expect(
      existsSync(join(home, 'created-by')),
      '庫根已存在＝非首觸，不得補寫標記檔',
    ).toBe(false)
    expect(existsSync(JSON.parse(r.stdout).archived)).toBe(true)
  })

  it('test_b2_archive_write_is_exclusive: 預先放置同名檔，render 不覆寫而改落尾綴檔', () => {
    const home = freshHome()
    const dir = join(home, 'artifacts', 'b2-exclusive')
    mkdirSync(dir, { recursive: true })
    const squatter = join(dir, 'book-sample.html')
    writeFileSync(squatter, 'SQUATTER\n', 'utf8')

    const r = render(home, `${OUT_DIR}/exclusive.html`, 'b2-exclusive')
    expect(r.code).toBe(0)
    const archived = JSON.parse(r.stdout).archived

    expect(readFileSync(squatter, 'utf8'), '既有同名檔不得被覆寫').toBe('SQUATTER\n')
    expect(archived).not.toBe(squatter)
    expect(archived.split('/').pop()).toMatch(/^book-sample-\d{8}T\d{9}Z(-\d+)?\.html$/)
  })

  it('test_b2_slug_collision_gets_timestamp_suffix: 同 slug 撞名不覆寫，改走時戳尾綴', () => {
    const home = freshHome()
    const first = render(home, `${OUT_DIR}/one.html`, 'b2-collide')
    expect(first.code).toBe(0)
    const canonical = JSON.parse(first.stdout).archived
    const before = readFileSync(canonical, 'utf8')

    const second = render(home, `${OUT_DIR}/two.html`, 'b2-collide')
    expect(second.code).toBe(0)
    const stamped = JSON.parse(second.stdout).archived

    expect(stamped, '第二份正本不得覆寫第一份').not.toBe(canonical)
    expect(readFileSync(canonical, 'utf8'), '既有正本必須逐位元不變').toBe(before)
    expect(stamped.split('/').pop()).toMatch(/^book-sample-\d{8}T\d{9}Z(-\d+)?\.html$/)

    const files = readdirSync(join(home, 'artifacts', 'b2-collide')).filter((f) => f.endsWith('.html'))
    expect(files.length).toBe(2)
  })
})

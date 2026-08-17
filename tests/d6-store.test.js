import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, repoRoot, testHome } from './helpers.js'
import { writeFileAtomic } from '../src/delivery/atomic.js'

const OUT_DIR = outDir('d6')
const DOC_SOURCE = `${repoRoot}/fixtures/diagram-sample.md`
const DOC = `${OUT_DIR}/doc.html`
const PROJECT = 'd6-store'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-17T00:00:00.000Z' }
const BROWSER_TIMEOUT = 180_000

/** Verbatim CONTRACT constants — store layout, copied by hand. */
const ARTIFACTS_DIRNAME = 'artifacts'
const COPIES_SUFFIX = '.copies.json'

const projectDir = () => join(testHome, ARTIFACTS_DIRNAME, PROJECT)

/** Name → sha256 for every file in a directory, so "untouched" is checkable. */
const fingerprint = (dir) =>
  Object.fromEntries(
    readdirSync(dir)
      .sort()
      .map((name) => [
        name,
        createHash('sha256').update(readFileSync(join(dir, name))).digest('hex'),
      ]),
  )

const gate = JSON.parse(runCli(['setup', '--dry-run', '--json'], { env: PINNED }).stdout)
const hasBrowser = gate.browser === 'present'

describe('D6 sidecar 原子寫入與庫內寫入紀律', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
    const r = runCli(['render', DOC_SOURCE, '-o', DOC, '--project', PROJECT], { env: PINNED })
    expect(r.code, `render exit（stderr: ${r.stderr}）`).toBe(0)
  })

  it('test_d6_sidecar_write_is_atomic: tmp+rename——寫完只有目標檔，沒有殘骸', () => {
    const dir = join(OUT_DIR, 'atomic')
    mkdirSync(dir, { recursive: true })
    const target = join(dir, `probe${COPIES_SUFFIX}`)

    writeFileAtomic(target, '["one"]\n')
    expect(readFileSync(target, 'utf8')).toBe('["one"]\n')
    expect(readdirSync(dir), '不得留下 tmp 殘骸').toEqual([`probe${COPIES_SUFFIX}`])

    // 覆寫既有檔：內容整份換掉，仍然沒有殘骸
    writeFileAtomic(target, '["one","two"]\n')
    expect(readFileSync(target, 'utf8')).toBe('["one","two"]\n')
    expect(readdirSync(dir)).toEqual([`probe${COPIES_SUFFIX}`])
  })

  it('test_d6_atomic_write_leaves_no_residue_on_failure: 失敗時 tmp 也要收乾淨', () => {
    const dir = join(OUT_DIR, 'atomic-fail')
    mkdirSync(dir, { recursive: true })
    // 目標是一個目錄 → rename 必失敗，這是可靠地觸發失敗路的方式
    const target = join(dir, 'occupied')
    mkdirSync(join(target, 'child'), { recursive: true })

    expect(() => writeFileAtomic(target, 'x')).toThrow()
    expect(readdirSync(dir).sort(), '失敗後目錄裡只該剩原本那個目錄').toEqual(['occupied'])
  })

  it('test_d6_store_sidecar_has_no_tmp_residue: 真實 render 後庫內只有正本與 sidecar', () => {
    const files = readdirSync(projectDir())
    expect(files.some((f) => f.endsWith('.html')), '庫內應有正本').toBe(true)
    expect(files.some((f) => f.endsWith(COPIES_SUFFIX)), '庫內應有 sidecar').toBe(true)
    expect(files.filter((f) => f.endsWith('.tmp')), 'tmp 殘骸').toEqual([])
    expect(files.filter((f) => f.startsWith('.')), '隱藏殘骸').toEqual([])

    // sidecar 是完整的 JSON，不是被截斷的半份
    const sidecar = files.find((f) => f.endsWith(COPIES_SUFFIX))
    const parsed = JSON.parse(readFileSync(join(projectDir(), sidecar), 'utf8'))
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed, 'sidecar 應記到這次的投遞副本').toContain(DOC)
  })

  it('test_d6_sidecar_written_only_through_atomic_writer: store.js 不得再直接覆寫 sidecar', () => {
    const source = readFileSync(join(repoRoot, 'src/delivery/store.js'), 'utf8')
    expect(source, 'sidecar 後綴常數必須逐字如合約').toContain(`= '${COPIES_SUFFIX}'`)
    const sidecarWrites = source
      .split('\n')
      .filter((line) => line.includes('COPIES_SUFFIX') && /write/i.test(line))
    expect(sidecarWrites.length, '應恰有一處寫 sidecar').toBe(1)
    expect(sidecarWrites[0], 'sidecar 必須走原子寫入').toContain('writeFileAtomic')
    expect(source, '正本仍必須用 wx 獨佔寫入').toContain("flag: 'wx'")
  })

  it.skipIf(!hasBrowser)(
    'test_d6_export_never_writes_into_the_store: export／snapshot 不動中央產物庫一個位元',
    async () => {
      const before = fingerprint(projectDir())
      expect(Object.keys(before).length, '前置條件：庫內要有東西').toBeGreaterThan(0)

      const runs = [
        ['export', DOC, '--to', 'pdf', '-o', `${OUT_DIR}/doc.pdf`, '--json'],
        ['snapshot', DOC, '-o', `${OUT_DIR}/doc.png`, '--json'],
      ]
      for (const args of runs) {
        const r = runCli(args, { env: PINNED })
        expect(r.code, `[${args[0]}] exit（stderr: ${r.stderr}）`).toBe(0)
      }

      // v1 明確不把附屬格式歸檔（合約 D6 的「if archived」）。既然不歸檔，
      // 就必須真的一個位元都不動——這條斷言就是那個選擇的可驗證形。
      expect(fingerprint(projectDir()), '匯出不得在庫內留下任何東西').toEqual(before)
      expect(existsSync(`${OUT_DIR}/doc.pdf`)).toBe(true)
      expect(existsSync(`${OUT_DIR}/doc.png`)).toBe(true)
    },
    BROWSER_TIMEOUT,
  )
})

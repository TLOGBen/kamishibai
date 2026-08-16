import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  runCli,
  outDir,
  repoRoot,
  testHome,
  assertTestHome,
  leaksSinceLoad,
  REAL_HOME,
  HOME_ENV,
} from './helpers.js'

const OUT_DIR = outDir('b1')
const SPAWN_CALL = /\b(execSync|execFileSync|spawnSync|spawn)\s*\(/g
const INJECTED_ENV = /env:\s*cliEnv\(/g

const srcFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return srcFiles(full)
    return entry.name.endsWith('.js') ? [full] : []
  })

describe('B1 HOME 紀律', () => {
  it('test_b1_test_home_is_temporary: 測試套件自我斷言 HOME 為暫存目錄且非真實家目錄', () => {
    expect(testHome.startsWith(tmpdir())).toBe(true)
    expect(assertTestHome(testHome)).toBe(testHome)

    // 自我斷言必須真的會擋：否則它只是一句註解
    expect(() => assertTestHome(REAL_HOME)).toThrow()
    expect(() => assertTestHome(join(REAL_HOME, 'artifacts'))).toThrow()
    expect(() => assertTestHome(homedir())).toThrow()
    expect(() => assertTestHome('/var/lib/kamishibai')).toThrow()
  })

  it('test_b1_render_never_touches_real_home: render 只寫入注入的 HOME，真實庫零改動', () => {
    const r = runCli([
      'render',
      'fixtures/book-sample.md',
      '-o',
      `${OUT_DIR}/book.html`,
      '--project',
      'b1-proj',
      '--json',
    ])
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.archived.startsWith(testHome)).toBe(true)
    // 以「本次執行後有無新／改動檔案」判定，而非以「目錄存在與否」——
    // 後者對已有真實產物庫的使用者會誤報，也放過了「已存在就繼續污染」。
    expect(leaksSinceLoad(), `測試套件污染了真實產物庫 ${REAL_HOME}`).toEqual([])
  })

  it('test_b1_every_cli_spawn_uses_the_injected_home: 測試碼中任何直呼 CLI 皆走 cliEnv', () => {
    // A6 的 shell pipeline 曾直接 execSync 而繼承真實環境，整套 render 因此
    // 歸檔進 ~/.kamishibai。規則寫成結構性的：碰 cliPath 就必須碰 cliEnv。
    const offenders = readdirSync(join(repoRoot, 'tests'))
      .filter((f) => f.endsWith('.test.js'))
      .map((f) => {
        const code = readFileSync(join(repoRoot, 'tests', f), 'utf8')
        if (!code.includes('cliPath')) return null
        const spawns = (code.match(SPAWN_CALL) ?? []).length
        const injected = (code.match(INJECTED_ENV) ?? []).length
        return injected >= spawns ? null : `${f}: ${spawns} 次直呼、僅 ${injected} 次注入`
      })
      .filter((entry) => entry !== null)
    expect(offenders).toEqual([])
  })

  it('test_b1_single_home_resolver: KAMISHIBAI_HOME 與 homedir() 只出現在唯一解析模組', () => {
    const files = srcFiles(join(repoRoot, 'src'))
    const offenders = files.filter((file) => {
      const code = readFileSync(file, 'utf8')
      return /\bhomedir\s*\(/.test(code) || code.includes(HOME_ENV)
    })
    expect(offenders.map((f) => f.replace(`${repoRoot}/`, ''))).toEqual(['src/delivery/home.js'])
  })

  it('test_b1_env_override_wins: KAMISHIBAI_HOME 覆寫預設庫根', () => {
    const alt = mkdtempSync(join(tmpdir(), 'kamishibai-alt-home-'))
    const r = runCli(
      ['render', 'fixtures/book-sample.md', '-o', `${OUT_DIR}/alt.html`, '--project', 'b1-alt', '--json'],
      { env: { [HOME_ENV]: alt } },
    )
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.archived).toBe(join(alt, 'artifacts', 'b1-alt', 'book-sample.html'))
    expect(existsSync(out.archived)).toBe(true)
  })
})

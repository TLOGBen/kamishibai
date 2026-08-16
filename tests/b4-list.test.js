import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { runCli, outDir, repoRoot } from './helpers.js'

const OUT_DIR = outDir('b4')
const SAMPLE = join(repoRoot, 'fixtures', 'book-sample.md')
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-16T00:00:00.000Z' }
const LIST_KEYS = ['artifact', 'copies', 'createdAt', 'generator', 'name', 'template']

const jsonOf = (r) => {
  expect(r.code).toBe(0)
  return JSON.parse(r.stdout)
}

describe('B4 list 與四層專案解析', () => {
  it('test_list_json_shape: list --json 為陣列，每筆恰含六鍵；空專案為 [] 且 exit 0', () => {
    const copy = `${OUT_DIR}/listed.html`
    const rendered = jsonOf(
      runCli(
        ['render', SAMPLE, '-o', copy, '--project', 'b4-proj', '-g', 'b4-generator', '--json'],
        { env: PINNED },
      ),
    )

    const entries = jsonOf(runCli(['list', '--project', 'b4-proj', '--json']))
    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBe(1)

    const [entry] = entries
    expect(Object.keys(entry).sort()).toEqual(LIST_KEYS)
    expect(entry.name).toBe('book-sample')
    expect(entry.template).toBe('kami/long-form@0.1.0')
    expect(entry.createdAt).toBe(PINNED.KAMISHIBAI_BUILD_TIME)
    expect(entry.generator).toBe('b4-generator')
    expect(entry.artifact).toBe(rendered.archived)
    expect(entry.copies).toEqual([rendered.artifact])

    const empty = runCli(['list', '--project', 'b4-nothing-here', '--json'])
    expect(empty.code).toBe(0)
    expect(JSON.parse(empty.stdout)).toEqual([])
  })

  it('test_b4_project_resolution_layers: --project → .kamishibai.toml → git root → cwd 四層依序', () => {
    // ① --project 明指：即使 cwd 在 git repo 內，明指仍優先
    jsonOf(runCli(['render', SAMPLE, '-o', `${OUT_DIR}/l1.html`, '--project', 'b4-explicit', '--json']))
    expect(jsonOf(runCli(['list', '--project', 'b4-explicit', '--json'])).length).toBe(1)
    expect(jsonOf(runCli(['list', '--json'])).some((e) => e.artifact.includes('/b4-explicit/'))).toBe(
      false,
    )

    // ② .kamishibai.toml 錨點：位於 git repo 內的子目錄，錨點必須贏過 git root
    const anchored = join(OUT_DIR, 'anchored')
    rmSync(anchored, { recursive: true, force: true })
    mkdirSync(join(anchored, 'deep', 'nested'), { recursive: true })
    writeFileSync(
      join(anchored, '.kamishibai.toml'),
      '[project]\nname = "b4-anchored"\n',
      'utf8',
    )
    const fromAnchor = jsonOf(
      runCli(['render', SAMPLE, '-o', `${OUT_DIR}/l2.html`, '--json'], {
        cwd: join(anchored, 'deep', 'nested'),
      }),
    )
    expect(fromAnchor.archived).toContain('/artifacts/b4-anchored/')

    // ③ git root：repo 內、無錨點覆蓋時取 git root 資料夾名
    const fromGit = jsonOf(
      runCli(['render', SAMPLE, '-o', `${OUT_DIR}/l3.html`, '--json'], { cwd: repoRoot }),
    )
    expect(fromGit.archived).toContain(`/artifacts/${basename(repoRoot)}/`)

    // ④ cwd 保底：非 git、無錨點
    const loose = mkdtempSync(join(tmpdir(), 'kamishibai-b4-cwd-'))
    const fromCwd = jsonOf(
      runCli(['render', SAMPLE, '-o', `${OUT_DIR}/l4.html`, '--json'], { cwd: loose }),
    )
    expect(fromCwd.archived).toContain(`/artifacts/${basename(loose)}/`)
  })

  it('test_b4_derived_project_names_are_normalised: 衍生層含空白的目錄名正規化後可用，不得 exit 2', () => {
    // S1 能跑的環境（`My Project`、`Google Drive`、OneDrive 路徑）不得因 S2 癱瘓：
    // 使用者沒得選自己的資料夾叫什麼，衍生名是推導出來的，不是他輸入的。
    const base = mkdtempSync(join(tmpdir(), 'kamishibai-b4-spaces-'))

    // ④ cwd 保底含空白
    const spaced = join(base, 'My Project')
    mkdirSync(spaced, { recursive: true })
    const fromCwd = jsonOf(runCli(['render', SAMPLE, '-o', `${OUT_DIR}/s1.html`, '--json'], { cwd: spaced }))
    expect(fromCwd.archived).toContain('/artifacts/My-Project/')

    // ③ git root 含空白（子目錄執行）
    const repo = join(base, 'My Repo')
    mkdirSync(join(repo, '.git'), { recursive: true })
    mkdirSync(join(repo, 'src', 'deep'), { recursive: true })
    const fromGit = jsonOf(
      runCli(['render', SAMPLE, '-o', `${OUT_DIR}/s2.html`, '--json'], { cwd: join(repo, 'src', 'deep') }),
    )
    expect(fromGit.archived).toContain('/artifacts/My-Repo/')

    // ② 錨點檔宣告的名字含空白
    const anchored = join(base, 'anchored')
    mkdirSync(anchored, { recursive: true })
    writeFileSync(join(anchored, '.kamishibai.toml'), '[project]\nname = "Google Drive Notes"\n', 'utf8')
    const fromAnchor = jsonOf(
      runCli(['render', SAMPLE, '-o', `${OUT_DIR}/s3.html`, '--json'], { cwd: anchored }),
    )
    expect(fromAnchor.archived).toContain('/artifacts/Google-Drive-Notes/')

    // 正規化必須是決定性的：同一個目錄兩次執行落同一個專案
    const again = jsonOf(runCli(['render', SAMPLE, '-o', `${OUT_DIR}/s4.html`, '--json'], { cwd: spaced }))
    expect(dirname(again.archived)).toBe(dirname(fromCwd.archived))

    // traversal 字樣被正規化成安全形，不得逃出 artifacts/
    const dotted = join(base, '..evil..')
    mkdirSync(dotted, { recursive: true })
    const fromDotted = jsonOf(runCli(['render', SAMPLE, '-o', `${OUT_DIR}/s5.html`, '--json'], { cwd: dotted }))
    expect(fromDotted.archived).not.toContain('..')
    expect(dirname(dirname(fromDotted.archived))).toBe(dirname(dirname(fromCwd.archived)))
  })

  it('test_b4_explicit_project_still_strict: 使用者明指的 --project 仍嚴格拒收', () => {
    // 明指是輸入，不是推導：靜默改寫使用者打的字，等於把產物歸到他沒要求的目錄。
    for (const bad of ['My Project', '../escape', 'a/b', '..']) {
      const r = runCli(['list', '--project', bad, '--json'])
      expect(r.code, `[${bad}] exit`).toBe(2)
      expect(JSON.parse(r.stdout).errors[0].code).toBe('KSB_USAGE')
    }
  })

  it('test_b4_list_resolves_project_the_same_way: list 與 render 走同一套解析', () => {
    const anchored = join(OUT_DIR, 'anchored-list')
    rmSync(anchored, { recursive: true, force: true })
    mkdirSync(join(anchored, 'sub'), { recursive: true })
    writeFileSync(join(anchored, '.kamishibai.toml'), 'name = "b4-anchored-list"\n', 'utf8')

    const opts = { cwd: join(anchored, 'sub') }
    jsonOf(runCli(['render', SAMPLE, '-o', `${OUT_DIR}/l5.html`, '--json'], opts))
    const entries = jsonOf(runCli(['list', '--json'], opts))
    expect(entries.length).toBe(1)
    expect(entries[0].artifact).toContain('/artifacts/b4-anchored-list/')
  })
})

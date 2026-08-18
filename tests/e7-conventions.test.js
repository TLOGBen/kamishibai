import { readFileSync, readdirSync, statSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCli, outDir, repoRoot } from './helpers.js'

/**
 * CONTRACT E7 — the S5 surfaces obey the conventions every earlier slice set:
 * `--json` is a single parseable object on the success path, failures classify
 * into exit 1/2 with a KSB_ code, the human path is the same result object
 * rendered by the one formatter, files stay small, and layering holds.
 *
 * The S4 corpus rides along here: proofread/journal fixtures must still render
 * and lint clean after the delivery layer grew a server.
 */

const OUT_DIR = outDir('e7')
const PROJECT = 'e7-conventions'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-18T00:00:00.000Z' }
const MAX_LINES = 800

const NEW_COMMANDS = Object.freeze(['serve', 'close', 'comments', 'templates', 'debug'])
/** Only the export layer may reach for a browser or an OOXML writer. */
const HEAVY_DEPS = Object.freeze(['playwright', 'pptxgenjs'])
/** Only the CLI and serve layers may spawn processes or open sockets. */
const PROCESS_DEPS = Object.freeze(['node:http', 'node:child_process'])
const PROCESS_ALLOWED = Object.freeze(['/src/serve/', '/src/cli/', '/src/export/', '/src/delivery/open.js'])

const parseOne = (stdout) => JSON.parse(stdout)

const walkFiles = (dir) => {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkFiles(full))
    else if (full.endsWith('.js')) out.push(full)
  }
  return out
}

describe('E7 S5 新面沿用既有慣例與分層', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
  })

  afterAll(() => runCli(['close', '--json']))

  it('test_e7_new_commands_appear_in_help: 五個新指令都進 help 通道', () => {
    const help = parseOne(runCli(['--help', '--json']).stdout).help
    for (const command of NEW_COMMANDS) {
      expect(help, `help 缺少 ${command}`).toContain(command)
    }
  })

  it('test_e7_new_commands_follow_json_convention: 成功路皆為單一 JSON', () => {
    const runs = [
      ['close', '--json'],
      ['templates', '--json'],
    ]
    for (const args of runs) {
      const r = runCli(args)
      expect(r.code, `${args[0]} exit（stderr: ${r.stderr}）`).toBe(0)
      expect(() => parseOne(r.stdout), `${args[0]} stdout 必須是單一 JSON`).not.toThrow()
    }
  })

  it('test_e7_new_commands_classify_exit_codes: 失敗路 exit 1/2 與 KSB_ 碼皆穩定', () => {
    const cases = [
      { args: ['serve', '--json'], code: 2 },
      { args: ['serve', 'fixtures/does-not-exist.md', '--json'], code: 2 },
      { args: ['comments', '--json'], code: 2 },
      { args: ['comments', 'fixtures/does-not-exist.html', '--json'], code: 2 },
      { args: ['comments', 'fixtures/broken/no-ir.html', '--json'], code: 0 },
    ]
    for (const { args, code } of cases) {
      const r = runCli(args)
      expect(r.code, `[${args.join(' ')}] exit`).toBe(code)
      if (code === 0) continue
      const out = parseOne(r.stdout)
      expect(out.ok, `[${args.join(' ')}] ok`).toBe(false)
      expect(out.errors[0].code, `[${args.join(' ')}] code`).toMatch(/^KSB_/)
    }
  })

  it('test_e7_serve_layer_holds_the_sockets: 只有 serve／cli 層碰 http 與子行程', () => {
    const offenders = []
    for (const file of walkFiles(join(repoRoot, 'src'))) {
      const code = readFileSync(file, 'utf8')
      for (const dep of PROCESS_DEPS) {
        const imported = new RegExp(`\\bfrom\\s+['"]${dep}['"]`).test(code)
        if (imported && !PROCESS_ALLOWED.some((allowed) => file.includes(allowed))) {
          offenders.push(`${file} → ${dep}`)
        }
      }
      for (const dep of HEAVY_DEPS) {
        const imported =
          new RegExp(`\\bfrom\\s+['"]${dep}(\\/[^'"]*)?['"]`).test(code) ||
          new RegExp(`\\bimport\\(\\s*['"]${dep}(\\/[^'"]*)?['"]`).test(code)
        if (imported && !file.includes('/src/export/')) offenders.push(`${file} → ${dep}`)
      }
    }
    expect(offenders, '重依賴不得溢出它該待的層').toEqual([])
    expect(statSync(join(repoRoot, 'src/serve')).isDirectory(), 'serve 層應存在').toBe(true)
  })

  it('test_e7_source_files_stay_small: 新增的檔案同樣 ≤800 行', () => {
    const oversized = [...walkFiles(join(repoRoot, 'src')), ...walkFiles(join(repoRoot, 'templates'))]
      .map((file) => ({ file, lines: readFileSync(file, 'utf8').split('\n').length }))
      .filter((entry) => entry.lines > MAX_LINES)
    expect(oversized).toEqual([])
  })

  it('test_e7_formatter_covers_every_new_command: 每個新指令都有人讀渲染，沒有掉回 JSON dump', () => {
    const source = readFileSync(join(repoRoot, 'src/cli/format.js'), 'utf8')
    for (const command of NEW_COMMANDS) {
      expect(source, `formatter 缺少 ${command} 的渲染`).toMatch(new RegExp(`\\b${command}:`))
    }
  })

  it('test_e7_s4_corpus_still_renders_and_lints_clean: S4 語料在 S5 之後仍渲染乾淨', () => {
    for (const name of ['proofread-sample', 'journal-sample']) {
      const out = join(OUT_DIR, `${name}.html`)
      const rendered = runCli(
        ['render', `${repoRoot}/fixtures/${name}.md`, '-o', out, '--project', PROJECT, '--json'],
        { env: PINNED },
      )
      expect(rendered.code, `${name} render exit（stderr: ${rendered.stderr}）`).toBe(0)
      expect(runCli(['lint', out, '--json']).code, `${name} lint exit`).toBe(0)
      expect(readFileSync(out, 'utf8'), `${name} 產物不得帶 dev 覆蓋層`).not.toContain(
        'kamishibai-dev-overlay',
      )
    }
  })

  it('test_e7_render_is_still_idempotent_after_the_compile_refactor: 同輸入兩次渲染仍位元組相同', () => {
    const one = join(OUT_DIR, 'idem-1.html')
    const two = join(OUT_DIR, 'idem-2.html')
    for (const out of [one, two]) {
      expect(
        runCli(['render', `${repoRoot}/fixtures/slides-sample.md`, '-o', out, '--project', PROJECT], {
          env: PINNED,
        }).code,
      ).toBe(0)
    }
    expect(readFileSync(one).equals(readFileSync(two)), 'render 必須維持冪等').toBe(true)
  })
})

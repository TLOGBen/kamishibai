import { rmSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir } from './helpers.js'

const OUT_DIR = outDir('a7')
const ARTIFACT = `${OUT_DIR}/book.html`
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-16T00:00:00.000Z' }

const parseOne = (stdout) => {
  const value = JSON.parse(stdout)
  expect(typeof value).toBe('object')
  expect(Array.isArray(value)).toBe(false)
  return value
}

describe('A7 CLI 介面契約', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT]).code).toBe(0)
  })

  it('test_render_json_shape: render --json 恰為 {ok,artifact,bytes}，artifact 為絕對路徑', () => {
    const r = runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT, '--json'])
    expect(r.code).toBe(0)
    const out = parseOne(r.stdout)
    expect(Object.keys(out).sort()).toEqual(['artifact', 'bytes', 'ok'])
    expect(out.ok).toBe(true)
    expect(isAbsolute(out.artifact)).toBe(true)
    expect(Number.isInteger(out.bytes)).toBe(true)
    expect(out.bytes).toBeGreaterThan(0)
    // 真值錨：bytes 必須等於磁碟上的實際大小。少了這條，`html.length`
    // （UTF-16 code unit）也會全綠，而中文長文每篇短報上千 bytes。
    expect(out.bytes, 'bytes 必須等於產物檔案的實際位元組數').toBe(statSync(out.artifact).size)
  })

  it('test_a7_all_four_commands_support_json: 四指令成功路徑 stdout 皆為單一 JSON 物件', () => {
    const runs = [
      ['render', 'fixtures/book-sample.md', '-o', `${OUT_DIR}/j.html`, '--json'],
      ['lint', ARTIFACT, '--json'],
      ['example', 'doc', '--json'],
      ['schema', '--json'],
    ]
    for (const args of runs) {
      const r = runCli(args)
      expect(r.code, `${args[0]} exit`).toBe(0)
      expect(() => parseOne(r.stdout), `${args[0]} stdout`).not.toThrow()
    }
  })

  it('test_a7_failure_paths_still_emit_json: 失敗路徑 stdout 仍為單一 JSON 物件', () => {
    const failures = [
      ['lint', 'fixtures/broken/no-ir.html', '--json'],
      ['render', '-', '--json'],
      ['render', 'fixtures/does-not-exist.md', '--json'],
      ['example', 'not-a-block', '--json'],
      ['no-such-command', '--json'],
    ]
    for (const args of failures) {
      const r = runCli(args, { input: '{ this is not json' })
      expect(r.code, `${args[0]} exit`).not.toBe(0)
      const out = parseOne(r.stdout)
      expect(out.ok, `${args[0]} ok`).toBe(false)
      expect(Array.isArray(out.errors)).toBe(true)
      expect(out.errors.length).toBeGreaterThan(0)
      expect(out.errors[0].code).toMatch(/^KSB_/)
    }
  })

  it('test_a7_exit_codes_classified: 0=成功 1=驗證失敗 2=用法錯誤', () => {
    expect(runCli(['lint', ARTIFACT, '--json']).code).toBe(0)
    expect(runCli(['lint', 'fixtures/broken/external-script.html', '--json']).code).toBe(1)
    expect(runCli(['render', '-', '--json'], { input: '{ broken json' }).code).toBe(1)
    expect(runCli(['render', 'fixtures/nope.md', '--json']).code).toBe(2)
    expect(runCli(['render', '--json']).code).toBe(2)
    expect(runCli(['bogus', '--json']).code).toBe(2)
  })

  it('test_a7_any_invocation_form_emits_json: 無指令／未知旗標在 --json 下仍為單一 JSON 物件且 exit 2', () => {
    // 這些呼叫形曾因 commander 的 help 分支變成 exit 0＋空 stdout：
    // 下游 JSON.parse 必炸，而 exit code 看起來卻是成功。
    const forms = [[], ['--bogus-flag'], ['render', 'fixtures/book-sample.md', '--bogus-flag']]
    for (const form of forms) {
      const r = runCli([...form, '--json'])
      expect(r.stdout.trim(), `[${form.join(' ')}] stdout 不得為空`).not.toBe('')
      const out = parseOne(r.stdout)
      expect(out.ok, `[${form.join(' ')}] ok`).toBe(false)
      expect(out.errors[0].code, `[${form.join(' ')}] code`).toMatch(/^KSB_/)
      expect(r.code, `[${form.join(' ')}] exit`).toBe(2)
    }
  })

  it('test_a7_usage_error_message_has_no_commander_token: 用法錯誤訊息禁含 commander 內部 token', () => {
    const forms = [[], ['--json'], ['--bogus-flag'], ['--bogus-flag', '--json'], ['-o', 'x.html']]
    for (const form of forms) {
      const r = runCli(form)
      expect(r.code, `[${form.join(' ')}] exit`).toBe(2)
      const message = r.stdout + r.stderr
      // commander 會把 help 事件的 message 設成 `(outputHelp)` 這種內部 token，
      // 原樣轉包出去等於對使用者吐實作細節
      expect(message, `[${form.join(' ')}] 不得含 commander 內部 token`).not.toMatch(/\(\w*[Hh]elp\)/)
      expect(message).toMatch(/KSB_/)
    }
  })

  it('test_a7_no_command_message_identical_on_both_paths: 「無指令」兩路 message 完全相同', () => {
    const human = runCli([])
    const json = runCli(['--json'])
    expect(human.code).toBe(2)
    expect(json.code).toBe(2)

    const jsonMessage = parseOne(json.stdout).errors[0].message
    expect(jsonMessage).not.toMatch(/\(\w*[Hh]elp\)/)
    // 人類路的摘要行由同一個 message 產生，故必逐字包含它
    expect(human.stdout).toContain(jsonMessage)

    // 加上 --json 不得改變錯誤本身
    const jsonNoCmdViaFlag = parseOne(runCli(['--json']).stdout).errors[0]
    expect(jsonNoCmdViaFlag.code).toBe('KSB_USAGE')
    expect(jsonNoCmdViaFlag.message).toBe(jsonMessage)
  })

  it('test_a7_explicit_help_and_version_exit_zero: 明示 --help/--version 才 exit 0，且 --json 欄位齊備', () => {
    const engine = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ).version

    for (const flag of ['--help', '-h']) {
      const plain = runCli([flag])
      expect(plain.code, `${flag} 純文字 exit`).toBe(0)
      expect(plain.stdout.trim(), `${flag} 純文字 stdout`).not.toBe('')

      const out = parseOne(runCli([flag, '--json']).stdout)
      expect(Object.keys(out).sort(), `${flag} 頂層鍵`).toEqual(['help', 'ok'])
      expect(out.ok).toBe(true)
      expect(typeof out.help).toBe('string')
      expect(out.help.length, `${flag} help 不得為空`).toBeGreaterThan(0)
      expect(out.help).toContain('kamishibai')
    }

    for (const flag of ['--version', '-v']) {
      const plain = runCli([flag])
      expect(plain.code, `${flag} 純文字 exit`).toBe(0)
      expect(plain.stdout.trim(), `${flag} 純文字 stdout`).not.toBe('')

      const out = parseOne(runCli([flag, '--json']).stdout)
      expect(Object.keys(out).sort(), `${flag} 頂層鍵`).toEqual(['ok', 'version'])
      expect(out.ok).toBe(true)
      expect(out.version, `${flag} 須等於 engine 版本`).toBe(engine)
      expect(out.version, `${flag} 須為 semver`).toMatch(/^\d+\.\d+\.\d+/)
    }
  })

  it('test_formatter_shared_both_paths: 人類輸出與 --json 來自同一結果物件', () => {
    const jsonRender = parseOne(
      runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT, '--json'], { env: PINNED })
        .stdout,
    )
    const humanRender = runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT], {
      env: PINNED,
    })
    expect(humanRender.code).toBe(0)
    expect(humanRender.stdout).toContain(jsonRender.artifact)
    expect(humanRender.stdout).toContain(String(jsonRender.bytes))

    const jsonLint = parseOne(runCli(['lint', 'fixtures/broken/no-ir.html', '--json']).stdout)
    const humanLint = runCli(['lint', 'fixtures/broken/no-ir.html'])
    expect(humanLint.code).toBe(1)
    // 摘要行的 N 必須就是 errors.length，否則計數漂移不會被任何測試看見
    expect(humanLint.stdout).toContain(`✖ ${jsonLint.errors.length} 個問題`)
    for (const err of jsonLint.errors) {
      expect(humanLint.stdout).toContain(err.code)
      expect(humanLint.stdout).toContain(err.path)
      // 兩路同文：人類路的診斷必須就是 --json 的那一句，不得另生一套或省略
      expect(err.message.length).toBeGreaterThan(0)
      expect(humanLint.stdout, `人類路缺少 ${err.code} 的診斷文字`).toContain(err.message)
    }

    // 多錯案：單錯案抓不到「把 N 寫死成 1」這種突變
    const multiArtifact = `${OUT_DIR}/multi-error.html`
    expect(runCli(['render', 'fixtures/broken/raw-island-css.md', '-o', multiArtifact]).code).toBe(0)
    const jsonMulti = parseOne(runCli(['lint', multiArtifact, '--json']).stdout)
    const humanMulti = runCli(['lint', multiArtifact])
    expect(jsonMulti.errors.length).toBeGreaterThan(1)
    expect(humanMulti.stdout).toContain(`✖ ${jsonMulti.errors.length} 個問題`)
    // 同一組逐筆斷言也要套到多錯案，否則只有 KSB_IR_MISSING 一種 message 被釘住
    for (const err of jsonMulti.errors) {
      expect(err.message.length, `${err.code} 的 message 不得為空`).toBeGreaterThan(0)
      expect(humanMulti.stdout, `人類路缺少 ${err.code} 的診斷文字`).toContain(err.message)
      expect(humanMulti.stdout).toContain(err.code)
      expect(humanMulti.stdout).toContain(err.path)
    }

    // lint 成功路同樣兩路比對：人類輸出須帶出 --json 的 artifact 路徑，
    // 否則把成功行改成一句固定文字也測不出來。
    const jsonLintOk = parseOne(runCli(['lint', ARTIFACT, '--json']).stdout)
    const humanLintOk = runCli(['lint', ARTIFACT])
    expect(humanLintOk.code).toBe(0)
    expect(jsonLintOk.ok).toBe(true)
    expect(humanLintOk.stdout).toContain(jsonLintOk.artifact)

    const jsonExample = parseOne(runCli(['example', 'doc', '--json']).stdout)
    const humanExample = runCli(['example', 'doc'])
    expect(humanExample.stdout.replace(/\n$/, '')).toBe(jsonExample.example.replace(/\n$/, ''))

    const jsonSchema = parseOne(runCli(['schema', '--json']).stdout)
    const humanSchema = JSON.parse(runCli(['schema']).stdout)
    expect(humanSchema).toEqual(jsonSchema)
  })
})

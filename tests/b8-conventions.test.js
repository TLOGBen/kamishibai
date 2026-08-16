import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, repoRoot } from './helpers.js'

const OUT_DIR = outDir('b8')
const SAMPLE = `${repoRoot}/fixtures/book-sample.md`
const PROJECT = 'b8-proj'
const ARTIFACT = `${OUT_DIR}/book.html`

const parseOne = (stdout) => JSON.parse(stdout)

describe('B8 新指令沿用既有慣例', () => {
  beforeAll(() => {
    expect(runCli(['render', SAMPLE, '-o', ARTIFACT, '--project', PROJECT]).code).toBe(0)
  })

  it('test_b8_new_commands_follow_json_convention: list/open/replay 成功路皆為單一 JSON 輸出', () => {
    const runs = [
      ['list', '--project', PROJECT, '--json'],
      ['open', 'latest', '--project', PROJECT, '--dry-run', '--json'],
      ['replay', ARTIFACT, '-o', `${OUT_DIR}/r.html`, '--project', PROJECT, '--json'],
    ]
    for (const args of runs) {
      const r = runCli(args)
      expect(r.code, `${args[0]} exit`).toBe(0)
      expect(() => parseOne(r.stdout), `${args[0]} stdout`).not.toThrow()
    }
  })

  it('test_b8_new_commands_classify_exit_codes: 失敗路 exit 1/2 與 KSB_ 錯誤碼皆穩定', () => {
    const cases = [
      { args: ['open', 'nope', '--project', PROJECT, '--dry-run', '--json'], code: 1 },
      { args: ['replay', 'fixtures/broken/no-ir.html', '-o', `${OUT_DIR}/x.html`, '--json'], code: 1 },
      { args: ['replay', 'fixtures/does-not-exist.html', '--json'], code: 2 },
      { args: ['open', '--json'], code: 2 },
      { args: ['list', '--project', '../escape', '--json'], code: 2 },
    ]
    for (const { args, code } of cases) {
      const r = runCli(args)
      expect(r.code, `[${args.join(' ')}] exit`).toBe(code)
      const out = parseOne(r.stdout)
      expect(out.ok, `[${args.join(' ')}] ok`).toBe(false)
      expect(out.errors[0].code).toMatch(/^KSB_/)
    }
  })

  it('test_b8_new_commands_appear_in_help: 三個新指令進入 help 通道', () => {
    const help = parseOne(runCli(['--help', '--json']).stdout).help
    for (const command of ['list', 'open', 'replay']) {
      expect(help, `help 缺少 ${command}`).toContain(command)
    }
  })
})

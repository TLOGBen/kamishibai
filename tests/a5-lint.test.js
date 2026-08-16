import { rmSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir } from './helpers.js'
import { EXTERNAL_RULES } from '../src/core/lint.js'

const OUT_DIR = outDir('a5')
const ARTIFACT = `${OUT_DIR}/book.html`

describe('A5 lint 閘門', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', ARTIFACT]).code).toBe(0)
  })

  it('test_a5_lint_passes_on_rendered_artifact: 自家產物 lint exit 0', () => {
    const r = runCli(['lint', ARTIFACT])
    expect(r.stdout + r.stderr).not.toMatch(/KSB_/)
    expect(r.code).toBe(0)
  })

  it('test_a5_lint_fails_on_missing_ir: 缺 IR 的壞案 exit 1 並指出 KSB_IR_MISSING', () => {
    const r = runCli(['lint', 'fixtures/broken/no-ir.html', '--json'])
    expect(r.code).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors.map((e) => e.code)).toContain('KSB_IR_MISSING')
  })

  it('test_a5_lint_fails_on_external_script: 含外部 <script src> 的壞案 exit 1', () => {
    const r = runCli(['lint', 'fixtures/broken/external-script.html', '--json'])
    expect(r.code).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    const codes = out.errors.map((e) => e.code)
    expect(codes).toContain('KSB_EXTERNAL_SCRIPT')
    // IR 本身合法：外部資源規則獨立成立，而非順帶被 IR 缺漏擋下
    expect(codes).not.toContain('KSB_IR_MISSING')
    expect(codes).not.toContain('KSB_IR_SCHEMA')
  })

  it('test_lint_json_errors: 失敗 --json 物件恰為 {ok,errors}，每筆含 path＋KSB_ code', () => {
    const r = runCli(['lint', 'fixtures/broken/no-ir.html', '--json'])
    const out = JSON.parse(r.stdout)
    expect(Object.keys(out).sort()).toEqual(['errors', 'ok'])
    expect(out.errors.length).toBeGreaterThan(0)
    for (const e of out.errors) {
      expect(Object.keys(e).sort()).toEqual(['code', 'message', 'path'])
      expect(typeof e.path).toBe('string')
      expect(e.path.length).toBeGreaterThan(0)
      expect(e.code).toMatch(/^KSB_/)
      expect(typeof e.message).toBe('string')
      // 診斷文字是 Agent 唯一的「為什麼」——空字串等於沒有診斷
      expect(e.message.length, `${e.code} 的 message 不得為空`).toBeGreaterThan(0)
    }
  })

  it('test_a5_lint_clean_case_forbidden_forms_as_text: 內容文字含禁形字樣的文件 lint exit 0', () => {
    const artifact = `${OUT_DIR}/clean-forms.html`
    expect(runCli(['render', 'fixtures/clean/forbidden-forms.md', '-o', artifact]).code).toBe(0)

    const r = runCli(['lint', artifact, '--json'])
    expect(JSON.parse(r.stdout).errors ?? []).toEqual([])
    expect(r.code).toBe(0)
  })

  it('test_a5_lint_clean_case_html_comment: 內容含 `<!--` 的文件 lint exit 0（IR 仍可解析）', () => {
    const artifact = `${OUT_DIR}/clean-comment.html`
    expect(runCli(['render', 'fixtures/clean/html-comment.md', '-o', artifact]).code).toBe(0)

    const r = runCli(['lint', artifact, '--json'])
    expect(JSON.parse(r.stdout).errors ?? []).toEqual([])
    expect(r.code).toBe(0)
  })

  it('test_a5_lint_still_catches_live_markup_in_raw_island: raw 島嶼裡的活外部 script 仍須擋下', () => {
    const artifact = `${OUT_DIR}/island-external.html`
    expect(
      runCli(['render', 'fixtures/broken/raw-island-external.md', '-o', artifact]).code,
    ).toBe(0)

    const r = runCli(['lint', artifact, '--json'])
    expect(r.code).toBe(1)
    expect(JSON.parse(r.stdout).errors.map((e) => e.code)).toContain('KSB_EXTERNAL_SCRIPT')
  })

  it('test_a5_lint_catches_live_css_in_raw_island: 島嶼內活 CSS 的兩個禁形皆須擋下', () => {
    const artifact = `${OUT_DIR}/island-css.html`
    expect(runCli(['render', 'fixtures/broken/raw-island-css.md', '-o', artifact]).code).toBe(0)

    const r = runCli(['lint', artifact, '--json'])
    expect(r.code).toBe(1)
    const codes = JSON.parse(r.stdout).errors.map((e) => e.code)
    expect(codes).toContain('KSB_EXTERNAL_CSS_IMPORT')
    expect(codes).toContain('KSB_EXTERNAL_CSS_URL')
  })

  it('test_a5_lint_catches_every_external_form: 五條禁形規則每條都有「該擋而擋」的正向案', () => {
    const artifact = `${OUT_DIR}/all-forms.html`
    expect(runCli(['render', 'fixtures/broken/all-external-forms.md', '-o', artifact]).code).toBe(0)

    const r = runCli(['lint', artifact, '--json'])
    expect(r.code).toBe(1)
    const errors = JSON.parse(r.stdout).errors
    const got = new Set(errors.map((e) => e.code))

    // 五碼各自的診斷文字都要有內容，且逐字帶出合約的禁形字樣
    for (const err of errors) {
      expect(err.message.length, `${err.code} 的 message 不得為空`).toBeGreaterThan(0)
      const rule = EXTERNAL_RULES.find((x) => x.code === err.code)
      if (rule) expect(err.message, `${err.code} 的診斷須含禁形字樣`).toContain(rule.what)
    }

    // 由規則清單反推應有的錯誤碼：日後新增規則卻沒有 fixture 會直接失敗，
    // 而不是靜靜地多一條從未被觸發過的死規則。
    const expected = EXTERNAL_RULES.map((rule) => rule.code)
    expect(expected).toHaveLength(5)
    const uncovered = expected.filter((code) => !got.has(code))
    expect(uncovered, `這些禁形規則沒有正向案：${uncovered.join(', ')}`).toEqual([])
  })

  it('test_a5_lint_fails_on_schema_invalid_ir: IR 可解析但不合 schema → exit 1 且錯誤指到 block path', () => {
    const r = runCli(['lint', 'fixtures/broken/ir-schema-invalid.html', '--json'])
    expect(r.code).toBe(1)
    const errors = JSON.parse(r.stdout).errors
    expect(errors.map((e) => e.code)).toContain('KSB_IR_SCHEMA')

    // path 必須指到出問題的 block，不能一律回根節點——Agent 靠它定位
    const schemaErrors = errors.filter((e) => e.code === 'KSB_IR_SCHEMA')
    expect(schemaErrors.some((e) => e.path.includes('children[0]'))).toBe(true)
    expect(schemaErrors.every((e) => e.path === '$')).toBe(false)
  })

  it('test_a5_lint_fails_on_banned_font_string: 夾帶禁用字體字串 → exit 1 KSB_BANNED_FONT', () => {
    const r = runCli(['lint', 'fixtures/broken/banned-font.html', '--json'])
    expect(r.code).toBe(1)
    const codes = JSON.parse(r.stdout).errors.map((e) => e.code)
    expect(codes).toContain('KSB_BANNED_FONT')
    // 這份產物本身零外部請求、IR 也合法：禁字串規則須獨立成立
    expect(codes).not.toContain('KSB_IR_MISSING')
    expect(codes.some((c) => c.startsWith('KSB_EXTERNAL_'))).toBe(false)
  })

  it('test_a5_lint_missing_target_is_usage_error: 目標不存在 exit 2', () => {
    const r = runCli(['lint', 'fixtures/broken/does-not-exist.html', '--json'])
    expect(r.code).toBe(2)
    expect(JSON.parse(r.stdout).ok).toBe(false)
  })
})

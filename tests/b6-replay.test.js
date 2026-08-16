import { readFileSync, rmSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, repoRoot } from './helpers.js'

const OUT_DIR = outDir('b6')
const SAMPLE = `${repoRoot}/fixtures/book-sample.md`
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-16T00:00:00.000Z' }
const ORIGINAL = `${OUT_DIR}/original.html`

describe('B6 replay 由內嵌 IR 重繪', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    const r = runCli(['render', SAMPLE, '-o', ORIGINAL, '--project', 'b6-proj', '--json'], {
      env: PINNED,
    })
    expect(r.code).toBe(0)
  })

  it('test_replay_json_shape: replay --json 與 render 同形（ok/artifact/bytes/archived）', () => {
    const r = runCli(
      ['replay', ORIGINAL, '-o', `${OUT_DIR}/shape.html`, '--project', 'b6-proj', '--json'],
      { env: PINNED },
    )
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(Object.keys(out).sort()).toEqual(['archived', 'artifact', 'bytes', 'ok'])
    expect(out.ok).toBe(true)
    expect(isAbsolute(out.artifact)).toBe(true)
    expect(isAbsolute(out.archived)).toBe(true)
    expect(out.bytes).toBe(readFileSync(out.artifact).length)
  })

  it('test_b6_replay_byte_identical: 固定 KAMISHIBAI_BUILD_TIME 下與原 render 逐位元相同', () => {
    const replayed = `${OUT_DIR}/replayed.html`
    const r = runCli(['replay', ORIGINAL, '-o', replayed, '--project', 'b6-proj', '--json'], {
      env: PINNED,
    })
    expect(r.code).toBe(0)

    const before = readFileSync(ORIGINAL)
    const after = readFileSync(replayed)
    expect(after.equals(before), 'replay 產物必須與原 render 逐位元相同').toBe(true)

    // 正本亦同：歸檔的是同一份位元組
    expect(readFileSync(JSON.parse(r.stdout).archived).equals(before)).toBe(true)

    // 二次 replay 仍冪等
    const again = `${OUT_DIR}/replayed2.html`
    expect(
      runCli(['replay', replayed, '-o', again, '--project', 'b6-proj'], { env: PINNED }).code,
    ).toBe(0)
    expect(readFileSync(again).equals(before)).toBe(true)
  })

  it('test_b6_replay_missing_ir: 無內嵌 IR 的檔案 → exit 1 KSB_IR_MISSING', () => {
    const r = runCli([
      'replay',
      'fixtures/broken/no-ir.html',
      '-o',
      `${OUT_DIR}/never.html`,
      '--json',
    ])
    expect(r.code).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors[0].code).toBe('KSB_IR_MISSING')
  })

  it('test_b6_replay_rejects_schema_invalid_ir: IR 不合 schema → exit 1，錯誤指到 block 路徑', () => {
    const r = runCli([
      'replay',
      'fixtures/broken/ir-schema-invalid.html',
      '-o',
      `${OUT_DIR}/never2.html`,
      '--json',
    ])
    expect(r.code).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors.length).toBeGreaterThan(0)
    expect(out.errors[0].code).toMatch(/^KSB_/)
  })
})

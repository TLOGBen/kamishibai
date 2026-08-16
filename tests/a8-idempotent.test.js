import { readFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir } from './helpers.js'

const OUT_DIR = outDir('a8')
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-16T09:30:00.000Z' }
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

/**
 * 每個冪等案都要跑兩次完整渲染（字體子集化是大宗成本），單案實測已達
 * 3.5–4.2s，逼近 vitest 預設的 5s。這不是慢測試該被容忍，而是預設值本來
 * 就不適用於「一個測試 = 兩次真渲染」的量級——給足餘裕，避免機器負載
 * 波動時變成假紅。與 a6 的大檔管線案同因同修。
 */
describe('A8 冪等', { timeout: 30_000 }, () => {
  beforeAll(() => rmSync(OUT_DIR, { recursive: true, force: true }))

  it('test_a8_render_byte_identical: 固定 KAMISHIBAI_BUILD_TIME 後同輸入連跑兩次 byte-identical', () => {
    const first = `${OUT_DIR}/one.html`
    const second = `${OUT_DIR}/two.html`
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', first], { env: PINNED }).code).toBe(0)
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', second], { env: PINNED }).code).toBe(0)

    expect(readFileSync(first)).toEqual(readFileSync(second))
    expect(sha(first)).toBe(sha(second))
  })

  it('test_a8_build_time_is_honoured: 產物 createdAt 即環境變數所釘時間', () => {
    const artifact = `${OUT_DIR}/pinned.html`
    runCli(['render', 'fixtures/book-sample.md', '-o', artifact], { env: PINNED })
    const html = readFileSync(artifact, 'utf8')
    expect(html).toContain(`"createdAt":"${PINNED.KAMISHIBAI_BUILD_TIME}"`)
  })

  it('test_a8_output_path_does_not_leak_into_artifact: 產物內容不隨輸出路徑改變', () => {
    const nested = `${OUT_DIR}/deep/nested/dir/three.html`
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', nested], { env: PINNED }).code).toBe(0)
    expect(readFileSync(nested)).toEqual(readFileSync(`${OUT_DIR}/one.html`))
  })
})

import { readFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir } from './helpers.js'

const OUT_DIR = outDir('a8')
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-16T09:30:00.000Z' }
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

describe('A8 冪等', () => {
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

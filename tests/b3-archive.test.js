import { readFileSync, rmSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir } from './helpers.js'

const OUT_DIR = outDir('b3')
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-16T00:00:00.000Z' }

describe('B3 render 自動歸檔', () => {
  beforeAll(() => rmSync(OUT_DIR, { recursive: true, force: true }))

  it('test_b3_archived_copy_is_byte_identical: 中央庫正本與投遞副本逐位元相同', () => {
    const copy = `${OUT_DIR}/book.html`
    const r = runCli(
      ['render', 'fixtures/book-sample.md', '-o', copy, '--project', 'b3-proj', '--json'],
      { env: PINNED },
    )
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)

    expect(isAbsolute(out.archived), 'archived 必須是絕對路徑').toBe(true)
    expect(out.archived).not.toBe(out.artifact)

    const canonical = readFileSync(out.archived)
    const delivered = readFileSync(out.artifact)
    expect(canonical.equals(delivered), '正本與副本必須逐位元相同').toBe(true)
    expect(canonical.length).toBe(out.bytes)
  })

  it('test_b3_archive_happens_without_out_flag: 未指定 -o 時仍歸檔正本', () => {
    const r = runCli(['render', 'fixtures/book-sample.md', '--project', 'b3-default', '--json'], {
      env: PINNED,
    })
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(readFileSync(out.archived).equals(readFileSync(out.artifact))).toBe(true)
  })
})

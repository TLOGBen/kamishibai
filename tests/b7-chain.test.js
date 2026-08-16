import { readFileSync, rmSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, repoRoot, testHome } from './helpers.js'

const OUT_DIR = outDir('b7')
const SAMPLE = `${repoRoot}/fixtures/book-sample.md`
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-16T00:00:00.000Z' }
const PROJECT = 'b7-chain'

describe('B7 交付鏈端到端', () => {
  beforeAll(() => rmSync(OUT_DIR, { recursive: true, force: true }))

  it('test_b7_end_to_end_chain: render→list→open --dry-run→replay 全鏈於測試 HOME 內', () => {
    // 1. render — 正本入庫、副本落交付路徑
    const copy = `${OUT_DIR}/book.html`
    const rendered = runCli(
      ['render', SAMPLE, '-o', copy, '--project', PROJECT, '--json'],
      { env: PINNED },
    )
    expect(rendered.code, 'render exit').toBe(0)
    const render = JSON.parse(rendered.stdout)
    expect(render.archived.startsWith(testHome), '正本必須落在測試 HOME 內').toBe(true)

    // 2. list — 呈現史看得到這份產物，副本落點記入索引
    const listed = runCli(['list', '--project', PROJECT, '--json'])
    expect(listed.code, 'list exit').toBe(0)
    const entries = JSON.parse(listed.stdout)
    expect(entries.length).toBe(1)
    expect(entries[0].artifact).toBe(render.archived)
    expect(entries[0].copies).toContain(render.artifact)

    // 3. open --dry-run — 由名稱解析回同一份正本
    const opened = runCli([
      'open',
      entries[0].name,
      '--project',
      PROJECT,
      '--dry-run',
      '--json',
    ])
    expect(opened.code, 'open exit').toBe(0)
    expect(JSON.parse(opened.stdout).path).toBe(render.archived)

    // 4. replay — 由正本內嵌 IR 重繪，回到同一份位元組
    const out = `${OUT_DIR}/replayed.html`
    const replayed = runCli(
      ['replay', render.archived, '-o', out, '--project', PROJECT, '--json'],
      { env: PINNED },
    )
    expect(replayed.code, 'replay exit').toBe(0)
    expect(readFileSync(out).equals(readFileSync(copy))).toBe(true)

    // 5. lint — 重繪產物仍是合法離線單檔
    expect(runCli(['lint', out, '--json']).code, 'lint exit').toBe(0)

    // 全鏈跑完，庫內恰兩份正本（render 一份、replay 一份）
    const after = JSON.parse(runCli(['list', '--project', PROJECT, '--json']).stdout)
    expect(after.length).toBe(2)
    expect(after.every((e) => e.artifact.startsWith(testHome))).toBe(true)
  })
})

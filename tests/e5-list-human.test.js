import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { runCli, outDir, repoRoot } from './helpers.js'

/**
 * CONTRACT E5 — closing F9/F10's register item: `list`'s human path.
 *
 * B4 pinned the `--json` shape and left the human rendering asserted only for
 * the fields that happened to be easy. That gap is the two-path drift the
 * formatter exists to prevent: a key can disappear from the human output while
 * every JSON test stays green, and the person reading the terminal is the one
 * who never finds out. So every key of every entry — including each copy line —
 * is asserted here on the real CLI path, and the empty case is pinned verbatim.
 */

const OUT_DIR = outDir('e5')
const SAMPLE = `${repoRoot}/fixtures/book-sample.md`
const PROJECT = 'e5-list-human'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-18T09:30:00.000Z' }
const GENERATOR = 'e5-generator'

/** Verbatim CONTRACT constant. */
const EMPTY_PROJECT_LINE = '（此專案尚無產物）'

const parseOne = (stdout) => JSON.parse(stdout)

describe('E5 list 人讀路逐欄釘死', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
  })

  it('test_e5_empty_project_line_is_verbatim: 空專案的人讀路是那一行，逐字元相同', () => {
    const r = runCli(['list', '--project', 'e5-nothing-here'])
    expect(r.code, 'list exit').toBe(0)
    expect(r.stdout, '空專案只印那一行').toBe(`${EMPTY_PROJECT_LINE}\n`)

    const json = runCli(['list', '--project', 'e5-nothing-here', '--json'])
    expect(json.code).toBe(0)
    expect(parseOne(json.stdout), '同一件事的機器可讀形是空陣列').toEqual([])
  })

  it('test_e5_human_path_shows_every_key_including_every_copy: 六個欄位與每一條副本都要看得見', () => {
    // 兩份副本，才問得出「每一條 copies 行」而不是「至少一條」
    const first = join(OUT_DIR, 'first.html')
    const second = join(OUT_DIR, 'nested', 'second.html')
    for (const out of [first, second]) {
      const r = runCli(
        ['render', SAMPLE, '-o', out, '--project', PROJECT, '-g', GENERATOR, '--json'],
        { env: PINNED },
      )
      expect(r.code, `render exit（stderr: ${r.stderr}）`).toBe(0)
    }

    const entries = parseOne(runCli(['list', '--project', PROJECT, '--json']).stdout)
    expect(entries.length, '兩次 render 應留下兩份正本').toBe(2)

    const human = runCli(['list', '--project', PROJECT])
    expect(human.code, 'list 人讀路 exit').toBe(0)

    for (const entry of entries) {
      expect(entry.createdAt, 'createdAt 應為釘住的建構時間').toBe(PINNED.KAMISHIBAI_BUILD_TIME)
      expect(entry.generator, 'generator 應為 -g 指定值').toBe(GENERATOR)
      expect(entry.copies.length, '每份正本都應記到一條副本落點').toBe(1)

      for (const key of ['name', 'template', 'createdAt', 'generator', 'artifact']) {
        expect(human.stdout, `人讀路缺少 ${key}：${entry[key]}`).toContain(String(entry[key]))
      }
      for (const copy of entry.copies) {
        expect(human.stdout, `人讀路缺少副本行 ${copy}`).toContain(`  副本 → ${copy}`)
      }
      expect(human.stdout, '正本行的格式也要在').toContain(`  正本 → ${entry.artifact}`)
    }

    // 兩條不同的副本路徑都出現過——否則「每一條」會被「印了其中一條」蒙混
    const copies = entries.flatMap((e) => e.copies)
    expect(new Set(copies).size, '兩份副本應落在不同路徑').toBe(2)
    for (const copy of copies) expect(human.stdout).toContain(copy)
  })
})

import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { describe, it, expect } from 'vitest'
import { runCli, outDir, repoRoot } from './helpers.js'

const OUT_DIR = outDir('b5')
const SAMPLE = `${repoRoot}/fixtures/book-sample.md`
const PROJECT = 'b5-proj'

const render = (out, extra = []) => {
  const r = runCli(['render', SAMPLE, '-o', out, '--project', PROJECT, '--json', ...extra])
  expect(r.code).toBe(0)
  return JSON.parse(r.stdout)
}

describe('B5 open 解析', () => {
  it('test_open_dry_run: --dry-run 輸出目標絕對路徑一行、exit 0、不開瀏覽器', () => {
    const first = render(`${OUT_DIR}/one.html`)

    const human = runCli(['open', 'book-sample', '--project', PROJECT, '--dry-run'])
    expect(human.code).toBe(0)
    expect(human.stdout.trimEnd().split('\n')).toEqual([first.archived])
    expect(isAbsolute(human.stdout.trim())).toBe(true)
    expect(existsSync(human.stdout.trim())).toBe(true)

    const json = runCli(['open', 'book-sample', '--project', PROJECT, '--dry-run', '--json'])
    expect(json.code).toBe(0)
    const out = JSON.parse(json.stdout)
    expect(Object.keys(out).sort()).toEqual(['ok', 'path'])
    expect(out.ok).toBe(true)
    expect(out.path).toBe(first.archived)

    // 帶副檔名的寫法同樣可解析
    const withExt = runCli(['open', 'book-sample.html', '--project', PROJECT, '--dry-run', '--json'])
    expect(JSON.parse(withExt.stdout).path).toBe(first.archived)
  })

  it('test_b5_open_latest_points_at_newest: latest 解析為最新一份正本', async () => {
    const first = runCli(['open', 'latest', '--project', PROJECT, '--dry-run', '--json'])
    expect(first.code).toBe(0)

    await new Promise((r) => setTimeout(r, 20))
    const second = render(`${OUT_DIR}/two.html`)
    expect(second.archived).not.toBe(JSON.parse(first.stdout).path)

    const latest = runCli(['open', 'latest', '--project', PROJECT, '--dry-run', '--json'])
    expect(latest.code).toBe(0)
    expect(JSON.parse(latest.stdout).path).toBe(second.archived)
  })

  it('test_b5_open_not_found_is_ksb_artifact_not_found: 查無 → exit 1 KSB_ARTIFACT_NOT_FOUND', () => {
    const r = runCli(['open', 'no-such-artifact', '--project', PROJECT, '--dry-run', '--json'])
    expect(r.code).toBe(1)
    const out = JSON.parse(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors[0].code).toBe('KSB_ARTIFACT_NOT_FOUND')

    // 空專案的 latest 同樣是「查無」，不是崩潰
    const empty = runCli(['open', 'latest', '--project', 'b5-empty', '--dry-run', '--json'])
    expect(empty.code).toBe(1)
    expect(JSON.parse(empty.stdout).errors[0].code).toBe('KSB_ARTIFACT_NOT_FOUND')
  })
})

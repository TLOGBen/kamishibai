import { readFileSync, readdirSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { runCli, outDir, repoRoot } from './helpers.js'

const OUT_DIR = outDir('d7')
const DOC_SOURCE = `${repoRoot}/fixtures/diagram-sample.md`
const DECK_SOURCE = `${repoRoot}/fixtures/slides-sample.md`
const DOC = `${OUT_DIR}/doc.html`
const DECK = `${OUT_DIR}/deck.html`
const PROJECT = 'd7-conventions'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-17T00:00:00.000Z' }
const BROWSER_TIMEOUT = 180_000

const NEW_COMMANDS = Object.freeze(['export', 'snapshot', 'setup'])
/** Only the export layer may reach for a browser or an OOXML writer. */
const HEAVY_DEPS = Object.freeze(['playwright', 'pptxgenjs'])

const parseOne = (stdout) => JSON.parse(stdout)

const gate = parseOne(runCli(['setup', '--dry-run', '--json'], { env: PINNED }).stdout)
const hasBrowser = gate.browser === 'present'

const walkFiles = (dir) => {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkFiles(full))
    else if (full.endsWith('.js')) out.push(full)
  }
  return out
}

describe('D7 新指令沿用既有慣例與分層', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
    for (const [source, out] of [
      [DOC_SOURCE, DOC],
      [DECK_SOURCE, DECK],
    ]) {
      expect(
        runCli(['render', source, '-o', out, '--project', PROJECT], { env: PINNED }).code,
      ).toBe(0)
    }
  })

  it('test_d7_new_commands_appear_in_help: 三個新指令進入 help 通道', () => {
    const help = parseOne(runCli(['--help', '--json']).stdout).help
    for (const command of NEW_COMMANDS) {
      expect(help, `help 缺少 ${command}`).toContain(command)
    }
  })

  it('test_d7_new_commands_classify_exit_codes: 失敗路 exit 1/2 與 KSB_ 碼皆穩定', () => {
    const cases = [
      { args: ['export', DECK, '--to', 'pdf', '--json'], code: 1 },
      { args: ['export', DOC, '--to', 'docx', '--json'], code: 2 },
      { args: ['export', 'fixtures/does-not-exist.html', '--to', 'pdf', '--json'], code: 2 },
      { args: ['export', 'fixtures/broken/no-ir.html', '--to', 'pdf', '--json'], code: 1 },
      { args: ['snapshot', 'fixtures/does-not-exist.html', '--json'], code: 2 },
      { args: ['snapshot', 'fixtures/broken/no-ir.html', '--json'], code: 1 },
      { args: ['snapshot', '--json'], code: 2 },
      { args: ['export', '--json'], code: 2 },
    ]
    for (const { args, code } of cases) {
      const r = runCli(args, { env: PINNED })
      expect(r.code, `[${args.join(' ')}] exit`).toBe(code)
      const out = parseOne(r.stdout)
      expect(out.ok, `[${args.join(' ')}] ok`).toBe(false)
      expect(out.errors[0].code, `[${args.join(' ')}] code`).toMatch(/^KSB_/)
    }
  })

  it('test_d7_setup_json_convention: setup 成功路為單一 JSON，人讀路同源', () => {
    const r = runCli(['setup', '--dry-run', '--json'], { env: PINNED })
    expect(r.code, `setup exit（stderr: ${r.stderr}）`).toBe(0)
    const json = parseOne(r.stdout)
    const human = runCli(['setup', '--dry-run'], { env: PINNED })
    expect(human.code).toBe(0)
    for (const [key, value] of Object.entries(json)) {
      if (key === 'ok') continue
      expect(human.stdout, `人讀路缺少 ${key}`).toContain(String(value))
    }
  }, BROWSER_TIMEOUT)

  it.skipIf(!hasBrowser)(
    'test_d7_export_snapshot_json_convention: export／snapshot 成功路為單一 JSON，人讀路同源',
    async () => {
      const runs = [
        { command: 'export', args: ['export', DOC, '--to', 'pdf', '-o', `${OUT_DIR}/d.pdf`] },
        { command: 'snapshot', args: ['snapshot', DECK, '-o', `${OUT_DIR}/d.png`, '--slide', '2'] },
      ]
      for (const { command, args } of runs) {
        const jsonRun = runCli([...args, '--json'], { env: PINNED })
        expect(jsonRun.code, `${command} --json exit（stderr: ${jsonRun.stderr}）`).toBe(0)
        const json = parseOne(jsonRun.stdout)

        const humanRun = runCli(args, { env: PINNED })
        expect(humanRun.code, `${command} 人讀路 exit`).toBe(0)
        for (const [key, value] of Object.entries(json)) {
          if (key === 'ok') continue
          expect(humanRun.stdout, `${command} 人讀路缺少 ${key}`).toContain(String(value))
        }
      }
    },
    BROWSER_TIMEOUT,
  )

  it('test_d7_export_layer_isolates_browser_deps: 只有 export 層碰瀏覽器與 OOXML', () => {
    const files = walkFiles(join(repoRoot, 'src'))
    const offenders = []
    for (const file of files) {
      const code = readFileSync(file, 'utf8')
      for (const dep of HEAVY_DEPS) {
        const imported =
          new RegExp(`\\bfrom\\s+['"]${dep}(\\/[^'"]*)?['"]`).test(code) ||
          new RegExp(`\\bimport\\(\\s*['"]${dep}(\\/[^'"]*)?['"]`).test(code)
        if (imported && !file.includes('/src/export/')) offenders.push(`${file} → ${dep}`)
      }
    }
    expect(offenders, 'export 以外的層不得依賴瀏覽器／OOXML').toEqual([])
    expect(statSync(join(repoRoot, 'src/export')).isDirectory(), 'export 層應存在').toBe(true)
  })

  it('test_d7_export_layer_files_are_small: export 層每個檔案 ≤800 行', () => {
    const oversized = walkFiles(join(repoRoot, 'src/export'))
      .map((file) => ({ file, lines: readFileSync(file, 'utf8').split('\n').length }))
      .filter((entry) => entry.lines > 800)
    expect(oversized).toEqual([])
  })

  it('test_d7_diagram_survives_replay: 帶 diagram 的產物 replay 後位元組相同', () => {
    const replayed = `${OUT_DIR}/replayed.html`
    const r = runCli(['replay', DOC, '-o', replayed, '--project', PROJECT, '--json'], {
      env: PINNED,
    })
    expect(r.code, `replay exit（stderr: ${r.stderr}）`).toBe(0)
    expect(readFileSync(replayed, 'utf8'), 'diagram 的佈局必須可重繪出同樣位元組').toBe(
      readFileSync(DOC, 'utf8'),
    )
  })

  it('test_d7_diagram_rejected_on_replay_when_spec_broken: 壞 spec 的產物 replay 也要被擋', () => {
    // 手工把一份合法產物的內嵌 IR 改成懸空邊——模擬「產物被改壞後重繪」
    const html = readFileSync(DOC, 'utf8')
    const broken = html.replace(/"to":"parser"/, '"to":"ghost-node"')
    expect(broken, '前置條件：替換必須真的發生').not.toBe(html)
    const brokenPath = `${OUT_DIR}/broken-diagram.html`
    writeFileSync(brokenPath, broken, 'utf8')

    const r = runCli(['replay', brokenPath, '-o', `${OUT_DIR}/x.html`, '--json'], { env: PINNED })
    expect(r.code, '壞 spec 必須 exit 1').toBe(1)
    const out = parseOne(r.stdout)
    expect(out.errors[0].code).toBe('KSB_DIAGRAM_INVALID')
    expect(out.errors[0].message).toContain('ghost-node')
  })
})

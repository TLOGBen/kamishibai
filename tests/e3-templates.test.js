import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { runCli, outDir, repoRoot, testHome } from './helpers.js'
import { manifest as longFormManifest } from '../templates/kami/long-form/manifest.js'
import { manifest as slidesManifest } from '../templates/kami/slides/manifest.js'
import { parseToml, stringifyToml } from '../src/delivery/toml.js'
import { engineVersion } from '../src/core/version.js'

/**
 * CONTRACT E3 (VC2) — the template namespace, and E4 — `debug --json`.
 *
 * VC2's probe surface is deliberately a *file*: `manifest.toml` exists and
 * parses. That is the difference between "the engine happens to bundle two
 * templates" and "this installation has a template package registry", and it
 * is checkable without importing a line of the SDK.
 */

const OUT_DIR = outDir('e3')
const PROJECT = 'e3-templates'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-18T00:00:00.000Z' }
const BROWSER_TIMEOUT = 180_000

/** Verbatim CONTRACT constants. */
const TEMPLATES_LAYOUT = ['templates', '<namespace>', '<name>', 'manifest.toml']
const MANIFEST_KEYS = ['name', 'namespace', 'version', 'engine', 'root', 'blocks']
const TEMPLATE_LIST_KEYS = ['namespace', 'name', 'version', 'root']

const parseOne = (stdout) => JSON.parse(stdout)
const packagePath = (namespace, name) =>
  join(testHome, TEMPLATES_LAYOUT[0], namespace, name, TEMPLATES_LAYOUT[3])

/** The CLI's own answer about this machine, taken once (the d3/d7 precedent). */
const hasBrowser =
  parseOne(runCli(['setup', '--dry-run', '--json'], { env: PINNED }).stdout).browser === 'present'

describe('E3 模板命名空間（VC2）與 E4 debug', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
  })

  it('test_templates_json_shape: templates --json 列出兩個內建包，四鍵固定；人讀路同源', () => {
    const r = runCli(['templates', '--json'])
    expect(r.code, `templates exit（stderr: ${r.stderr}）`).toBe(0)
    const entries = parseOne(r.stdout)

    expect(Array.isArray(entries)).toBe(true)
    expect(entries.map((e) => `${e.namespace}/${e.name}`)).toEqual(['kami/long-form', 'kami/slides'])
    for (const entry of entries) {
      expect(Object.keys(entry), '每筆恰好四個鍵、順序固定').toEqual(TEMPLATE_LIST_KEYS)
      expect(entry.version).toBe('0.1.0')
    }
    expect(entries[0].root, 'long-form 不限根形，以空字串明說').toBe('')
    expect(entries[1].root, 'slides 的根形是 deck').toBe('deck')

    const human = runCli(['templates'])
    expect(human.code).toBe(0)
    for (const entry of entries) {
      expect(human.stdout).toContain(`${entry.namespace}/${entry.name}@${entry.version}`)
    }
    // root 也是 JSON 路的鍵之一，人讀路就必須說得出來——包含「不限」這個空字串的譯法
    expect(human.stdout, 'long-form 的 root 段').toContain('kami/long-form@0.1.0　root=（不限）')
    expect(human.stdout, 'slides 的 root 段').toContain('kami/slides@0.1.0　root=deck')
  })

  it('test_template_manifest_toml: manifest.toml 存在、可解析，且與 JS manifest 逐欄一致', () => {
    expect(runCli(['templates', '--json']).code).toBe(0)

    for (const manifest of [longFormManifest, slidesManifest]) {
      const path = packagePath(manifest.namespace, manifest.name)
      expect(existsSync(path), `${path} 應存在`).toBe(true)

      const table = parseToml(readFileSync(path, 'utf8'))
      expect(Object.keys(table), 'manifest.toml 的鍵與順序皆固定').toEqual(MANIFEST_KEYS)

      // 逐欄對帳：TOML 是 JS manifest 的投影，不是另一份宣稱
      expect(table.name).toBe(manifest.name)
      expect(table.namespace).toBe(manifest.namespace)
      expect(table.version).toBe(manifest.version)
      expect(table.engine).toBe(engineVersion())
      expect(table.root, '無根形限制以空字串表示').toBe(manifest.root ?? '')
      expect(table.blocks).toEqual([...manifest.blocks])

      // 位元組層級：重新序列化同一張表必須回到磁碟上的同一份位元組
      expect(stringifyToml(table)).toBe(readFileSync(path, 'utf8'))
    }
  })

  it('test_e3_templates_lists_what_is_on_disk_not_what_is_bundled: 手工放進庫裡的第三方包也要被列出', () => {
    const listingHome = join(testHome, 'third-party-home')
    rmSync(listingHome, { recursive: true, force: true })
    const env = { ...PINNED, KAMISHIBAI_HOME: listingHome }

    expect(runCli(['templates', '--json'], { env }).code).toBe(0)

    // 引擎不認得 acme/plain——它只存在於命名空間裡。listing 若是從內建註冊表算出來的，
    // 這一包就會人間蒸發，而 VC2 的探針面（「庫裡裝了什麼」）也就跟著失去意義。
    const dir = join(listingHome, 'templates', 'acme', 'plain')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'manifest.toml'),
      stringifyToml({
        name: 'plain',
        namespace: 'acme',
        version: '2.1.0',
        engine: engineVersion(),
        root: 'doc',
        blocks: ['doc', 'prose'],
      }),
      'utf8',
    )

    const entries = parseOne(runCli(['templates', '--json'], { env }).stdout)
    expect(entries.map((e) => `${e.namespace}/${e.name}`), '列出的是庫的內容，含第三方包').toEqual([
      'acme/plain',
      'kami/long-form',
      'kami/slides',
    ])
    const planted = entries.find((e) => e.namespace === 'acme')
    expect(planted).toEqual({ namespace: 'acme', name: 'plain', version: '2.1.0', root: 'doc' })
    expect(runCli(['templates'], { env }).stdout).toContain('acme/plain@2.1.0')

    // debug 的模板數同樣讀庫，不讀引擎
    expect(parseOne(runCli(['debug', '--json'], { env }).stdout).templates).toBe(3)
  }, BROWSER_TIMEOUT)

  it('test_e3_render_first_touch_registers_the_namespace: 沒跑過 setup、只 render 也會註冊模板包', () => {
    const freshHome = join(testHome, 'first-touch-home')
    rmSync(freshHome, { recursive: true, force: true })
    const env = { ...PINNED, KAMISHIBAI_HOME: freshHome }

    const r = runCli(
      ['render', `${repoRoot}/fixtures/book-sample.md`, '-o', join(OUT_DIR, 'first.html'), '--project', PROJECT, '--json'],
      { env },
    )
    expect(r.code, `render exit（stderr: ${r.stderr}）`).toBe(0)

    for (const [namespace, name] of [['kami', 'long-form'], ['kami', 'slides']]) {
      const path = join(freshHome, 'templates', namespace, name, 'manifest.toml')
      expect(existsSync(path), `首觸後 ${path} 應存在`).toBe(true)
      expect(parseToml(readFileSync(path, 'utf8')).name).toBe(name)
    }
    const listed = parseOne(runCli(['templates', '--json'], { env }).stdout)
    expect(listed).toHaveLength(2)
  })

  it(
    'test_e3_setup_registers_and_does_not_churn: setup 註冊模板包，重跑不改動已有的位元組',
    () => {
      const setupHome = join(testHome, 'setup-templates-home')
      rmSync(setupHome, { recursive: true, force: true })
      const env = { ...PINNED, KAMISHIBAI_HOME: setupHome }
      const path = join(setupHome, 'templates', 'kami', 'long-form', 'manifest.toml')

      const dry = runCli(['setup', '--dry-run', '--json'], { env })
      expect(dry.code, `setup --dry-run exit（stderr: ${dry.stderr}）`).toBe(0)
      expect(existsSync(setupHome), '--dry-run 不得建立任何東西').toBe(false)

      if (hasBrowser) {
        const real = runCli(['setup', '--json'], { env })
        expect(real.code, `setup exit（stderr: ${real.stderr}）`).toBe(0)
        expect(Object.keys(parseOne(real.stdout)).sort(), 'setup 的鍵組不得因 S5 而改變').toEqual([
          'browser',
          'command',
          'home',
          'ok',
        ])
      } else {
        // 沒有瀏覽器時 setup 會嘗試安裝；改由同樣註冊的另一條首觸路徑收斂
        expect(runCli(['templates', '--json'], { env }).code).toBe(0)
      }
      expect(existsSync(path), 'setup（或首觸）之後 manifest 應存在').toBe(true)

      const first = readFileSync(path, 'utf8')
      expect(runCli(['templates', '--json'], { env }).code).toBe(0)
      expect(readFileSync(path, 'utf8'), '重跑不得改動已一致的 manifest').toBe(first)
    },
    BROWSER_TIMEOUT,
  )

  it('test_e3_render_still_resolves_builtins_without_the_namespace: 命名空間被刪掉，內建模板仍然畫得出來', () => {
    const strippedHome = join(testHome, 'stripped-home')
    rmSync(strippedHome, { recursive: true, force: true })
    const env = { ...PINNED, KAMISHIBAI_HOME: strippedHome }
    const out = join(OUT_DIR, 'stripped.html')

    expect(runCli(['templates', '--json'], { env }).code).toBe(0)
    rmSync(join(strippedHome, 'templates'), { recursive: true, force: true })

    const r = runCli(
      ['render', `${repoRoot}/fixtures/slides-sample.md`, '-o', out, '-t', 'kami/slides', '--project', PROJECT, '--json'],
      { env },
    )
    expect(r.code, `render exit（stderr: ${r.stderr}）`).toBe(0)
    expect(runCli(['lint', out, '--json']).code).toBe(0)
  })

  it(
    'test_e4_debug_json_shape: debug --json 是單一物件，報庫位置／模板數／瀏覽器／引擎；人讀路同源',
    () => {
      const r = runCli(['debug', '--json'], { env: PINNED })
      expect(r.code, `debug exit（stderr: ${r.stderr}）`).toBe(0)
      const json = parseOne(r.stdout)

      expect(Object.keys(json).sort()).toEqual(['browser', 'engine', 'home', 'ok', 'servers', 'templates'])
      expect(json.home).toBe(testHome)
      expect(json.templates, '兩個內建模板包').toBe(2)
      expect(['present', 'missing'], 'browser 只有兩種誠實答案').toContain(json.browser)
      expect(json.engine).toBe(engineVersion())

      const human = runCli(['debug'], { env: PINNED })
      expect(human.code).toBe(0)
      for (const [key, value] of Object.entries(json)) {
        if (key === 'ok') continue
        expect(human.stdout, `人讀路缺少 ${key}`).toContain(String(value))
      }
    },
    BROWSER_TIMEOUT,
  )

  it('test_e3_toml_round_trip_rejects_what_it_cannot_have_written: 壞 TOML 不得半解析', () => {
    expect(() => parseToml('name = "kami"\nversion = 1\n')).toThrow(/version/)
    expect(() => parseToml('這行不是鍵值對\n')).toThrow(/key\/value/)
    expect(parseToml('# 註解\n\nname = "a"\nblocks = []\n')).toEqual({ name: 'a', blocks: [] })
    expect(stringifyToml({ name: 'a"b', blocks: ['x', 'y'] })).toBe('name = "a\\"b"\nblocks = ["x", "y"]\n')
  })
})

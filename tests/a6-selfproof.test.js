import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import Ajv2020Module from 'ajv/dist/2020.js'
import { describe, it, expect } from 'vitest'
import { runCli, outDir, extractIrScripts, cliPath, repoRoot } from './helpers.js'

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module
const OUT_DIR = outDir('a6')
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-16T00:00:00.000Z' }

describe('A6 防試錯自證', () => {
  it('test_example_roundtrip: example doc 的輸出可直接餵回 render -', () => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    const example = runCli(['example', 'doc'])
    expect(example.code).toBe(0)
    expect(example.stdout.trimStart().startsWith('---')).toBe(true)

    const rendered = runCli(['render', '-', '-o', `${OUT_DIR}/e.html`], { input: example.stdout })
    expect(rendered.code).toBe(0)

    const html = readFileSync(`${OUT_DIR}/e.html`, 'utf8')
    expect(extractIrScripts(html)).toHaveLength(1)
    expect(runCli(['lint', `${OUT_DIR}/e.html`]).code).toBe(0)

    // example 是 Agent 的教材：不能缺構件，尤其不能缺曾經踩雷的清單。
    // 缺了的話 Agent 就學不到「清單也是合法輸入」。
    expect(example.stdout, 'example doc 應示範無序清單').toMatch(/^-\s+\S/m)
    expect(example.stdout, 'example doc 應示範有序清單').toMatch(/^\d+\.\s+\S/m)

    const body = html.slice(html.indexOf('<body>'), html.indexOf('<script type='))
    expect(body).toMatch(/<div class="prose">\s*<ul>/)
    expect(body).toMatch(/<div class="prose">\s*<ol>/)
    // 教材本身也不得產出無效 HTML
    for (const [, inner] of body.matchAll(/<p class="prose">([\s\S]*?)<\/p>/g)) {
      expect(/<(ul|ol|div|pre|table|blockquote)\b/i.test(inner)).toBe(false)
    }
  })

  it('test_a6_shell_pipe_roundtrip: 合約字面的 shell pipeline（真實非阻塞 stdin）exit 0', () => {
    const target = `${OUT_DIR}/piped.html`
    const node = process.execPath
    execSync(
      `"${node}" "${cliPath}" example doc | "${node}" "${cliPath}" render - -o "${target}"`,
      { cwd: repoRoot, stdio: 'pipe' },
    )
    expect(existsSync(target)).toBe(true)
    expect(extractIrScripts(readFileSync(target, 'utf8'))).toHaveLength(1)
  })

  it('test_a6_pipe_survives_multiple_chunks: >64KB 管線輸入與同檔案渲染 byte-identical', () => {
    // 重複次數由 fixture 大小推算：語料日後增刪都自動維持「剛好跨過一個
    // 64KiB readSync 緩衝」的量級，不會因為寫死次數而變成無謂的巨檔。
    const unit = readFileSync(join(repoRoot, 'fixtures/book-sample.md'), 'utf8')
    const repeats = Math.ceil(80_000 / Buffer.byteLength(unit, 'utf8'))
    const source = unit.repeat(repeats)

    mkdirSync(OUT_DIR, { recursive: true })
    const bigInput = join(OUT_DIR, 'big-input.md')
    writeFileSync(bigInput, source, 'utf8')
    // 必須真的跨過單次 readSync 的 64KiB 緩衝，否則測不到分段讀取
    expect(Buffer.byteLength(source, 'utf8')).toBeGreaterThan(65536)

    const viaFile = join(OUT_DIR, 'big-via-file.html')
    const viaPipe = join(OUT_DIR, 'big-via-pipe.html')
    expect(runCli(['render', bigInput, '-o', viaFile], { env: PINNED }).code).toBe(0)

    const node = process.execPath
    execSync(`cat "${bigInput}" | "${node}" "${cliPath}" render - -o "${viaPipe}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
      env: { ...process.env, ...PINNED },
    })

    // 位元相等才抓得到「靜默截斷」——被截斷的管線讀取一樣 exit 0、一樣有合法 IR
    expect(readFileSync(viaPipe)).toEqual(readFileSync(viaFile))
  }, 30_000) // 兩次大文件全渲染，預設 5s 不夠

  it('test_a6_pipe_survives_stalling_writer: 寫入端多次長暫停（累計 >10s）仍讀滿不截斷', () => {
    mkdirSync(OUT_DIR, { recursive: true })
    const payload = join(OUT_DIR, 'stall-input.md')
    writeFileSync(payload, runCli(['example', 'doc']).stdout, 'utf8')

    // 分 4 段、每段間隔 4.5s：EAGAIN 重試預算若不在每次成功讀取後歸零，
    // 累計等待就會吃光 ~10s 的額度而誤判為讀取失敗。
    const writer = join(OUT_DIR, 'stall-writer.mjs')
    writeFileSync(
      writer,
      [
        "import { readFileSync } from 'node:fs'",
        'const data = readFileSync(process.argv[2])',
        'const size = Math.ceil(data.length / 4)',
        'let i = 0',
        'const tick = () => {',
        '  process.stdout.write(data.subarray(i, i + size))',
        '  i += size',
        '  if (i < data.length) setTimeout(tick, 4500)',
        '}',
        'tick()',
      ].join('\n'),
      'utf8',
    )

    const node = process.execPath
    const viaStall = join(OUT_DIR, 'stalled.html')
    const viaFile = join(OUT_DIR, 'stall-direct.html')
    expect(runCli(['render', payload, '-o', viaFile], { env: PINNED }).code).toBe(0)

    execSync(`"${node}" "${writer}" "${payload}" | "${node}" "${cliPath}" render - -o "${viaStall}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
      env: { ...process.env, ...PINNED },
    })

    expect(readFileSync(viaStall)).toEqual(readFileSync(viaFile))
  }, 60_000)

  it('test_schema_valid: schema 輸出合法 draft 2020-12 Schema，且 A2 的 IR 通過驗證', () => {
    const schemaRun = runCli(['schema'])
    expect(schemaRun.code).toBe(0)
    const schema = JSON.parse(schemaRun.stdout)
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')

    const artifact = `${OUT_DIR}/schema-subject.html`
    expect(runCli(['render', 'fixtures/book-sample.md', '-o', artifact]).code).toBe(0)
    const ir = JSON.parse(extractIrScripts(readFileSync(artifact, 'utf8'))[0])

    const ajv = new Ajv2020({ allErrors: true, strict: false })
    const validate = ajv.compile(schema)
    const valid = validate(ir)
    expect(validate.errors ?? []).toEqual([])
    expect(valid).toBe(true)
  })

  it('test_a6_schema_rejects_malformed_ir: schema 能擋下缺欄位／型別錯誤的 IR', () => {
    const schema = JSON.parse(runCli(['schema']).stdout)
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    const validate = ajv.compile(schema)

    expect(validate({ irVersion: '1' })).toBe(false)
    expect(
      validate({
        irVersion: '1',
        engine: '0.1.0',
        template: { namespace: 'kami', name: 'long-form', version: '0.1.0' },
        doc: { id: 'b1', type: 'doc', meta: { title: 't' }, children: [{ id: 'b2', type: 'raw' }] },
        createdAt: '2026-08-16T00:00:00.000Z',
        generator: 'test',
      }),
    ).toBe(false)
  })
})

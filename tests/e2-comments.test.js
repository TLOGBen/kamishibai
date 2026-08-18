import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCli, outDir, repoRoot, testHome, extractIrScripts } from './helpers.js'

/**
 * CONTRACT E2 — the block-anchored comment loop.
 *
 * The two properties under test are the ones that make a comment worth
 * anything to an Agent: it names a block that really exists, and the log never
 * forgets what was said. The third is what makes the artifact still an
 * artifact: the dev overlay exists only while `serve` is running.
 */

const OUT_DIR = outDir('e2')
const SOURCE = join(OUT_DIR, 'commented.md')
const COPY = join(OUT_DIR, 'commented.html')
const PROJECT = 'e2-comments'
const PINNED = { KAMISHIBAI_BUILD_TIME: '2026-08-18T00:00:00.000Z' }
const SERVE_TIMEOUT = 40_000

/** Verbatim from src/serve/protocol.js — the token pinned absent from artifacts. */
const DEV_MARKER = 'kamishibai-dev-overlay'
const COMMENT_KEYS = ['id', 'blockId', 'text', 'ts', 'status']

const parseOne = (stdout) => JSON.parse(stdout)

const collect = (node, acc = []) => {
  acc.push(node)
  for (const child of node.children ?? []) collect(child, acc)
  for (const slide of node.slides ?? []) collect(slide, acc)
  for (const item of node.items ?? []) for (const child of item) collect(child, acc)
  return acc
}

const blockIdsOf = (path) =>
  collect(JSON.parse(extractIrScripts(readFileSync(path, 'utf8'))[0]).doc)
    .map((block) => block.id)
    .filter((id) => typeof id === 'string')

describe('E2 留言迴路：錨定 block、只追加、覆蓋層不入產物', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
    appendFileSync(
      SOURCE,
      ['---', 'title: 留言對象', '---', '', '# 章節', '', '第一段。', '', '第二段。', ''].join('\n'),
      'utf8',
    )
    expect(
      runCli(['render', SOURCE, '-o', COPY, '--project', PROJECT, '--json'], { env: PINNED }).code,
    ).toBe(0)
  })

  afterAll(() => runCli(['close', '--json']))

  it('test_comments_json_shape: comments --json 是恰好五鍵的物件陣列', () => {
    const ids = blockIdsOf(COPY)
    expect(ids.length, '語料應有多個 block').toBeGreaterThan(2)

    expect(runCli(['comments', COPY, '--json']).code).toBe(0)
    expect(parseOne(runCli(['comments', COPY, '--json']).stdout), '一開始沒有留言').toEqual([])

    expect(runCli(['comments', 'add', COPY, ids[1], '這段', '要改短', '--json']).code).toBe(0)
    expect(runCli(['comments', 'add', COPY, ids[2], '換成清單', '--json']).code).toBe(0)

    const entries = parseOne(runCli(['comments', COPY, '--json']).stdout)
    expect(Array.isArray(entries), '--json 必須是陣列').toBe(true)
    expect(entries).toHaveLength(2)
    for (const entry of entries) {
      expect(Object.keys(entry), '每筆留言恰好五個鍵、順序固定').toEqual(COMMENT_KEYS)
      expect(entry.status).toBe('open')
      expect(ids, '留言的 blockId 必須真的在 IR 裡').toContain(entry.blockId)
      expect(Number.isNaN(Date.parse(entry.ts)), 'ts 必須是可解析的時間').toBe(false)
    }
    expect(entries[0].text).toBe('這段 要改短')

    // 人讀路與 JSON 路同源
    const human = runCli(['comments', COPY])
    expect(human.code).toBe(0)
    for (const entry of entries) {
      for (const key of COMMENT_KEYS) {
        expect(human.stdout, `人讀路缺少 ${key}`).toContain(String(entry[key]))
      }
    }
  })

  it('test_e2_unknown_block_id_is_rejected: 未知 blockId → exit 1 KSB_BLOCK_NOT_FOUND，且不留下任何紀錄', () => {
    const sidecar = `${COPY}.comments.jsonl`
    const before = existsSync(sidecar) ? readFileSync(sidecar, 'utf8') : ''

    const r = runCli(['comments', 'add', COPY, 'b99999', '這個 block 不存在', '--json'])
    expect(r.code, '未知錨點必須 exit 1').toBe(1)
    const out = parseOne(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors[0].code).toBe('KSB_BLOCK_NOT_FOUND')
    expect(out.errors[0].message).toContain('b99999')

    const after = existsSync(sidecar) ? readFileSync(sidecar, 'utf8') : ''
    expect(after, '被拒絕的留言不得留下半行').toBe(before)
  })

  it('test_e2_resolve_appends_never_rewrites: resolve 追加一筆解決紀錄，原始那行原封不動', () => {
    const sidecar = `${COPY}.comments.jsonl`
    const before = readFileSync(sidecar, 'utf8')
    const lineCount = before.trim().split('\n').length

    const r = runCli(['comments', 'resolve', COPY, 'c1', '--json'])
    expect(r.code, 'resolve exit').toBe(0)
    expect(parseOne(r.stdout).status).toBe('resolved')

    const after = readFileSync(sidecar, 'utf8')
    expect(after.startsWith(before), '既有紀錄必須逐位元組保留').toBe(true)
    expect(after.trim().split('\n')).toHaveLength(lineCount + 1)

    const entries = parseOne(runCli(['comments', COPY, '--json']).stdout)
    expect(entries.find((e) => e.id === 'c1').status).toBe('resolved')
    expect(entries.find((e) => e.id === 'c2').status, '其他留言不受影響').toBe('open')
    expect(entries.map((e) => e.id), 'resolve 不得改變排序').toEqual(['c1', 'c2'])
  })

  it('test_e2_comments_failure_codes: 未知留言 id 與缺參數的失敗路穩定', () => {
    const cases = [
      { args: ['comments', 'resolve', COPY, 'c999', '--json'], code: 1, ksb: 'KSB_COMMENT_NOT_FOUND' },
      { args: ['comments', 'resolve', COPY, '--json'], code: 2, ksb: 'KSB_USAGE' },
      { args: ['comments', '--json'], code: 2, ksb: 'KSB_USAGE' },
      { args: ['comments', `${OUT_DIR}/missing.html`, '--json'], code: 2, ksb: 'KSB_INPUT_NOT_FOUND' },
      { args: ['comments', 'add', `${repoRoot}/fixtures/broken/no-ir.html`, 'b1', 'x', '--json'], code: 1, ksb: 'KSB_IR_MISSING' },
    ]
    for (const { args, code, ksb } of cases) {
      const r = runCli(args)
      expect(r.code, `[${args.join(' ')}] exit`).toBe(code)
      const out = parseOne(r.stdout)
      expect(out.ok).toBe(false)
      expect(out.errors[0].code, `[${args.join(' ')}] code`).toBe(ksb)
    }
  })

  it('test_overlay_absent_from_artifacts: 產物（render／replay／庫內正本）一律不得帶 dev 覆蓋層', () => {
    const rendered = readFileSync(COPY, 'utf8')
    expect(rendered, 'render 產物不得含 dev 覆蓋層').not.toContain(DEV_MARKER)
    expect(rendered).not.toContain('EventSource')

    const replayed = join(OUT_DIR, 'replayed.html')
    expect(runCli(['replay', COPY, '-o', replayed, '--project', PROJECT, '--json'], { env: PINNED }).code).toBe(0)
    expect(readFileSync(replayed, 'utf8'), 'replay 產物不得含 dev 覆蓋層').not.toContain(DEV_MARKER)

    const entries = parseOne(runCli(['list', '--project', PROJECT, '--json']).stdout)
    expect(entries.length, '庫內應有正本').toBeGreaterThan(0)
    for (const entry of entries) {
      expect(readFileSync(entry.artifact, 'utf8'), `庫內正本 ${entry.name} 不得含 dev 覆蓋層`).not.toContain(DEV_MARKER)
    }

    // 產物仍是合法離線單檔——覆蓋層若曾寫進去，零外部請求與 IR 規則會先炸
    expect(runCli(['lint', COPY, '--json']).code).toBe(0)
    expect(runCli(['lint', replayed, '--json']).code).toBe(0)
  })

  it(
    'test_e2_served_page_carries_the_overlay_and_the_server_appends: 只有被 serve 的頁面帶覆蓋層，POST 走同一條驗證',
    async () => {
      const started = runCli(['serve', SOURCE, '--project', PROJECT, '--json'])
      expect(started.code, `serve exit（stderr: ${started.stderr}）`).toBe(0)
      const { url, artifact } = parseOne(started.stdout)

      const page = await (await fetch(url)).text()
      expect(page, '被 serve 的頁面必須帶覆蓋層').toContain(DEV_MARKER)
      expect(page, '覆蓋層必須帶 reload 監聽').toContain('EventSource')
      expect(readFileSync(artifact, 'utf8'), '同一份正本在磁碟上不得帶覆蓋層').not.toContain(DEV_MARKER)

      const ids = blockIdsOf(artifact)
      const post = (body) =>
        fetch(new URL('/__kamishibai/comments', url).href, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })

      const bad = await post({ blockId: 'b99999', text: '不存在的錨點' })
      expect(bad.status, '未知 blockId 必須被伺服器擋下').toBe(400)
      expect((await bad.json()).errors[0].code).toBe('KSB_BLOCK_NOT_FOUND')

      const good = await post({ blockId: ids[1], text: '從瀏覽器留的言' })
      expect(good.status).toBe(201)
      const entry = await good.json()
      expect(Object.keys(entry)).toEqual(COMMENT_KEYS)
      expect(entry.blockId).toBe(ids[1])

      // 伺服器寫的與 CLI 讀的是同一份 sidecar，就在庫內正本旁邊
      expect(`${artifact}.comments.jsonl`.startsWith(testHome)).toBe(true)
      const listed = parseOne(runCli(['comments', artifact, '--json']).stdout)
      expect(listed).toEqual([entry])

      expect(runCli(['close', '--json']).code).toBe(0)
    },
    SERVE_TIMEOUT,
  )
})

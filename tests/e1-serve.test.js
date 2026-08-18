import { createServer } from 'node:net'
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCli, outDir, testHome, extractIrScripts } from './helpers.js'

/**
 * CONTRACT E1 — the preview server, driven as a real process on a real socket.
 *
 * Nothing here is mocked. A reload loop that works against a fake watcher and
 * a fake socket proves only that the test's own doubles agree with each other;
 * the failures this criterion is about (a port nobody answers on, a watcher
 * bound to a replaced inode, a daemon that outlives the suite) live exactly in
 * the parts a mock removes.
 */

const OUT_DIR = outDir('e1')
const SOURCE = join(OUT_DIR, 'live.md')
const PROJECT = 'e1-serve'
const SERVE_TIMEOUT = 40_000
/** Explicit budget for every wait: a hung preview must fail, never hang. */
const EVENT_TIMEOUT_MS = 15_000

const parseOne = (stdout) => JSON.parse(stdout)

const readSeed = () =>
  ['---', 'title: 預覽來源', '---', '', '# 章節一', '', '第一段。', ''].join('\n')

/** Grab a port the OS just handed out, then let it go — a deterministic target. */
const borrowPort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })

/**
 * Subscribe to the SSE stream and resolve once `name` arrives.
 * `trigger` runs after the stream is confirmed open, so a change made before
 * the subscription landed cannot make this pass or fail by luck.
 */
const awaitEvent = async (url, name, trigger) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EVENT_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    })
    expect(response.status, 'SSE 端點應回 200').toBe(200)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let triggered = false

    for (;;) {
      const { value, done } = await reader.read()
      if (done) throw new Error(`SSE 串流在收到 ${name} 之前就結束了`)
      buffer += decoder.decode(value, { stream: true })
      if (!triggered && buffer.includes('event: ready')) {
        triggered = true
        await trigger()
      }
      if (buffer.includes(`event: ${name}`)) {
        await reader.cancel().catch(() => {})
        return buffer
      }
    }
  } finally {
    clearTimeout(timer)
  }
}

const closeAll = () => runCli(['close', '--json'])

/** Depth-first over every nesting shape, so an id inside a list item still counts. */
const collect = (node, acc = []) => {
  acc.push(node)
  for (const child of node.children ?? []) collect(child, acc)
  for (const slide of node.slides ?? []) collect(slide, acc)
  for (const item of node.items ?? []) for (const child of item) collect(child, acc)
  return acc
}

const blockIdsOf = (artifactPath) =>
  collect(JSON.parse(extractIrScripts(readFileSync(artifactPath, 'utf8'))[0]).doc)
    .map((block) => block.id)
    .filter((id) => typeof id === 'string')

describe('E1 serve／close：真伺服器、真通訊埠、真檔案變更', () => {
  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
    appendFileSync(SOURCE, readSeed(), 'utf8')
  })

  afterAll(() => {
    // No daemon may outlive this file. The pidfile assertion below only means
    // something if the teardown that satisfies it actually runs.
    closeAll()
  })

  it(
    'test_serve_json_shape: serve 回一份 JSON，帶 url／pid／port／正本路徑，人讀路同源',
    async () => {
      const port = await borrowPort()
      const started = runCli(['serve', SOURCE, '--port', String(port), '--project', PROJECT, '--json'])
      expect(started.code, `serve exit（stderr: ${started.stderr}）`).toBe(0)
      const json = parseOne(started.stdout)

      expect(json.ok).toBe(true)
      expect(json.url, 'URL 必須是本機迴環位址').toBe(`http://127.0.0.1:${port}/`)
      expect(json.port, '指定 --port 時必須真的用那個埠').toBe(port)
      expect(Number.isInteger(json.pid), 'pid 必須是整數').toBe(true)
      expect(json.artifact.startsWith(testHome), '正本必須落在 KAMISHIBAI_HOME 內').toBe(true)

      // 真的有東西在那個位址上應答——印出 URL 卻沒人接聽是這條準則最不能容忍的謊
      const page = await fetch(json.url)
      expect(page.status).toBe(200)
      const html = await page.text()
      expect(html, '預覽頁必須是真的產物').toContain('<script type="application/kamishibai+json">')

      // 人讀路與 JSON 路同源
      expect(runCli(['close', '--json']).code).toBe(0)
      const port2 = await borrowPort()
      const human = runCli(['serve', SOURCE, '--port', String(port2), '--project', PROJECT])
      expect(human.code, `serve 人讀路 exit（stderr: ${human.stderr}）`).toBe(0)
      for (const value of [`http://127.0.0.1:${port2}/`, String(port2)]) {
        expect(human.stdout, `人讀路缺少 ${value}`).toContain(value)
      }
      expect(closeAll().code).toBe(0)
    },
    SERVE_TIMEOUT,
  )

  it(
    'test_serve_reload_on_change: 來源檔一變就重繪並推播 reload，頁面內容跟著換',
    async () => {
      const started = runCli(['serve', SOURCE, '--project', PROJECT, '--json'])
      expect(started.code, `serve exit（stderr: ${started.stderr}）`).toBe(0)
      const { url } = parseOne(started.stdout)

      const before = await (await fetch(url)).text()
      expect(before).not.toContain('這段是後來才加的')

      const stream = await awaitEvent(new URL('/__kamishibai/events', url).href, 'reload', async () => {
        appendFileSync(SOURCE, '\n這段是後來才加的。\n', 'utf8')
      })
      expect(stream, '必須收到 reload 事件').toContain('event: reload')

      const after = await (await fetch(url)).text()
      expect(after, 'reload 之後頁面必須是重繪過的內容').toContain('這段是後來才加的')

      expect(closeAll().code).toBe(0)
    },
    SERVE_TIMEOUT,
  )

  it(
    'test_e1_serve_writes_only_inside_home: 伺服器不碰 KAMISHIBAI_HOME 與宣告輸出以外的檔案',
    async () => {
      const before = readdirSync(OUT_DIR).sort()
      const started = runCli(['serve', SOURCE, '--project', PROJECT, '--json'])
      expect(started.code, `serve exit（stderr: ${started.stderr}）`).toBe(0)
      const { url, artifact } = parseOne(started.stdout)

      await fetch(url)
      const stream = await awaitEvent(new URL('/__kamishibai/events', url).href, 'reload', async () => {
        appendFileSync(SOURCE, '\n又一段。\n', 'utf8')
      })
      expect(stream).toContain('event: reload')

      expect(artifact.startsWith(testHome), '正本必須在測試 HOME 內').toBe(true)
      expect(readdirSync(OUT_DIR).sort(), '來源目錄不得多出任何檔案').toEqual(before)
      expect(closeAll().code).toBe(0)
    },
    SERVE_TIMEOUT,
  )

  it(
    'test_e1_session_canonical_is_a_living_document: 重繪後正本跟著更新，兩條寫入路對同一份 IR 說同樣的話',
    async () => {
      // 這一條釘的是 seal F1：伺服器拿「重繪後的 IR」驗留言錨點，正本卻停在開場那一份，
      // 於是 sidecar 會存下自己的產物解不開的錨點——留言迴路最要命的那種靜默背叛。
      const source = join(OUT_DIR, 'living.md')
      rmSync(source, { force: true })
      appendFileSync(source, ['---', 'title: 活文件', '---', '', '# 章節', '', '第一段。', ''].join('\n'), 'utf8')

      const started = runCli(['serve', source, '--project', PROJECT, '--json'])
      expect(started.code, `serve exit（stderr: ${started.stderr}）`).toBe(0)
      const { url, artifact } = parseOne(started.stdout)

      const idsBefore = blockIdsOf(artifact)
      const marker = '這是重繪後才出現的段落'

      const stream = await awaitEvent(new URL('/__kamishibai/events', url).href, 'reload', async () => {
        appendFileSync(source, `\n${marker}\n`, 'utf8')
      })
      expect(stream).toContain('event: reload')

      // 1. 磁碟上的正本真的換成了新的那一份
      const canonical = readFileSync(artifact, 'utf8')
      expect(canonical, '正本必須含重繪後的內容').toContain(marker)
      const idsAfter = blockIdsOf(artifact)
      expect(idsAfter.length, '新段落應帶來新的 block id').toBeGreaterThan(idsBefore.length)
      const fresh = idsAfter.find((id) => !idsBefore.includes(id))
      expect(fresh, '應找得到一個新生的 block id').toBeDefined()

      // 2. 伺服器這條寫入路接受新 block
      const posted = await fetch(new URL('/__kamishibai/comments', url).href, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blockId: fresh, text: '對新段落留言' }),
      })
      expect(posted.status, '伺服器應接受重繪後才存在的 block').toBe(201)

      // 3. CLI 這條寫入路對同一個 id 也必須成立——這正是 F1 之前會炸的地方
      const added = runCli(['comments', 'add', artifact, fresh, 'CLI 也對同一個 block 留言', '--json'])
      expect(added.code, `comments add 對重繪後的 block 必須成功（stdout: ${added.stdout}）`).toBe(0)
      expect(parseOne(added.stdout).blockId).toBe(fresh)

      // 4. sidecar 裡每一條錨點，都解得回它自己的產物
      const entries = parseOne(runCli(['comments', artifact, '--json']).stdout)
      expect(entries.length).toBe(2)
      for (const entry of entries) {
        expect(idsAfter, `sidecar 的錨點 ${entry.blockId} 必須存在於正本 IR`).toContain(entry.blockId)
      }

      // 5. 亂編的 id 在兩條路上都還是要被擋——刷新不是把驗證放寬
      const bogus = await fetch(new URL('/__kamishibai/comments', url).href, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blockId: 'b99999', text: '亂編的' }),
      })
      expect(bogus.status, '未知錨點在伺服器路仍須被擋').toBe(400)
      const cliBogus = runCli(['comments', 'add', artifact, 'b99999', '亂編的', '--json'])
      expect(cliBogus.code, '未知錨點在 CLI 路仍須 exit 1').toBe(1)
      expect(parseOne(cliBogus.stdout).errors[0].code).toBe('KSB_BLOCK_NOT_FOUND')

      // 6. 刷新走的是同一份渲染結果：正本上仍不得有 dev 覆蓋層
      expect(canonical, '刷新後的正本不得帶 dev 覆蓋層').not.toContain('kamishibai-dev-overlay')
      expect(runCli(['lint', artifact, '--json']).code, '刷新後的正本仍須通過 lint').toBe(0)

      expect(closeAll().code).toBe(0)
    },
    SERVE_TIMEOUT,
  )

  it.skipIf(process.getuid?.() === 0)(
    'test_e1_live_ir_never_leads_the_canonical: 正本刷不動時，畫面與驗證都不得先跑掉',
    async () => {
      // F1 的順序不變式：先落正本、再上線。倒過來寫在一切順利時看不出差別——
      // 差別只在刷新失敗的那一刻：畫面若先進到新 IR，就又能收下正本解不開的錨點。
      const source = join(OUT_DIR, 'unwritable.md')
      rmSync(source, { force: true })
      appendFileSync(source, ['---', 'title: 刷不動', '---', '', '# 章', '', '原本這段。', ''].join('\n'), 'utf8')

      const started = runCli(['serve', source, '--project', PROJECT, '--json'])
      expect(started.code, `serve exit（stderr: ${started.stderr}）`).toBe(0)
      const { url, artifact } = parseOne(started.stdout)
      const idsBefore = blockIdsOf(artifact)
      const storeDir = dirname(artifact)

      chmodSync(storeDir, 0o555)
      try {
        // 前置條件：這台機器上唯讀真的擋得住寫入（root 會直接穿透，故整條跳過）
        let blocked = false
        try {
          writeFileSync(join(storeDir, '.probe'), 'x', { flag: 'wx' })
        } catch {
          blocked = true
        }
        expect(blocked, '前置條件：唯讀目錄必須真的擋住寫入').toBe(true)

        const stream = await awaitEvent(new URL('/__kamishibai/events', url).href, 'error', async () => {
          appendFileSync(source, '\n後來加的一段。\n', 'utf8')
        })
        expect(stream, '刷不動正本時必須推播 error，而不是裝作成功').toContain('event: error')
        expect(stream).toContain('KSB_WRITE_FAILED')

        // 畫面停在上一份好的渲染——沒有偷偷往前
        const page = await (await fetch(url)).text()
        expect(page, '刷新失敗時畫面不得換成新內容').not.toContain('後來加的一段')

        // 驗證面也停在上一份：新 block 尚未存在於正本，就不該被收下
        const posted = await fetch(new URL('/__kamishibai/comments', url).href, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ blockId: `b${idsBefore.length + 1}`, text: '搶跑的錨點' }),
        })
        expect(posted.status, '正本沒進版，錨點驗證就不得先進版').toBe(400)
        expect((await posted.json()).errors[0].code).toBe('KSB_BLOCK_NOT_FOUND')
      } finally {
        chmodSync(storeDir, 0o755)
        rmSync(join(storeDir, '.probe'), { force: true })
      }
      expect(closeAll().code).toBe(0)
    },
    SERVE_TIMEOUT,
  )

  it(
    'test_e1_refresh_never_touches_a_previous_sessions_artifact: 只刷新本次 session 自己建的那一份，庫內舊產物原封不動',
    async () => {
      const source = join(OUT_DIR, 'bystander.md')
      rmSync(source, { force: true })
      appendFileSync(source, ['---', 'title: 旁觀者', '---', '', '# 章', '', '一段。', ''].join('\n'), 'utf8')

      // 先留下一份「既有產物」——wx 法保護的是歷史，不是本次 session 的活稿
      const previous = runCli(['render', source, '-o', join(OUT_DIR, 'bystander.html'), '--project', PROJECT, '--json'])
      expect(previous.code, `render exit（stderr: ${previous.stderr}）`).toBe(0)
      const older = parseOne(previous.stdout).archived
      const olderBytes = readFileSync(older)

      const started = runCli(['serve', source, '--project', PROJECT, '--json'])
      expect(started.code, `serve exit（stderr: ${started.stderr}）`).toBe(0)
      const { url, artifact } = parseOne(started.stdout)
      expect(artifact, 'serve 必須另開一份正本，不得認領既有產物').not.toBe(older)

      const stream = await awaitEvent(new URL('/__kamishibai/events', url).href, 'reload', async () => {
        appendFileSync(source, '\n又一段。\n', 'utf8')
      })
      expect(stream).toContain('event: reload')

      expect(readFileSync(older).equals(olderBytes), '既有產物必須逐位元組不變').toBe(true)
      expect(readFileSync(artifact, 'utf8'), '本次 session 的正本才會被刷新').toContain('又一段')
      expect(closeAll().code).toBe(0)
    },
    SERVE_TIMEOUT,
  )

  it(
    'test_e1_close_is_idempotent_and_kills_the_daemon: close 真的終止程序，沒東西可關也 exit 0',
    async () => {
      const started = runCli(['serve', SOURCE, '--project', PROJECT, '--json'])
      expect(started.code, `serve exit（stderr: ${started.stderr}）`).toBe(0)
      const { pid, url } = parseOne(started.stdout)

      const first = runCli(['close', '--json'])
      expect(first.code, 'close exit').toBe(0)
      expect(parseOne(first.stdout).closed, 'close 應回報它終止了哪些 pid').toContain(pid)

      // 程序真的死了：訊號 0 只探存在，不遞送
      await new Promise((resolve) => setTimeout(resolve, 500))
      let alive = true
      try {
        process.kill(pid, 0)
      } catch {
        alive = false
      }
      expect(alive, `pid ${pid} 應已終止`).toBe(false)
      await expect(fetch(url)).rejects.toBeTruthy()

      // 冪等：再關一次仍是成功
      const second = runCli(['close', '--json'])
      expect(second.code, '沒有伺服器在跑時 close 仍須 exit 0').toBe(0)
      expect(parseOne(second.stdout)).toEqual({ ok: true, closed: [], stale: [] })

      // 人讀路的兩個分支都要說得出話——「沒東西可關」不能是一片空白
      const emptyHuman = runCli(['close'])
      expect(emptyHuman.code).toBe(0)
      expect(emptyHuman.stdout, '無伺服器時的人讀路').toBe('✔ 沒有執行中的預覽伺服器\n')

      const again = runCli(['serve', SOURCE, '--project', PROJECT, '--json'])
      expect(again.code, `serve exit（stderr: ${again.stderr}）`).toBe(0)
      const revived = parseOne(again.stdout).pid
      const killedHuman = runCli(['close'])
      expect(killedHuman.code).toBe(0)
      expect(killedHuman.stdout, '終止時的人讀路必須點名 pid').toBe(`✔ 已終止 ${revived}\n`)
    },
    SERVE_TIMEOUT,
  )

  it('test_e1_serve_rejects_bad_input_and_port: 失敗路 exit 碼與 KSB_ 碼穩定', () => {
    const cases = [
      { args: ['serve', SOURCE, '--port', 'abc', '--json'], code: 2, ksb: 'KSB_SERVE_PORT_INVALID' },
      { args: ['serve', SOURCE, '--port', '0', '--json'], code: 2, ksb: 'KSB_SERVE_PORT_INVALID' },
      { args: ['serve', 'fixtures/does-not-exist.md', '--json'], code: 2, ksb: 'KSB_INPUT_NOT_FOUND' },
      { args: ['serve', '-', '--json'], code: 2, ksb: 'KSB_USAGE' },
      { args: ['serve', '--json'], code: 2, ksb: 'KSB_USAGE' },
    ]
    for (const { args, code, ksb } of cases) {
      const r = runCli(args)
      expect(r.code, `[${args.join(' ')}] exit`).toBe(code)
      const out = parseOne(r.stdout)
      expect(out.ok).toBe(false)
      expect(out.errors[0].code, `[${args.join(' ')}] code`).toBe(ksb)
    }
  })

  it('test_e1_serve_reports_a_broken_source_instead_of_a_dead_url: 來源渲染不了就不給 URL', () => {
    const broken = join(OUT_DIR, 'broken.md')
    rmSync(broken, { force: true })
    appendFileSync(broken, ['# 只有標題', '', '```diagram', '{ 不是 JSON', '```', ''].join('\n'), 'utf8')
    const r = runCli(['serve', broken, '--project', PROJECT, '--json'])
    expect(r.code, '渲染不了的來源必須 exit 1').toBe(1)
    const out = parseOne(r.stdout)
    expect(out.ok).toBe(false)
    expect(out.errors[0].code).toMatch(/^KSB_/)
  }, SERVE_TIMEOUT)

  it('test_e1_pidfile_holds_no_live_pid_after_teardown: 收工後 pidfile 目錄不留任何活著的 pid', () => {
    expect(closeAll().code).toBe(0)
    const pidfile = join(testHome, 'run', 'serve.pid')
    const records = existsSync(pidfile) ? JSON.parse(readFileSync(pidfile, 'utf8')) : []
    const live = records.filter((record) => {
      try {
        process.kill(record.pid, 0)
        return true
      } catch {
        return false
      }
    })
    expect(live, '測試套件不得留下任何仍在跑的 serve 程序').toEqual([])
  })
})

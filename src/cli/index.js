#!/usr/bin/env node
import { Command, CommanderError } from 'commander'
import { engineVersion } from '../core/version.js'
import { EXIT, usageError } from '../core/errors.js'
import { emit, toFailure } from './emit.js'
import { renderCommand } from './commands/render.js'
import { lintCommand } from './commands/lint.js'
import { exampleCommand } from './commands/example.js'
import { schemaCommand } from './commands/schema.js'
import { listCommand } from './commands/list.js'
import { openCommand } from './commands/open.js'
import { replayCommand } from './commands/replay.js'
import { exportCommand } from './commands/export.js'
import { snapshotCommand } from './commands/snapshot.js'
import { setupCommand } from './commands/setup.js'
import { serveCommand } from './commands/serve.js'
import { closeCommand } from './commands/close.js'
import { commentsCommand } from './commands/comments.js'
import { templatesCommand } from './commands/templates.js'
import { debugCommand } from './commands/debug.js'

const argv = process.argv
const wantsJson = argv.includes('--json')

const HELP_CODES = new Set(['commander.helpDisplayed', 'commander.help'])
const VERSION_CODE = 'commander.version'

const HELP_FLAGS = new Set(['-h', '--help', 'help'])
const VERSION_FLAGS = new Set(['-v', '--version'])

/** The subcommands. Presence of one is what makes an invocation a command. */
const COMMANDS = Object.freeze([
  'render',
  'lint',
  'example',
  'schema',
  'list',
  'open',
  'replay',
  'export',
  'snapshot',
  'setup',
  'serve',
  'close',
  'comments',
  'templates',
  'debug',
])

/** The single wording for "you gave no command", shared by both output paths. */
const NO_COMMAND_MESSAGE = 'no command given; try `kamishibai --help`'

/**
 * Commander raises the same help error whether the user *asked* for help or
 * merely gave no command. Only the former is a success: treating both as
 * exit 0 turned `kamishibai --json` into exit 0 with empty stdout, which any
 * downstream `JSON.parse` would crash on while looking like success (A7).
 */
const askedForHelp = argv.slice(2).some((a) => HELP_FLAGS.has(a))
const askedForVersion = argv.slice(2).some((a) => VERSION_FLAGS.has(a))

/**
 * Detect "no command" by looking for a subcommand token, not by counting argv:
 * a bare `--json` makes argv長 enough to slip past a length check and then falls
 * through to commander, whose help error message is the internal token
 * `(outputHelp)` — leaking implementation detail and making the two output
 * paths disagree on the wording (A7).
 */
const hasCommand = argv.slice(2).some((a) => COMMANDS.includes(a))

/** Commander's own output, captured so `--json` can return it as a JSON field. */
const captured = []

const buildProgram = () => {
  const program = new Command()
  program
    .name('kamishibai')
    .description('Agent Presentation SDK — 結構化內容渲染為離線單檔產物')
    .version(engineVersion(), '-v, --version')
    .option('--json', '以 JSON 輸出結果（可置於指令前或後）')
    .exitOverride()

  // With --json, stdout must stay a single JSON object, so commander's own
  // help/usage text is captured instead of printed — help then comes back as
  // a JSON field, and usage errors as a KSB_ error object.
  if (wantsJson) {
    program.configureOutput({
      writeOut: (str) => captured.push(str),
      writeErr: (str) => captured.push(str),
    })
  }

  program
    .command('render')
    .description('把 Markdown 超集或 block tree JSON 渲染成離線單檔 HTML（`-` 讀 stdin）')
    .argument('<input>', 'Markdown 超集／block tree JSON 檔路徑，或 `-` 表示 stdin')
    .option('-o, --out <path>', '產物輸出路徑')
    .option('-t, --template <key>', '覆寫模板 <namespace>/<name>')
    .option('-g, --generator <name>', 'IR generator 欄位值')
    .option('-p, --project <name>', '覆寫中央產物庫的專案名（預設依四層解析）')
    .option('--json', '以 JSON 輸出結果')
    .action(async (input, options) => {
      const { result, exitCode } = await renderCommand(input, options)
      emit({ command: 'render', result, json: wantsJson, exitCode })
    })

  program
    .command('replay')
    .description('由產物內嵌 IR 重繪（換模板／升版／換皮）')
    .argument('<artifact>', '既有產物 HTML 路徑')
    .option('-o, --out <path>', '產物輸出路徑')
    .option('-t, --template <key>', '覆寫模板 <namespace>/<name>')
    .option('-g, --generator <name>', 'IR generator 欄位值')
    .option('-p, --project <name>', '覆寫中央產物庫的專案名（預設依四層解析）')
    .option('--json', '以 JSON 輸出結果')
    .action(async (artifact, options) => {
      const { result, exitCode } = await replayCommand(artifact, options)
      emit({ command: 'replay', result, json: wantsJson, exitCode })
    })

  program
    .command('list')
    .description('列出當前專案的中央產物庫呈現史')
    .option('-p, --project <name>', '覆寫專案名（預設 .kamishibai.toml → git root → cwd）')
    .option('--json', '以 JSON 輸出結果')
    .action((options) => {
      const { result, exitCode } = listCommand(options)
      emit({ command: 'list', result, json: wantsJson, exitCode })
    })

  program
    .command('open')
    .description('由中央產物庫解析並開啟產物（跨平台開啟鏈）')
    .argument('<name>', '產物名稱，或 `latest` 表示最新一份')
    .option('-p, --project <name>', '覆寫專案名（預設 .kamishibai.toml → git root → cwd）')
    .option('--dry-run', '只解析路徑、不開啟瀏覽器')
    .option('--json', '以 JSON 輸出結果')
    .action((name, options) => {
      const { result, exitCode } = openCommand(name, options)
      emit({ command: 'open', result, json: wantsJson, exitCode })
    })

  program
    .command('export')
    .description('把產物匯出成附屬格式（document → pdf、deck → pptx）')
    .argument('<artifact>', '既有產物 HTML 路徑')
    .requiredOption('--to <format>', '匯出格式：pdf 或 pptx')
    .option('-o, --out <path>', '匯出檔輸出路徑（預設 out/<產物名>.<格式>）')
    .option('--json', '以 JSON 輸出結果')
    .action(async (artifact, options) => {
      const { result, exitCode } = await exportCommand(artifact, options)
      emit({ command: 'export', result, json: wantsJson, exitCode })
    })

  program
    .command('snapshot')
    .description('把產物截成 PNG，讓 Agent（與人）看得到視覺效果')
    .argument('<artifact>', '既有產物 HTML 路徑')
    .option('-o, --out <path>', 'PNG 輸出路徑（預設 out/<產物名>.png）')
    .option('--slide <n>', 'deck 產物要截第幾張（預設第 1 張）')
    .option('--json', '以 JSON 輸出結果')
    .action(async (artifact, options) => {
      const { result, exitCode } = await snapshotCommand(artifact, options)
      emit({ command: 'snapshot', result, json: wantsJson, exitCode })
    })

  program
    .command('setup')
    .description('初始化環境：建中央儲存庫、確認（必要時安裝）渲染用瀏覽器')
    .option('--dry-run', '只回報狀態、不建目錄也不安裝')
    .option('--json', '以 JSON 輸出結果')
    .action(async (options) => {
      const { result, exitCode } = await setupCommand(options)
      emit({ command: 'setup', result, json: wantsJson, exitCode })
    })

  program
    .command('serve')
    .description('起本地預覽伺服器：來源檔一變就重繪並推播 reload（SPEC §10.2 watch 模式）')
    .argument('<input>', 'Markdown 超集／block tree JSON 檔路徑')
    .option('--port <n>', '指定連接埠（預設由系統挑一個空的）')
    .option('-t, --template <key>', '覆寫模板 <namespace>/<name>')
    .option('-g, --generator <name>', 'IR generator 欄位值')
    .option('-p, --project <name>', '覆寫中央產物庫的專案名（預設依四層解析）')
    .option('--json', '以 JSON 輸出結果')
    .action(async (input, options) => {
      const { result, exitCode } = await serveCommand(input, options)
      emit({ command: 'serve', result, json: wantsJson, exitCode })
    })

  program
    .command('close')
    .description('終止本 SDK 起的預覽伺服器（沒有在跑也算成功）')
    .option('--json', '以 JSON 輸出結果')
    .action((options) => {
      const { result, exitCode } = closeCommand(options)
      emit({ command: 'close', result, json: wantsJson, exitCode })
    })

  program
    .command('comments')
    .description('讀寫產物留言（block id 錨定）：列出／`resolve <產物> <id>`／`add <產物> <blockId> <文字>`')
    .argument('<args...>', '`<產物>`、`resolve <產物> <id>` 或 `add <產物> <blockId> <文字>`')
    .option('--json', '以 JSON 輸出結果')
    .action((args) => {
      const { result, exitCode } = commentsCommand(args)
      emit({ command: 'comments', result, json: wantsJson, exitCode })
    })

  program
    .command('templates')
    .description('列出中央儲存庫已註冊的模板包')
    .option('--json', '以 JSON 輸出結果')
    .action((options) => {
      const { result, exitCode } = templatesCommand(options)
      emit({ command: 'templates', result, json: wantsJson, exitCode })
    })

  program
    .command('debug')
    .description('診斷：儲存庫位置、模板包數、瀏覽器狀態、引擎版本')
    .option('--json', '以 JSON 輸出結果')
    .action(async (options) => {
      const { result, exitCode } = await debugCommand(options)
      emit({ command: 'debug', result, json: wantsJson, exitCode })
    })

  program
    .command('lint')
    .description('驗證產物：零外部請求、內嵌 IR 齊備且通過 schema')
    .argument('<artifact>', '產物 HTML 路徑')
    .option('--json', '以 JSON 輸出結果')
    .action((artifact) => {
      const { result, exitCode } = lintCommand(artifact)
      emit({ command: 'lint', result, json: wantsJson, exitCode })
    })

  program
    .command('example')
    .description('輸出合法範例（`doc`／`deck` 為 Markdown 超集，其餘為 block JSON）')
    .argument('[kind]', '範例類型：doc、deck 或 block 名稱', 'doc')
    .option('--json', '以 JSON 輸出結果')
    .action((kind) => {
      const { result, exitCode } = exampleCommand(kind)
      emit({ command: 'example', result, json: wantsJson, exitCode })
    })

  program
    .command('schema')
    .description('輸出 IR 的 JSON Schema（draft 2020-12）')
    .option('--json', '以 JSON 輸出結果')
    .action(() => {
      const { result, exitCode } = schemaCommand()
      emit({ command: 'schema', result, json: wantsJson, exitCode })
    })

  return program
}

async function main() {
  if (!hasCommand && !askedForHelp && !askedForVersion) throw usageError(NO_COMMAND_MESSAGE)
  await buildProgram().parseAsync(argv)
}

/**
 * `--help` / `--version` succeed only when the user actually asked for them.
 * Without `--json` commander has already written the text to stdout itself;
 * with `--json` that text was captured instead, and comes back as a field so
 * stdout stays a single JSON object.
 */
const emitHelp = (field, value) => {
  if (wantsJson) {
    emit({ command: 'cli', result: { ok: true, [field]: value }, json: true, exitCode: EXIT.OK })
    return
  }
  process.exitCode = EXIT.OK
}

/**
 * Commander sets some error messages to bare internal tokens such as
 * `(outputHelp)`. Those are event names, not diagnostics — never show them.
 */
const INTERNAL_TOKEN = /^\(\w+\)$/

const userFacingMessage = (raw) => {
  const message = String(raw ?? '').replace(/^error:\s*/, '').trim()
  return message.length === 0 || INTERNAL_TOKEN.test(message) ? NO_COMMAND_MESSAGE : message
}

main().catch((error) => {
  if (error instanceof CommanderError) {
    if (error.code === VERSION_CODE && askedForVersion) {
      emitHelp('version', engineVersion())
      return
    }
    if (HELP_CODES.has(error.code) && askedForHelp) {
      emitHelp('help', captured.join('').trimEnd())
      return
    }
    const { result } = toFailure(usageError(userFacingMessage(error.message)))
    emit({ command: 'cli', result, json: wantsJson, exitCode: EXIT.USAGE })
    return
  }
  const { result, exitCode } = toFailure(error)
  emit({ command: 'cli', result, json: wantsJson, exitCode })
})

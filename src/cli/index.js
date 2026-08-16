#!/usr/bin/env node
import { Command, CommanderError } from 'commander'
import { engineVersion } from '../core/version.js'
import { EXIT, usageError } from '../core/errors.js'
import { emit, toFailure } from './emit.js'
import { renderCommand } from './commands/render.js'
import { lintCommand } from './commands/lint.js'
import { exampleCommand } from './commands/example.js'
import { schemaCommand } from './commands/schema.js'

const argv = process.argv
const wantsJson = argv.includes('--json')

const HELP_CODES = new Set(['commander.helpDisplayed', 'commander.help'])
const VERSION_CODE = 'commander.version'

const HELP_FLAGS = new Set(['-h', '--help', 'help'])
const VERSION_FLAGS = new Set(['-v', '--version'])

/** The four subcommands. Presence of one is what makes an invocation a command. */
const COMMANDS = Object.freeze(['render', 'lint', 'example', 'schema'])

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
    .option('--json', '以 JSON 輸出結果')
    .action(async (input, options) => {
      const { result, exitCode } = await renderCommand(input, options)
      emit({ command: 'render', result, json: wantsJson, exitCode })
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
    .description('輸出合法範例（`doc` 為 Markdown 超集，其餘為 block JSON）')
    .argument('[kind]', '範例類型：doc 或 block 名稱', 'doc')
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

import { execFileSync } from 'node:child_process'
import { CODES, EXIT, KsbError } from '../core/errors.js'

/**
 * The single cross-platform opener (SPEC §8 開啟三通道 ①). One chain, tried in
 * order — WSL first because that is where this SDK is developed and `xdg-open`
 * there resolves to a Linux browser that cannot show the file to the user.
 */
export const OPEN_CHAIN = Object.freeze(['wslview', 'xdg-open', 'explorer.exe', 'open'])

/**
 * @param {string} target absolute path of the artifact to open
 * @param {(cmd: string, args: string[]) => void} [run] injected for tests
 * @returns {string} the launcher that succeeded
 */
export function openPath(target, run = (cmd, args) => execFileSync(cmd, args, { stdio: 'ignore' })) {
  const tried = []
  for (const cmd of OPEN_CHAIN) {
    try {
      run(cmd, [target])
      return cmd
    } catch {
      tried.push(cmd)
    }
  }
  throw new KsbError({
    code: CODES.OPEN_FAILED,
    message: `could not open ${target}; tried: ${tried.join(', ')}`,
    exitCode: EXIT.VALIDATION,
  })
}

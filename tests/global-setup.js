import { realHomeLeaks, REAL_HOME } from './real-home.js'

/**
 * CONTRACT B1 — the suite-wide tripwire for the protected store.
 *
 * A per-file assertion cannot see this: test files run in separate workers, so
 * one file's check happens long before another file's leak. Only a teardown
 * that runs once, after everything, observes the whole run — which is exactly
 * where the A6 shell-pipeline leak hid.
 */
export default function setup() {
  const startedAt = Date.now()
  return () => {
    const leaks = realHomeLeaks(startedAt)
    if (leaks.length > 0) {
      throw new Error(
        [
          `測試套件寫入了真實產物庫 ${REAL_HOME}（CONTRACT B1 禁止）`,
          '每個喚起 CLI 的呼叫都必須經由 tests/helpers.js 的 cliEnv()／runCli 注入暫存 KAMISHIBAI_HOME。',
          ...leaks.slice(0, 20).map((p) => `  - ${p}`),
        ].join('\n'),
      )
    }
  }
}

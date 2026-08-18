import { describe, expect, it } from 'vitest'
import { OPEN_CHAIN, openPath } from '../src/delivery/open.js'
import { CODES } from '../src/core/errors.js'

/**
 * CONTRACT E6 — closing F9's register item: the cross-platform open chain.
 *
 * B5 could only ever assert `--dry-run`, because the real path launches a
 * browser. The chain's actual behaviour — order, first-success, and what the
 * all-fail diagnostic says — was therefore unpinned, which is why `openPath`
 * takes an injected runner. These are unit tests on purpose: the question is
 * "does the chain do what it claims", not "does this machine have wslview".
 */

const TARGET = '/tmp/e6-open-chain.html'

describe('E6 開啟鏈：順序、首個成功、全滅診斷', () => {
  it('test_e6_chain_order_is_honoured: 依 OPEN_CHAIN 宣告的順序逐一嘗試', () => {
    const tried = []
    expect(() =>
      openPath(TARGET, (cmd) => {
        tried.push(cmd)
        throw new Error(`${cmd} not found`)
      }),
    ).toThrow()
    expect(tried, '嘗試順序必須就是 OPEN_CHAIN 的宣告順序').toEqual([...OPEN_CHAIN])
  })

  it('test_e6_first_success_wins: 第一個成功的啟動器立即回傳，後面的不再嘗試', () => {
    for (const [index, winner] of OPEN_CHAIN.entries()) {
      const tried = []
      const result = openPath(TARGET, (cmd, args) => {
        tried.push(cmd)
        expect(args, '目標路徑必須原封不動傳給啟動器').toEqual([TARGET])
        if (cmd !== winner) throw new Error(`${cmd} not found`)
      })
      expect(result, '回傳的是成功的那個啟動器').toBe(winner)
      expect(tried, '成功之後不得再試下一個').toEqual(OPEN_CHAIN.slice(0, index + 1))
    }
  })

  it('test_e6_all_fail_names_every_launcher: 全滅時錯誤碼是 KSB_OPEN_FAILED，且逐一點名', () => {
    let thrown
    try {
      openPath(TARGET, (cmd) => {
        throw new Error(`${cmd} not found`)
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown, '全滅必須丟錯，不得靜默').toBeDefined()
    expect(thrown.code).toBe(CODES.OPEN_FAILED)
    expect(thrown.exitCode, '開不起來是驗證類失敗').toBe(1)
    expect(thrown.message, '訊息要說開不了誰').toContain(TARGET)
    for (const cmd of OPEN_CHAIN) {
      expect(thrown.message, `診斷必須點名 ${cmd}`).toContain(cmd)
    }
  })

  it('test_e6_chain_is_not_empty_and_starts_with_wsl: 鏈本身不得被抽空', () => {
    expect(OPEN_CHAIN.length).toBeGreaterThan(1)
    expect(OPEN_CHAIN[0], 'WSL 先行是刻意的：xdg-open 在 WSL 會開到看不見的 Linux 瀏覽器').toBe('wslview')
    expect(Object.isFrozen(OPEN_CHAIN)).toBe(true)
  })
})

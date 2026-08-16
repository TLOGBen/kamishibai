import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { repoRoot } from './helpers.js'

const SRC = join(repoRoot, 'src')
const LAYERS = ['parser', 'core', 'render', 'delivery', 'cli']
const MAX_LINES = 800

const walkFiles = (dir) => {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkFiles(full))
    else if (full.endsWith('.js')) out.push(full)
  }
  return out
}

describe('A9 clean architecture 分層', () => {
  it('test_a9_five_layers_exist: src/ 下五層目錄齊備', () => {
    for (const layer of LAYERS) {
      expect(statSync(join(SRC, layer)).isDirectory()).toBe(true)
    }
  })

  it('test_a9_cli_layer_never_imports_vue: cli/ 內任何檔案不得 import vue', () => {
    const offenders = walkFiles(join(SRC, 'cli')).filter((file) => {
      const code = readFileSync(file, 'utf8')
      return (
        /\bfrom\s+['"]vue(\/[^'"]*)?['"]/.test(code) ||
        /\brequire\(\s*['"]vue(\/[^'"]*)?['"]\s*\)/.test(code) ||
        /\bimport\(\s*['"]vue(\/[^'"]*)?['"]\s*\)/.test(code)
      )
    })
    expect(offenders).toEqual([])
  })

  it('test_a9_no_source_file_exceeds_800_lines: 任一源檔 ≤800 行', () => {
    const files = [...walkFiles(SRC), ...walkFiles(join(repoRoot, 'templates'))]
    const oversized = files
      .map((file) => ({ file, lines: readFileSync(file, 'utf8').split('\n').length }))
      .filter((entry) => entry.lines > MAX_LINES)
    expect(oversized).toEqual([])
    expect(files.length).toBeGreaterThan(0)
  })
})

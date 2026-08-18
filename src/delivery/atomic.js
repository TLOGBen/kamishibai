import { appendFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/**
 * Crash-safe file replacement: write a sibling temp file, then `rename` it over
 * the target (CONTRACT D6, the S2 ride-along).
 *
 * The sidecar index is the case that forced this. `writeFileSync` truncates
 * first and writes after, so a process killed in between leaves a **zero-byte
 * or half-written** index — and the reader treats a corrupt sidecar as "no
 * delivery copies", i.e. the record is silently gone rather than visibly broken.
 * `rename` within one directory is atomic: a reader sees either the whole old
 * file or the whole new one, never a torn one.
 *
 * The temp name carries the pid and a per-process counter, so two concurrent
 * writers cannot land on the same scratch file and corrupt each other — which
 * is the same reasoning that makes the artifact write exclusive (`wx`).
 */

let sequence = 0

const tempPathFor = (targetPath) => {
  sequence += 1
  return join(dirname(targetPath), `.${basename(targetPath)}.${process.pid}.${sequence}.tmp`)
}

/**
 * Append one record line to an append-only log (CONTRACT E2 的留言 sidecar).
 *
 * The rename dance above is the wrong tool here and would be actively worse: a
 * read-all/rewrite-all cycle turns an append-only history into a full-file
 * replacement, so a crash — or a second writer — can lose records that were
 * already durable. A single `O_APPEND` write of one line is what an append log
 * actually needs: the kernel places every writer at the current end of file, so
 * concurrent appends interleave by record instead of overwriting each other.
 *
 * The line is written in one call for that reason; callers must therefore pass
 * one complete record **without** its trailing newline — this function adds the
 * terminator, so that the record and its delimiter cannot be split across two
 * writes and interleaved with somebody else's.
 *
 * @param {string} targetPath absolute path of the log
 * @param {string} line one record, without its trailing newline
 * @returns {string} the target path
 */
export function appendLineAtomic(targetPath, line) {
  if (line.includes('\n')) {
    throw new Error('append record must be a single line; embedded newline would split the record')
  }
  appendFileSync(targetPath, `${line}\n`, { encoding: 'utf8', flag: 'a' })
  return targetPath
}

/**
 * @param {string} targetPath absolute path to replace
 * @param {string} data file contents
 * @returns {string} the target path
 */
export function writeFileAtomic(targetPath, data) {
  const tmp = tempPathFor(targetPath)
  try {
    writeFileSync(tmp, data, { encoding: 'utf8', flag: 'wx' })
    renameSync(tmp, targetPath)
  } catch (cause) {
    // A failed write must not leave scratch files behind: the store is a
    // permanent record, and residue there is indistinguishable from content.
    rmSync(tmp, { force: true })
    throw cause
  }
  return targetPath
}

import { renameSync, rmSync, writeFileSync } from 'node:fs'
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

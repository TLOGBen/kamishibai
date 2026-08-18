import { EXIT, usageError } from '../../core/errors.js'
import { readArtifact } from '../../delivery/read.js'
import { readEmbeddedIr } from '../../parser/artifact.js'
import { appendComment, listComments, resolveComment } from '../../delivery/comments.js'
import { collectBlockIds } from '../../core/blocks.js'

/**
 * `kamishibai comments <artifact> [--json]`
 * `kamishibai comments resolve <artifact> <id>`
 * `kamishibai comments add <artifact> <blockId> <text…>`
 *
 * The Agent end of SPEC §13.1's loop: read what a human said about which block,
 * edit the IR, `replay`, then mark it resolved.
 *
 * `add` is the CLI mirror of the overlay's POST and shares its one
 * implementation. It exists so the write path — including the anchor check that
 * makes a comment trustworthy — is reachable and assertable without a browser;
 * two write paths that only *ought* to validate the same way is exactly the
 * drift that would let an unanchored comment into the log.
 */

const SUBCOMMANDS = Object.freeze(['resolve', 'add'])

const listing = (artifactPath) => {
  const { path } = readArtifact(artifactPath)
  return { result: listComments(path), exitCode: EXIT.OK }
}

const adding = (artifactPath, blockId, textParts) => {
  const { html, path } = readArtifact(artifactPath)
  const entry = appendComment({
    artifactPath: path,
    blockId,
    text: textParts.join(' '),
    // Legal anchors are read off the artifact's own embedded IR — the same
    // source the served page shows, so an id that was pickable is appendable.
    blockIds: collectBlockIds(readEmbeddedIr(html, path).doc),
  })
  return { result: { ok: true, ...entry }, exitCode: EXIT.OK }
}

const resolving = (artifactPath, id) => {
  const { path } = readArtifact(artifactPath)
  const entry = resolveComment({ artifactPath: path, id })
  return { result: { ok: true, ...entry }, exitCode: EXIT.OK }
}

/**
 * @param {string[]} args the raw positional words, so the three documented call
 *   forms stay spelled exactly as CONTRACT E2 writes them
 */
export function commentsCommand(args = []) {
  const [head, ...rest] = args

  if (head === undefined) throw usageError('comments 需要一個產物路徑')

  if (!SUBCOMMANDS.includes(head)) {
    if (rest.length > 0) throw usageError(`comments 不認得多餘的參數：${rest.join(' ')}`)
    return listing(head)
  }

  const [artifact, ...tail] = rest
  if (artifact === undefined) throw usageError(`comments ${head} 需要一個產物路徑`)

  if (head === 'resolve') {
    if (tail.length !== 1) throw usageError('comments resolve <artifact> <id> 需要恰好一個留言 id')
    return resolving(artifact, tail[0])
  }

  if (tail.length < 2) throw usageError('comments add <artifact> <blockId> <text> 需要 block id 與留言內容')
  const [blockId, ...text] = tail
  return adding(artifact, blockId, text)
}

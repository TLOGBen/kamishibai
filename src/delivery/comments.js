import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CODES, EXIT, KsbError } from '../core/errors.js'
import { appendLineAtomic } from './atomic.js'

/**
 * The block-anchored comment loop (CONTRACT E2, SPEC §13.1).
 *
 * Two properties carry the whole design:
 *
 * 1. **Comments are data, never edits.** Nothing here touches the artifact. A
 *    comment is a row in a log beside it, so the artifact stays exactly what
 *    the renderer produced and the file remains the single source of truth.
 * 2. **The log is append-only.** Resolving a comment appends a *new* record
 *    with the same id and `status: "resolved"`; it never rewrites the line that
 *    recorded the original opinion. A human's comment is testimony — the
 *    record of what was said must survive the decision to act on it, which is
 *    also what lets an Agent see that a comment was raised at all after it has
 *    been dealt with.
 *
 * Reading folds the log by id, last record wins. Every record therefore has
 * the same five keys, which is what keeps `comments --json` a homogeneous array
 * rather than a union of two shapes.
 */

/** Verbatim CONTRACT constant — the sidecar suffix, appended to the artifact path. */
export const COMMENTS_SUFFIX = '.comments.jsonl'
/** Verbatim CONTRACT constant — comment fields, in output order. */
export const COMMENT_KEYS = Object.freeze(['id', 'blockId', 'text', 'ts', 'status'])
/** Verbatim CONTRACT constant — the two legal statuses. */
export const STATUS_OPEN = 'open'
export const STATUS_RESOLVED = 'resolved'

/** `<canonical>.comments.jsonl` — beside the artifact it belongs to. */
export function commentsPath(artifactPath) {
  return `${resolve(artifactPath)}${COMMENTS_SUFFIX}`
}

const validationError = (code, message) =>
  new KsbError({ code, message, exitCode: EXIT.VALIDATION })

/**
 * Raw records in write order. A malformed line is skipped rather than fatal:
 * the log may be appended to by a server that died mid-line, and one torn
 * record must not make every earlier comment unreadable.
 */
export function readCommentRecords(artifactPath) {
  const path = commentsPath(artifactPath)
  if (!existsSync(path)) return []
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (cause) {
    throw validationError(
      CODES.ARTIFACT_UNREADABLE,
      `could not read comments sidecar ${path}: ${cause.message}`,
    )
  }
  const records = []
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue
    try {
      const parsed = JSON.parse(line)
      if (parsed && typeof parsed.id === 'string') records.push(parsed)
    } catch {
      continue
    }
  }
  return records
}

/** Exactly the five pinned keys, in the pinned order. */
const toEntry = (record) => ({
  id: String(record.id),
  blockId: String(record.blockId ?? ''),
  text: String(record.text ?? ''),
  ts: String(record.ts ?? ''),
  status: record.status === STATUS_RESOLVED ? STATUS_RESOLVED : STATUS_OPEN,
})

/**
 * Effective comments: folded by id (last record wins), ordered by the first
 * time each id appeared, so resolving a comment never reorders the list.
 *
 * @returns {Array<{id: string, blockId: string, text: string, ts: string, status: string}>}
 */
export function listComments(artifactPath) {
  const order = []
  const byId = new Map()
  for (const record of readCommentRecords(artifactPath)) {
    if (!byId.has(record.id)) order.push(record.id)
    byId.set(record.id, record)
  }
  return order.map((id) => toEntry(byId.get(id)))
}

/** `c1`, `c2`, … — one past the highest id already in the log. */
const nextCommentId = (records) => {
  let highest = 0
  for (const record of records) {
    const match = /^c(\d+)$/.exec(String(record.id))
    if (match !== null) highest = Math.max(highest, Number(match[1]))
  }
  return `c${highest + 1}`
}

const appendRecord = (artifactPath, entry) => {
  const path = commentsPath(artifactPath)
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendLineAtomic(path, JSON.stringify(entry))
  } catch (cause) {
    throw validationError(
      CODES.WRITE_FAILED,
      `could not append to comments sidecar ${path}: ${cause.message}`,
    )
  }
  return entry
}

/**
 * Append one comment, anchored to a block that must exist.
 *
 * `blockIds` is supplied by the caller (read off the artifact's IR) rather than
 * parsed here: this layer never learns what an artifact looks like inside, and
 * the server and the CLI must validate against the *same* set or the two write
 * paths would disagree about which anchors are legal.
 *
 * @param {{artifactPath: string, blockId: string, text: string,
 *   blockIds: Set<string>|string[], now?: Date}} input
 */
export function appendComment({ artifactPath, blockId, text, blockIds, now = new Date() }) {
  const legal = blockIds instanceof Set ? blockIds : new Set(blockIds ?? [])
  const anchor = String(blockId ?? '').trim()
  const body = String(text ?? '').trim()

  if (anchor.length === 0) {
    throw validationError(CODES.BLOCK_NOT_FOUND, 'comment must name a blockId')
  }
  if (!legal.has(anchor)) {
    throw validationError(
      CODES.BLOCK_NOT_FOUND,
      `block "${anchor}" is not in this artifact's IR; known ids: ${[...legal].join(', ')}`,
    )
  }
  if (body.length === 0) {
    throw validationError(CODES.INPUT_EMPTY, 'comment text must not be empty')
  }

  const id = nextCommentId(readCommentRecords(artifactPath))
  return appendRecord(artifactPath, {
    id,
    blockId: anchor,
    text: body,
    ts: now.toISOString(),
    status: STATUS_OPEN,
  })
}

/**
 * Mark a comment resolved by appending a resolution record. The original line
 * stays exactly where it was.
 *
 * @param {{artifactPath: string, id: string, now?: Date}} input
 */
export function resolveComment({ artifactPath, id, now = new Date() }) {
  const wanted = String(id ?? '').trim()
  const current = listComments(artifactPath).find((entry) => entry.id === wanted)
  if (current === undefined) {
    throw validationError(
      CODES.COMMENT_NOT_FOUND,
      `no comment "${wanted}" on ${resolve(artifactPath)}`,
    )
  }
  return appendRecord(artifactPath, {
    ...current,
    ts: now.toISOString(),
    status: STATUS_RESOLVED,
  })
}

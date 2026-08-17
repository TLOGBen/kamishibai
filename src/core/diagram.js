import { walkBlocks } from './blocks.js'
import { CODES, validationError } from './errors.js'

/**
 * `diagram` v1 — one kind only: a directed node/edge graph (SPEC §3.3).
 *
 * Two decisions shape this module, and both are about honesty:
 *
 *  1. **Validation before drawing.** A diagram whose spec is broken (unknown
 *     kind, dangling edge, duplicate id) must fail with a `KSB_` code and a
 *     block path. Drawing "whatever survives" would produce a picture that
 *     silently disagrees with the spec it came from — the worst possible
 *     outcome for a document whose whole job is to be looked at.
 *  2. **Layout is pure integer arithmetic.** No clock, no randomness, no
 *     measured text: the same spec must yield byte-identical SVG (CONTRACT D1),
 *     because that is what makes `replay` and the export chain verifiable.
 *     The cost is honest ugliness — a long label overflows its box rather than
 *     being re-flowed by something we cannot reproduce.
 */

/** The one `kind` v1 implements. The 18-diagram-type taxonomy is later work. */
export const DIAGRAM_KINDS = Object.freeze(['graph'])

/**
 * Geometry, in SVG user units. Even numbers keep every midpoint an integer.
 *
 * Layers run **downwards**, siblings run across. The direction is not a taste
 * call: an artifact's SVG is scaled to the text measure (740px in long-form), so
 * a left-to-right chain of six nodes produced a 1500-unit canvas squeezed to
 * half size — a picture whose labels could no longer be read. Stacking layers
 * vertically keeps a chain one column wide and therefore legible at 1:1, and it
 * is the conventional reading direction for a flow anyway.
 */
const NODE_W = 180
const NODE_H = 56
/** Vertical distance between one layer and the next. */
const LAYER_GAP = 48
/** Horizontal distance between two nodes sharing a layer. */
const ROW_GAP = 28
const PAD = 24
/** How far a non-forward edge bulges out to the right of the boxes it joins. */
const BACK_DIP = 44
/** Extra canvas reserved on the right when non-forward edges exist. */
const BACK_BAND = BACK_DIP + 40

const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0

/**
 * Every problem with one diagram block, as human-readable messages.
 * Empty array means the block is drawable.
 */
export function diagramProblems(block) {
  if (isNonEmptyString(block?.parseError)) return [block.parseError]

  const problems = []
  if (!DIAGRAM_KINDS.includes(block?.kind)) {
    problems.push(
      `未知的 diagram kind ${JSON.stringify(block?.kind ?? null)}；v1 僅支援：${DIAGRAM_KINDS.join(', ')}`,
    )
  }

  const nodes = block?.nodes
  if (!Array.isArray(nodes) || nodes.length === 0) {
    problems.push('diagram.nodes 必須是至少一個節點的陣列')
    return problems
  }

  const ids = new Set()
  for (const [index, node] of nodes.entries()) {
    if (!isNonEmptyString(node?.id)) {
      problems.push(`nodes[${index}].id 必須是非空字串`)
      continue
    }
    if (ids.has(node.id)) {
      problems.push(`nodes[${index}].id "${node.id}" 重複；節點 id 必須唯一`)
      continue
    }
    ids.add(node.id)
    if (typeof node.label !== 'string') {
      problems.push(`nodes[${index}].label（id "${node.id}"）必須是字串`)
    }
  }

  const edges = block?.edges
  if (!Array.isArray(edges)) {
    problems.push('diagram.edges 必須是陣列（沒有邊就給空陣列）')
    return problems
  }
  for (const [index, edge] of edges.entries()) {
    for (const end of ['from', 'to']) {
      if (!isNonEmptyString(edge?.[end])) {
        problems.push(`edges[${index}].${end} 必須是非空字串`)
        continue
      }
      if (!ids.has(edge[end])) {
        problems.push(
          `edges[${index}].${end} 指向不存在的節點 "${edge[end]}"；` +
            `已宣告的節點：${[...ids].join(', ')}`,
        )
      }
    }
    if (edge?.label !== undefined && typeof edge.label !== 'string') {
      problems.push(`edges[${index}].label 若存在必須是字串`)
    }
  }
  return problems
}

/**
 * Fail on the first unusable `diagram` block in a document.
 *
 * Called from the render pipeline before a byte is drawn, so both entry points
 * (Markdown fence and block-tree JSON) and `replay` are covered by one gate.
 *
 * @throws {import('./errors.js').KsbError} exit 1 / KSB_DIAGRAM_INVALID
 */
export function assertDiagrams(doc) {
  for (const { block, path } of walkBlocks(doc)) {
    if (block?.type !== 'diagram') continue
    const problems = diagramProblems(block)
    if (problems.length === 0) continue
    throw validationError(
      `diagram block 無法繪製：${problems.join('；')}。` +
        '規格錯了就報錯，不畫半張圖——空 SVG 會讓錯誤在視覺上消失。',
      CODES.DIAGRAM_INVALID,
      path,
    )
  }
}

/**
 * Edge indices that close a cycle, found by an iterative DFS in declaration
 * order (so the answer is a deterministic function of the spec).
 *
 * Cycles must be *removed before layering*, not merely survived. A `store →
 * render` back edge — which every real architecture diagram has — makes plain
 * longest-path relaxation push its whole cycle one layer further on every
 * pass: capping the passes terminates, but the picture it terminates on is a
 * nonsense 5000-unit-wide canvas. Breaking the cycle first keeps the layering
 * a property of the structure rather than of the iteration count.
 *
 * The DFS is iterative because the stack depth would otherwise be the node
 * count, and a spec is user input.
 */
const findBackEdges = (nodes, edges) => {
  const outgoing = new Map(nodes.map((node) => [node.id, []]))
  for (const [index, edge] of edges.entries()) {
    if (edge.from !== edge.to) outgoing.get(edge.from).push({ index, to: edge.to })
  }

  const UNSEEN = 0
  const OPEN = 1
  const DONE = 2
  const state = new Map(nodes.map((node) => [node.id, UNSEEN]))
  const back = new Set()

  for (const root of nodes) {
    if (state.get(root.id) !== UNSEEN) continue
    const stack = [{ id: root.id, next: 0 }]
    state.set(root.id, OPEN)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const edgesOut = outgoing.get(frame.id)
      if (frame.next >= edgesOut.length) {
        state.set(frame.id, DONE)
        stack.pop()
        continue
      }
      const { index, to } = edgesOut[frame.next]
      frame.next += 1
      const seen = state.get(to)
      if (seen === OPEN) back.add(index)
      else if (seen === UNSEEN) {
        state.set(to, OPEN)
        stack.push({ id: to, next: 0 })
      }
    }
  }
  return back
}

/** Longest-path layering over the acyclic remainder of the spec. */
const assignLayers = (nodes, edges) => {
  const back = findBackEdges(nodes, edges)
  const forward = edges.filter((edge, index) => edge.from !== edge.to && !back.has(index))
  const layer = new Map(nodes.map((node) => [node.id, 0]))
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false
    for (const edge of forward) {
      const want = layer.get(edge.from) + 1
      if (want > layer.get(edge.to)) {
        layer.set(edge.to, want)
        changed = true
      }
    }
    if (!changed) break
  }
  return layer
}

const half = (value) => Math.round(value / 2)

/**
 * Labels sit *beside* their connector, anchored at the start, never centred on
 * it: a centred label lands exactly on the line it describes.
 */
const LABEL_ANCHOR = 'start'
const LABEL_INSET = 8

/** `M …` path for an edge that goes strictly downwards, layer to layer. */
const forwardPath = (a, b) => {
  const x1 = a.cx
  const y1 = a.y + NODE_H
  const x2 = b.cx
  const y2 = b.y
  const bend = half(y2 - y1)
  return {
    d: `M ${x1} ${y1} C ${x1} ${y1 + bend} ${x2} ${y2 - bend} ${x2} ${y2}`,
    labelX: half(x1 + x2) + LABEL_INSET,
    labelY: half(y1 + y2) + 4,
  }
}

/** `M …` path for a back edge or a same-layer edge: bulge out to the right. */
const backPath = (a, b) => {
  const x1 = a.x + NODE_W
  const y1 = a.cy
  const x2 = b.x + NODE_W
  const y2 = b.cy
  const bulge = Math.max(x1, x2) + BACK_DIP
  return {
    d: `M ${x1} ${y1} C ${bulge} ${y1} ${bulge} ${y2} ${x2} ${y2}`,
    labelX: bulge + LABEL_INSET,
    labelY: half(y1 + y2) + 4,
  }
}

/** `M …` path for a self-loop: a lobe off the node's right edge. */
const selfPath = (a) => {
  const x1 = a.x + NODE_W
  const y1 = a.y + Math.round(NODE_H / 3)
  const y2 = a.y + Math.round((NODE_H * 2) / 3)
  const out = x1 + BACK_DIP
  return {
    d: `M ${x1} ${y1} C ${out} ${y1} ${out} ${y2} ${x1} ${y2}`,
    labelX: out + LABEL_INSET,
    labelY: a.cy + 4,
  }
}

/**
 * Deterministic layered layout for a `kind: "graph"` diagram.
 *
 * Callers must have passed `diagramProblems` / `assertDiagrams` first; this
 * function assumes a valid spec and does no error reporting of its own.
 *
 * @returns {{width: number, height: number,
 *   nodes: Array<{id: string, label: string, x: number, y: number, w: number, h: number,
 *     cx: number, cy: number}>,
 *   edges: Array<{from: string, to: string, label: string|undefined, d: string,
 *     labelX: number, labelY: number}>}}
 */
export function layoutGraph(block) {
  const nodes = block.nodes
  const edges = block.edges ?? []
  const layer = assignLayers(nodes, edges)

  const rowOf = new Map()
  const rowsPerLayer = new Map()
  for (const node of nodes) {
    const l = layer.get(node.id)
    const row = rowsPerLayer.get(l) ?? 0
    rowOf.set(node.id, row)
    rowsPerLayer.set(l, row + 1)
  }

  const placed = nodes.map((node) => {
    const x = PAD + rowOf.get(node.id) * (NODE_W + ROW_GAP)
    const y = PAD + layer.get(node.id) * (NODE_H + LAYER_GAP)
    return {
      id: node.id,
      label: node.label,
      x,
      y,
      w: NODE_W,
      h: NODE_H,
      cx: x + half(NODE_W),
      cy: y + half(NODE_H),
    }
  })
  const byId = new Map(placed.map((node) => [node.id, node]))

  let hasBackEdge = false
  const drawn = edges.map((edge) => {
    const a = byId.get(edge.from)
    const b = byId.get(edge.to)
    let geometry
    if (edge.from === edge.to) {
      geometry = selfPath(a)
      hasBackEdge = true
    } else if (layer.get(edge.to) > layer.get(edge.from)) geometry = forwardPath(a, b)
    else {
      geometry = backPath(a, b)
      hasBackEdge = true
    }
    return {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      labelAnchor: LABEL_ANCHOR,
      ...geometry,
    }
  })

  const layerCount = Math.max(...[...layer.values()]) + 1
  const rowCount = Math.max(...rowsPerLayer.values())
  return {
    width:
      PAD * 2 + rowCount * (NODE_W + ROW_GAP) - ROW_GAP + (hasBackEdge ? BACK_BAND : 0),
    height: PAD * 2 + layerCount * (NODE_H + LAYER_GAP) - LAYER_GAP,
    nodes: placed,
    edges: drawn,
  }
}

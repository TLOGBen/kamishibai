import { h } from 'vue'
import { layoutGraph } from '../../../src/core/diagram.js'

/**
 * The Kami block vocabulary renderers, shared by every template in the `kami`
 * namespace. Long-form and slides differ in chrome and layout, not in what a
 * `callout` or a `list` *is* — keeping one table here is what stops a second,
 * silently divergent rendering path from appearing per template.
 */

const CALLOUT_LABELS = Object.freeze({ note: 'NOTE', warn: 'WARNING' })

/**
 * Block-level flow content that `<p>` may not contain. A `<p>` wrapping a
 * `<ul>` is invalid HTML: the parser implicitly closes the paragraph, so the
 * real DOM becomes an empty `<p>`, a list that has escaped the `.prose`
 * styling scope, and another empty `<p>`. Pick the container to match.
 */
const BLOCK_LEVEL_CONTENT = /<(?:ul|ol|div|pre|table|blockquote|figure|hr|h[1-6])\b/i

const Prose = (props) =>
  h(BLOCK_LEVEL_CONTENT.test(props.block.html) ? 'div' : 'p', {
    class: 'prose',
    innerHTML: props.block.html,
  })

const Quote = (props) =>
  h('blockquote', { class: 'quote' }, renderChildren(props.block.children))

const Callout = (props) =>
  h('aside', { class: `callout callout-${props.block.variant}` }, [
    h('span', { class: 'callout-label' }, CALLOUT_LABELS[props.block.variant] ?? 'NOTE'),
    ...renderChildren(props.block.children),
  ])

const Code = (props) =>
  h('pre', { class: 'code' }, [
    h('code', { class: props.block.lang ? `language-${props.block.lang}` : null }, props.block.text),
  ])

const Table = (props) =>
  h('div', { class: 'table-wrap' }, [
    h('table', { class: 'table' }, [
      h('thead', [
        h(
          'tr',
          props.block.head.map((cell, i) => h('th', { key: i, innerHTML: cell })),
        ),
      ]),
      h(
        'tbody',
        props.block.rows.map((row, ri) =>
          h(
            'tr',
            { key: ri },
            row.map((cell, ci) => h('td', { key: ci, innerHTML: cell })),
          ),
        ),
      ),
    ]),
  ])

const RawIsland = (props) =>
  h(props.block.subtype === 'svg' ? 'figure' : 'div', {
    class: 'island',
    'data-intent': props.block.intent,
    innerHTML: props.block.html,
  })

/**
 * A `list` keeps its own frame and hands each item's blocks straight back to
 * `renderChildren`, so a callout inside a list item is the very same Callout
 * component as one at document level (CONTRACT C1).
 */
const List = (props) =>
  h(
    props.block.ordered ? 'ol' : 'ul',
    { class: 'list' },
    (props.block.items ?? []).map((item, index) =>
      h('li', { key: item?.[0]?.id ?? index }, renderChildren(item)),
    ),
  )

const Section = (props) => {
  const level = Math.min(Math.max(props.block.level ?? 1, 1), 6)
  return h('section', { class: `section section-l${level}`, id: props.block.id }, [
    h(`h${level}`, { class: 'section-title' }, props.block.title),
    ...renderChildren(props.block.children),
  ])
}

/**
 * `diagram` → inline SVG, drawn from the layout `core/diagram.js` computes.
 *
 * The geometry deliberately lives outside the template: both Kami templates
 * must draw the *same* picture from the same spec (CONTRACT D1), and a layout
 * duplicated per template is a guarantee that they will eventually differ.
 * What a template may still own is the paint — the classes below are styled by
 * each stylesheet's own palette variables.
 *
 * The arrowhead marker id is derived from the block id, which is assigned in
 * document order: unique within an artifact (two diagrams cannot capture each
 * other's marker) and stable across renders (so the bytes stay identical).
 */
const Diagram = (props) => {
  const layout = layoutGraph(props.block)
  const arrowId = `ksb-arrow-${props.block.id}`
  return h('figure', { class: 'diagram', 'data-diagram-kind': props.block.kind }, [
    h(
      'svg',
      {
        class: 'diagram-svg',
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: `0 0 ${layout.width} ${layout.height}`,
        width: layout.width,
        height: layout.height,
        role: 'img',
      },
      [
        h('defs', [
          h(
            'marker',
            {
              id: arrowId,
              viewBox: '0 0 10 10',
              refX: 9,
              refY: 5,
              markerWidth: 7,
              markerHeight: 7,
              orient: 'auto-start-reverse',
            },
            [h('path', { class: 'diagram-arrow', d: 'M 0 0 L 10 5 L 0 10 z' })],
          ),
        ]),
        ...layout.edges.map((edge, index) =>
          h(
            'g',
            {
              class: 'diagram-edge',
              key: `e${index}`,
              'data-edge-from': edge.from,
              'data-edge-to': edge.to,
            },
            [
              h('path', { class: 'diagram-edge-line', d: edge.d, 'marker-end': `url(#${arrowId})` }),
              // Filtered rather than left as `null`: a null child SSRs to an
              // empty comment node, so an unlabelled edge would differ from a
              // labelled one by a stray `<!---->` in the bytes.
              ...(edge.label
                ? [
                    h(
                      'text',
                      {
                        class: 'diagram-edge-label',
                        x: edge.labelX,
                        y: edge.labelY,
                        'text-anchor': edge.labelAnchor,
                      },
                      edge.label,
                    ),
                  ]
                : []),
            ],
          ),
        ),
        ...layout.nodes.map((node) =>
          h('g', { class: 'diagram-node', key: node.id, 'data-node-id': node.id }, [
            h('rect', {
              class: 'diagram-node-box',
              x: node.x,
              y: node.y,
              width: node.w,
              height: node.h,
              rx: 6,
            }),
            h(
              'text',
              {
                class: 'diagram-node-label',
                x: node.cx,
                y: node.cy + 5,
                'text-anchor': 'middle',
              },
              node.label,
            ),
          ]),
        ),
      ],
    ),
  ])
}

export const RENDERERS = Object.freeze({
  section: Section,
  prose: Prose,
  list: List,
  quote: Quote,
  callout: Callout,
  code: Code,
  table: Table,
  raw: RawIsland,
  diagram: Diagram,
})

/** Render an array of blocks, skipping any type this template cannot draw. */
export function renderChildren(children) {
  if (!Array.isArray(children)) return []
  return children
    .filter((block) => RENDERERS[block.type] !== undefined)
    .map((block) => h(RENDERERS[block.type], { key: block.id, block }))
}

import { h } from 'vue'
import { manifest } from './manifest.js'

const CALLOUT_LABELS = Object.freeze({ note: 'NOTE', warn: 'WARNING' })

const Prose = (props) => h('p', { class: 'prose', innerHTML: props.block.html })

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

const Section = (props) => {
  const level = Math.min(Math.max(props.block.level ?? 1, 1), 6)
  return h('section', { class: `section section-l${level}`, id: props.block.id }, [
    h(`h${level}`, { class: 'section-title' }, props.block.title),
    ...renderChildren(props.block.children),
  ])
}

const RENDERERS = Object.freeze({
  section: Section,
  prose: Prose,
  quote: Quote,
  callout: Callout,
  code: Code,
  table: Table,
  raw: RawIsland,
})

function renderChildren(children) {
  if (!Array.isArray(children)) return []
  return children
    .filter((block) => RENDERERS[block.type] !== undefined)
    .map((block) => h(RENDERERS[block.type], { key: block.id, block }))
}

const Masthead = (props) =>
  h('header', { class: 'masthead' }, [
    props.meta.kicker ? h('p', { class: 'kicker' }, props.meta.kicker) : null,
    h('h1', { class: 'doc-title' }, props.meta.title),
    props.meta.author || props.meta.date
      ? h('p', { class: 'byline' }, [props.meta.author, props.meta.date].filter(Boolean).join(' · '))
      : null,
  ])

/** Root component of the Kami long-form template. */
export const LongFormDocument = (props) =>
  h('article', { class: 'paper', 'data-template': `${manifest.namespace}/${manifest.name}` }, [
    h(Masthead, { meta: props.doc.meta }),
    h('main', { class: 'doc-body' }, renderChildren(props.doc.children)),
    h('footer', { class: 'colophon' }, `kamishibai · ${manifest.namespace}/${manifest.name}@${manifest.version}`),
  ])

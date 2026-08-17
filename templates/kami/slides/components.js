import { h } from 'vue'
import { manifest } from './manifest.js'
import { renderChildren } from '../shared/blocks.js'

/** The deck sits at the doc root (parser/index.js buildDeck). */
const deckOf = (doc) => (doc.children ?? []).find((block) => block.type === 'deck')

/**
 * The opening slide carries the document's own identity (frontmatter title and
 * kicker); every later slide carries only its compiled blocks (CONTRACT C4).
 */
const SlideMasthead = (props) =>
  h('header', { class: 'slide-masthead' }, [
    props.meta.kicker ? h('p', { class: 'kicker' }, props.meta.kicker) : null,
    h('h1', { class: 'deck-title' }, props.meta.title),
    props.meta.author || props.meta.date
      ? h('p', { class: 'byline' }, [props.meta.author, props.meta.date].filter(Boolean).join(' · '))
      : null,
  ])

/**
 * `<section class="slide">` verbatim — the class attribute stays exactly one
 * token so the container is greppable as a constant, and per-slide variation
 * lives in the markup inside rather than in extra classes on the frame.
 */
const Slide = (props) =>
  h('section', { class: 'slide' }, [
    h('div', { class: 'slide-inner' }, [
      ...(props.first ? [h(SlideMasthead, { meta: props.meta })] : []),
      ...renderChildren(props.block.children),
    ]),
  ])

const DeckChrome = (props) =>
  h('footer', { class: 'deck-chrome' }, [
    h('span', { class: 'deck-progress' }, `1 / ${props.total}`),
    h('span', { class: 'deck-hint' }, '方向鍵／空白鍵翻頁 · F 全螢幕 · Esc 離開'),
  ])

/** Root component of the Kami slides template. */
export const SlidesDeck = (props) => {
  const deck = deckOf(props.doc)
  const slides = deck?.slides ?? []
  return h('div', { class: 'deck', 'data-template': `${manifest.namespace}/${manifest.name}` }, [
    ...slides.map((slide, index) =>
      h(Slide, { key: slide.id, block: slide, meta: props.doc.meta, first: index === 0 }),
    ),
    h(DeckChrome, { total: slides.length }),
  ])
}

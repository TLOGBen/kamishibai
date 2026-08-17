import { h } from 'vue'
import { manifest } from './manifest.js'
import { renderChildren } from '../shared/blocks.js'

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

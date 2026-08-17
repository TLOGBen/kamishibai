import { BLOCK_TYPES, CALLOUT_VARIANTS, RAW_SUBTYPES, META_KEY_ORDER } from './blocks.js'
import { IR_VERSION } from './ir.js'

export const SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema'
export const SCHEMA_ID = 'https://kamishibai.dev/schema/ir-1.json'

const str = { type: 'string' }
const children = { type: 'array', items: { $ref: '#/$defs/block' } }
const cells = { type: 'array', items: str }
/** `list.items` is one block array *per list item* — an array of arrays. */
const itemGroups = { type: 'array', items: children }

const whenType = (type, then) => ({
  if: { required: ['type'], properties: { type: { const: type } } },
  then,
})

const metaProperties = () =>
  Object.fromEntries(META_KEY_ORDER.map((key) => [key, str]))

/**
 * The IR JSON Schema (draft 2020-12). Single source of truth for `lint`,
 * for the `schema` command, and — by SPEC §15.2 — for generated docs.
 */
export function irSchema() {
  return {
    $schema: SCHEMA_DIALECT,
    $id: SCHEMA_ID,
    title: 'Kamishibai IR',
    description: '產物內嵌的 kamishibai IR 封包（SPEC §7.3）',
    type: 'object',
    required: ['irVersion', 'engine', 'template', 'doc', 'createdAt', 'generator'],
    properties: {
      irVersion: { ...str, const: IR_VERSION },
      engine: str,
      template: {
        type: 'object',
        required: ['namespace', 'name', 'version'],
        properties: { namespace: str, name: str, version: str },
        additionalProperties: false,
      },
      doc: { $ref: '#/$defs/doc' },
      createdAt: str,
      generator: str,
    },
    additionalProperties: false,
    $defs: {
      meta: {
        type: 'object',
        required: ['title'],
        properties: metaProperties(),
        additionalProperties: str,
      },
      doc: {
        type: 'object',
        required: ['id', 'type', 'meta', 'children'],
        properties: {
          id: str,
          type: { const: 'doc' },
          meta: { $ref: '#/$defs/meta' },
          children,
        },
        unevaluatedProperties: false,
      },
      block: {
        type: 'object',
        required: ['id', 'type'],
        properties: { id: str, type: { enum: [...BLOCK_TYPES] } },
        allOf: [
          whenType('section', {
            required: ['title', 'level', 'children'],
            properties: {
              title: str,
              level: { type: 'integer', minimum: 1, maximum: 6 },
              children,
            },
          }),
          whenType('prose', { required: ['html'], properties: { html: str } }),
          whenType('quote', { required: ['children'], properties: { children } }),
          whenType('callout', {
            required: ['variant', 'children'],
            properties: { variant: { enum: [...CALLOUT_VARIANTS] }, children },
          }),
          whenType('code', {
            required: ['lang', 'text'],
            properties: { lang: str, text: str },
          }),
          whenType('table', {
            required: ['head', 'rows'],
            properties: { head: cells, rows: { type: 'array', items: cells } },
          }),
          whenType('raw', {
            required: ['subtype', 'intent', 'html'],
            properties: {
              subtype: { enum: [...RAW_SUBTYPES] },
              intent: { ...str, minLength: 1 },
              html: str,
            },
          }),
          whenType('list', {
            required: ['ordered', 'items'],
            properties: { ordered: { type: 'boolean' }, items: itemGroups },
          }),
          whenType('deck', { required: ['slides'], properties: { slides: children } }),
          whenType('slide', { required: ['children'], properties: { children } }),
        ],
        unevaluatedProperties: false,
      },
    },
  }
}

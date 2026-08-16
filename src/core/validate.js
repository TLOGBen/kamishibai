import Ajv2020Module from 'ajv/dist/2020.js'
import { irSchema } from './schema.js'
import { CODES } from './errors.js'

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module

let validator = null

const compile = () => {
  if (validator === null) {
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    validator = ajv.compile(irSchema())
  }
  return validator
}

/** `/doc/children/0/html` → `doc.children[0].html` (SPEC §10.3: 錯誤指到 block path). */
export function pointerToBlockPath(pointer) {
  if (typeof pointer !== 'string' || pointer.length === 0) return '$'
  return pointer
    .split('/')
    .filter((part) => part.length > 0)
    .reduce((acc, part) => {
      const decoded = part.replace(/~1/g, '/').replace(/~0/g, '~')
      if (/^\d+$/.test(decoded)) return `${acc}[${decoded}]`
      return acc.length === 0 ? decoded : `${acc}.${decoded}`
    }, '')
}

/**
 * Validate an IR envelope against the schema.
 * @returns {{valid: boolean, errors: Array<{path: string, code: string, message: string}>}}
 */
export function validateIr(ir) {
  const validate = compile()
  const valid = validate(ir)
  if (valid) return { valid: true, errors: [] }
  const errors = (validate.errors ?? []).map((e) => ({
    path: pointerToBlockPath(e.instancePath),
    code: CODES.IR_SCHEMA,
    message: `${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(', ')})` : ''}`,
  }))
  return { valid: false, errors }
}

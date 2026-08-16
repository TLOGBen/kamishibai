import { IR_SCRIPT_TYPE } from '../core/ir.js'

const SCRIPT_SOURCE = `<script[^>]*type\\s*=\\s*["']${IR_SCRIPT_TYPE.replace('+', '\\+')}["'][^>]*>([\\s\\S]*?)<\\/script>`

/** Raw payloads of every embedded IR script found in an artifact. */
export function extractIrPayloads(html) {
  const re = new RegExp(SCRIPT_SOURCE, 'gi')
  const payloads = []
  let m
  while ((m = re.exec(html)) !== null) payloads.push(m[1])
  return payloads
}

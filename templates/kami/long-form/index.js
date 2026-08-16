import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { manifest, templateKey } from './manifest.js'
import { LongFormDocument } from './components.js'

const STYLES_PATH = fileURLToPath(new URL('./styles.css', import.meta.url))

/** Template package as consumed by the render layer. */
export default Object.freeze({
  manifest,
  key: templateKey,
  root: LongFormDocument,
  language: manifest.language,
  /** Fonts subset into the artifact (SPEC §7.2 出廠字體堆疊). */
  fonts: Object.freeze([
    Object.freeze({ package: '@fontsource/noto-serif-tc', weights: Object.freeze(['400', '700']) }),
  ]),
  styles: () => readFileSync(STYLES_PATH, 'utf8'),
})

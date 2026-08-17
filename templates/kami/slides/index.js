import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { manifest, templateKey } from './manifest.js'
import { SlidesDeck } from './components.js'

const STYLES_PATH = fileURLToPath(new URL('./styles.css', import.meta.url))
const PLAYBACK_PATH = fileURLToPath(new URL('./playback.js', import.meta.url))

/** Template package as consumed by the render layer. */
export default Object.freeze({
  manifest,
  key: templateKey,
  root: SlidesDeck,
  language: manifest.language,
  /** Fonts subset into the artifact (SPEC §7.2 出廠字體堆疊). */
  fonts: Object.freeze([
    Object.freeze({ package: '@fontsource/noto-serif-tc', weights: Object.freeze(['400', '700']) }),
  ]),
  styles: () => readFileSync(STYLES_PATH, 'utf8'),
  /** Inlined playback chrome (SPEC §7.4) — a template asset, never an island. */
  script: () => readFileSync(PLAYBACK_PATH, 'utf8'),
})

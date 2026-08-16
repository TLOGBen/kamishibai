import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

/** Server-render a template's root component against a doc block tree. */
export async function renderBody(template, doc) {
  const app = createSSRApp({
    render: () => h(template.root, { doc }),
  })
  return await renderToString(app)
}

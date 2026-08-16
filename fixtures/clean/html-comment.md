---
title: 乾淨案：內容含 HTML 註解開頭
kicker: LINT CLEAN CASE
---

# 內容含 `<!--` 仍須產出可解析的 IR

`<!--` 若原樣落進內嵌 IR，會提前終止 script 元素；但逃逸方式必須產生
**合法 JSON**（CONTRACT A2：JSON 可解析）。

```html
<!-- 這是一段 HTML 註解 -->
<div class="widget">
  <!-- 巢狀註解 -->
  <span>內容</span>
</div>
```

散文也可能直接談到註解語法，例如 `<!-- TODO -->`，以及結束標記 `-->`。

```js
// 也可能出現在 JS 字串裡
const marker = '<!--[if IE]>'
const closer = '</script>'
```

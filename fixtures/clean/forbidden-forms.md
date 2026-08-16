---
title: 乾淨案：內容文字含外部資源禁形字樣
kicker: LINT CLEAN CASE
---

# 文件談論禁形，本身不發請求

技術文件必然要引用反例。以下 code block 的內容是**文字**，不是活的標記，
lint 不得因此誤殺（CONTRACT A3「內容文字不在此限」、A5 乾淨案）。

```css
@import url(https://fonts.example.com/serif.css);
.hero {
  background: url(http://cdn.example.com/bg.png);
}
```

```html
<link rel="stylesheet" href="https://cdn.example.com/reset.css">
<script src="https://cdn.example.com/analytics.js"></script>
<img src="https://cdn.example.com/logo.png" alt="logo">
```

行內同理：`@import url(https://example.com/x.css)` 與
`<script src="https://example.com/a.js">` 都只是被談論的字串。

真正的外部連結 [規格書](https://example.com/spec) 以 `<a href>` 形式存在，
依 A3 亦不在禁形之列。

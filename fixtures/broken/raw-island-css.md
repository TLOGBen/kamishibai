---
title: 壞案四：raw 島嶼夾帶活的外部 CSS
---

# 島嶼裡的 CSS 是真的會發請求的

`@import` 與 `url(http…)` 不含 `<`，實體轉義救不了它們；它們只在 CSS 語境
中有意義，而 raw 島嶼注入的 `<style>` 與行內 `style=` 屬性**就是** CSS 語境。
本壞案用來證明「只掃 CSS 語境」不等於「不掃」。

```raw-html intent="蓄意夾帶活的外部 stylesheet import，證明 CSS 禁形仍被擋下"
<style>@import url(https://cdn.example.com/theme.css);</style>
<div style="background:url(http://cdn.example.com/bg.png)">島嶼內容</div>
```

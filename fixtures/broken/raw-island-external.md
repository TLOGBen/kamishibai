---
title: 壞案三：raw 島嶼夾帶活的外部資源
---

# raw 島嶼是活標記，不是文字

`raw` 島嶼的內容會原樣注入產物並在瀏覽器中生效。因此島嶼裡的外部引用
是**真的**會發請求的，lint 必須擋下——這是掃描前剔除「內容文字」時
不得一併放行的邊界。

```raw-html intent="蓄意夾帶外部 script，用以證明 lint 不會放行活標記"
<div class="tracker">
  <script src="https://cdn.example.com/tracker.js"></script>
</div>
```

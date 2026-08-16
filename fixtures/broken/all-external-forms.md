---
title: 壞案七：五種外部資源禁形全數活體出現
---

# 每一條禁形都要有「該擋而擋」的正向案

`EXTERNAL_RULES` 有五條規則，但只要有任一條從未被任何 fixture 觸發，
把它停用掉整個測試套件也不會有反應。本壞案讓五條規則同時成立，
搭配 `test_a5_lint_catches_every_external_form` 由規則清單反推應有的錯誤碼，
使得日後新增第六條規則卻沒有對應 fixture 時會直接失敗。

以下全部放在 raw 島嶼內，注入後都是活的標記，會真的發出請求。

```raw-html intent="五種禁形的活體樣本，專供 lint 正向案使用"
<link rel="stylesheet" href="https://cdn.example.com/reset.css">
<script src="https://cdn.example.com/analytics.js"></script>
<img src="https://cdn.example.com/pixel.png" alt="tracking pixel">
<style>@import url(https://cdn.example.com/theme.css);</style>
<div style="background:url(http://cdn.example.com/bg.png)">島嶼內容</div>
```

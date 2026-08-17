---
title: 紙芝居簡報試樣
kicker: KAMISHIBAI FIXTURE · DECK
author: vakarve
date: 2026-08-17
template: kami/slides
---

# 開場

同一份 Markdown 超集，換一個模板就是簡報：`---` 在 deck 模板下是切頁符，
文件模板下依舊什麼都不是。

---

# 清單與提示

- 第一點：清單是真的 `list` block，外框不會為了 callout 被拆掉
- 第二點：項目內可以放子 block
  :::warn
  投影片的清單項目裡也能放 callout。
  :::
- 第三點：巢狀清單同樣成立
  1. 內層有序項目一
  2. 內層有序項目二

---

# 程式碼與表格

```js
export const play = (deck) => deck.querySelectorAll('.slide').length
```

| 鍵 | 行為 |
|------|------|
| ArrowRight | 下一張 |
| Esc | 離開全螢幕 |

> 播放能力活在單檔產物裡，不需要任何外部請求。

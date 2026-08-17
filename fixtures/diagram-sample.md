---
title: 圖表語料
kicker: KAMISHIBAI DIAGRAM
author: kamishibai
date: 2026-08-17
template: kami/long-form
---

# 渲染管線

下圖是 SDK 的資料流：來源經 parser 編成 block tree，交給 render 組裝產物，最後由
delivery 投遞。`diagram` fence 的內容是 JSON，欄位就是 IR 的 diagram block。

```diagram
{
  "kind": "graph",
  "nodes": [
    { "id": "source", "label": "來源語料" },
    { "id": "parser", "label": "parser" },
    { "id": "core", "label": "core IR" },
    { "id": "render", "label": "render" },
    { "id": "delivery", "label": "delivery" },
    { "id": "store", "label": "中央產物庫" }
  ],
  "edges": [
    { "from": "source", "to": "parser", "label": "md / json" },
    { "from": "parser", "to": "core", "label": "block tree" },
    { "from": "core", "to": "render" },
    { "from": "render", "to": "delivery", "label": "html" },
    { "from": "delivery", "to": "store", "label": "正本" },
    { "from": "store", "to": "render", "label": "replay" }
  ]
}
```

## 為什麼是分層圖

同一份 spec 在兩套模板下畫出同一張圖：版面由 core 的確定性佈局算出，模板只負責上色。

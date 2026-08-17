---
title: 紙芝居試冊
kicker: KAMISHIBAI FIXTURE
author: vakarve
template: kami/long-form
---

# 第一章　內容與視覺的分離

kamishibai 的核心賭注：模型著作**結構化內容**，視覺交給模板。這一頁就是最小的證明——
它同時包含中文排版、`行內程式碼`、外部連結像 [OpenSlide](https://openslide.org/) 這樣的東西。

> 引用區塊：一本書自己記得自己是怎麼寫成的。

## 第一節　程式碼與表格

```js
export function hello(name) {
  return `你好，${name}`
}
```

| 欄位 | 意義 |
|------|------|
| irVersion | IR 版本 |
| doc | block tree |

:::note
這是一個 callout 區塊——note 型。
:::

:::warn
這是一個 callout 區塊——warn 型。語料必須窮舉 CALLOUT_VARIANTS 的每一項，
否則某個變體從未被渲染過，標籤寫錯也沒有任何測試會發現。
:::

## 第二節　清單

- 純清單項目一
- 純清單項目二（清單是 `list` block，項目內容是子 block）

有序清單同樣是 block-level，容器選擇不能只認 `ul`：

1. 有序項目一
2. 有序項目二

清單內也可以放 callout——外框保留，callout 是項目的子 block，而非被壓成 prose 裡的原始 HTML：

- 項目：前置說明
  :::warn
  清單內的警示。
  :::
- 項目：後續說明

# 第二章　島嶼

```raw-html
<div class="fixture-island" data-intent="測試 raw 島嶼">手寫 HTML 島嶼</div>
```

正文結束。

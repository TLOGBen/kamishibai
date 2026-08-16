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

# 第二章　島嶼

```raw-html
<div class="fixture-island" data-intent="測試 raw 島嶼">手寫 HTML 島嶼</div>
```

正文結束。

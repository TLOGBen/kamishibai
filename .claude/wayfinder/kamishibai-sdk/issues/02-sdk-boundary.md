# SDK 邊界定案

Status: resolved
Type: grilling

## Question

SDK 管到哪為止？目前的候選刀口（源自使用者描述的願景）：**渲染＋遞送＋模板系統＋持久化**——即「內容怎麼來」歸 skill，「模板怎麼定義、存在哪、怎麼渲染、怎麼送達」全歸 SDK；design 轉型為模板作者（在 SDK 持久化系統建立標準模板），book 等轉型為模板消費者。

待確認：
1. 這個刀口的翻譯是否準確反映使用者想像？
2. 「遞送」（開瀏覽器、SendUserFile、落檔路徑慣例）確定進 SDK？
3. 內容合成（book Synthesize、slide 切頁）確定不進？

## Answer

使用者確認刀口：**渲染＋遞送＋模板系統＋持久化歸 SDK；內容合成歸 skill**。design 轉型為模板作者（在 SDK 持久化系統建立標準模板），book 等轉型為模板消費者。

追加決定（超出原問題範圍但由使用者明示）：**design 與 book 兩個 skill 日後歸屬 kamishibai 專案，而非留在 baransu**——kamishibai 不只是 SDK 函式庫，也是這些呈現類 skill 的新家。此決定的包裝細節（kamishibai 是否同時作為 plugin 發佈）由遷移票（08）與發佈票（09）承接。

## Comments

- 2026-08-16 使用者於 charting session 以「對，所以在這個操作底下 design 和 book 以後會歸在這個專案而非 baransu」確認並擴充。

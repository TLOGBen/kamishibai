# 現況盤點：兩 plugin 的 HTML 產出機制

Status: resolved
Type: research

## Question

baransu 與 common-dev 兩個 plugin 中，所有會產出 HTML／視覺 artifact 的 skill 現況：各自產什麼、怎麼產（ad-hoc 著作／模板驅動／腳本驅動）、引用什麼主題與共用設施（output-journal 契約、golden-template、render_map.py），以及跨 skill 的重複度評估（主題 CSS、HTML 骨架、SVG 慣例、開瀏覽器／送檔處理、zh-TW chrome、品質閘門）。今日存在的獨立 renderer 共幾套？

（探勘 subagent 已於 charting session 派出，結果回報後記入 Answer。）

## Answer

完整報告見 [research/07-inventory-report.md](../research/07-inventory-report.md)。關鍵事實：

- 今日共存在 **10 套獨立 renderer**（腳本驅動 2：wayfinder render_map.py 208 行、strategic-advance strategic_state.py 5322 行；模板驅動模型填充 2：book 長文＋slides；規格驅動無模板 2：DESIGN.html、工作日誌；純 ad-hoc 4：錯字修改表、prototype、delegate impl.html、evolve convergence.svg）。
- **3 套互不相干的主題系統**：Kami 38-token 詞彙、wayfinder 航海配色、strategic-advance 軍事 HUD——零位元組共用；Kami 內部又有 126 個僅差 class 前綴的骨架複製。
- **HTML 骨架有 5 種不相干產生方式**；開瀏覽器有 2 個 fallback 鏈不同的近似函式＋baransu 的 SendUserFile 第三路；zh-TW 在地化有 2 套機制相反的實作（渲染前 token 替換 vs 渲染後 85 對字串替換）。
- **品質閘門 6 套、4 種語言**，規則彼此重述且單位不一致；map.html／sand-table.html／錯字表／工作日誌／prototype／impl.html **完全無閘門覆蓋**。
- 唯一既有共用設施：`_shared/output-journal.md`（97 行契約，僅為規格參照、無機制）與 `_shared/scripts/color_distance.py`。
- 佐證 SDK 假設：重複確實集中在「模板／主題／骨架／遞送／在地化／閘門」六個面向，而各 skill 的內容合成彼此獨立。

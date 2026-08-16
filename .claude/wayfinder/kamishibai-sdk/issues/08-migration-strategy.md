# 遷移順序與策略

Status: resolved
Type: grilling
Blocked by: 04, 06

## Question

規格定案後，既有 skill 依什麼順序遷移到 kamishibai？誰當第一個驗證客戶（book？wayfinder 地圖？）、遷移期間新舊機制如何並存、baransu golden-template 與 render_map.py 何時退役、以及每片遷移的 /contract → /seal 切法。

另依 02 追加決定：design 與 book 整個 skill 要「搬家」到 kamishibai 專案——需決定搬遷機制（kamishibai 是否同時作為 Claude Code plugin 發佈、baransu 端如何退場或轉發、marketplace 相容性）。

另依 12 定案：kamishibai plugin 層還須新增**產物管理輔助 skill**（教 Agent list／open／replay 慣用流程），與 design/book 同住；本票一併規劃其建置順位。

## Answer

定案（2026-08-16 使用者確認）：

1. **第一個驗證客戶＝book**（使用者最常用、回饋迴路最密）。後果：S1 核心脊椎前置 book 所需地基（Markdown 超集編譯、raw 島嶼、基本閘門），wayfinder 後移。
2. **新舊並存＝雙軌逐個切**——每個 skill 遷完即刪舊機制，未遷者照舊；舊設施退役綁客戶：golden-template 三兄弟＋126 骨架隨 book＋design 遷完退役、render_map.py 隨 wayfinder、strategic_state.py 的 HTML 部分隨沙盤。**硬約束（使用者指定）**：SDK 程式碼依 clean architecture 分層（parser／core／render／delivery／CLI 殼獨立模組）、單檔 <800 行，明文禁止 5k 行大單檔重演。
3. **搬家機制**：kamishibai 同時作為 Claude Code plugin 發佈（`.claude-plugin/`＋skills：design、book、產物管理輔助 skill、詞彙演化審查 skill——後者依 11 增補）；baransu 下個 major 移除 book/design，過渡期留薄提示 stub（僅提示改裝，一個版本週期後刪——目前僅使用者一人使用，過渡負擔低）。marketplace 兩 plugin 並列互不依賴。
4. **切片表（每片 /contract → 實作 → /seal）**：
   - S1 核心脊椎：IR schema＋Markdown 超集編譯＋render＋Kami 模板家族 v1（長文）＋CLI 基本盤（render/lint/example/schema）
   - S2 book 遷移 I：長文路徑（prose／島嶼／figure）＋中央產物庫＋open/list＋replay
   - S3 book 遷移 II：diagram plugin（18 圖型收編）＋deck/slide＋export pdf/pptx＋snapshot
   - S4 文件類輕客戶：錯字修改表、工作日誌
   - S5 遞送層補完：serve/HMR＋close＋config/setup/debug＋**留言迭代迴路**（block id 錨定留言、comments 指令——依 12 增補，v1 納入；初版驗證戰役範圍因此為 S1–S5＋design 最小段）
   - S6 視圖客戶：wayfinder 地圖＋沙盤遷移，render_map.py／strategic_state.py HTML 退役
   - S7 design 轉型：init/fork/import-template/export-template＋**臨摹能力**（解析圖片／文字／現成畫面含 CSS+script，逆向重組成暫存模板，入 store 的 draft 命名空間、人確認後轉正——使用者指定新增。**原則**：臨摹即模板語言的完備性判準——凡敘述不出來的即 spec 缺口，失敗案例回饋 block 詞彙演化，詳見地圖 Notes）＋lint 收編六閘門
   - S8 UI 模式＋換皮試穿
   - S9 MCP 殼＋npm 公開發佈（銜接 09）
5. **執行指揮層**：預設每片直接 contract→seal；當出現跨 session 停滯或單 session 飽和，將本地圖 Decisions so far＋切片表交 `/common:strategic-advance` 開戰役——屆時其入場條件自然滿足，現在不預先啟用。

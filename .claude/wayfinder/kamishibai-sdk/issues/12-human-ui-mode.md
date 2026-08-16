# UI 模式：給人使用的通道

Status: resolved
Type: grilling
Blocked by: 06

## Question

CLI 是 Agent 的通道；作為給**人**使用的通道，SDK 還要有 UI 模式。這張票定它的範圍與形狀：

1. **涵蓋什麼**：模板瀏覽／預覽（gallery）？產物庫瀏覽？主題切換即時預覽（換皮試穿）？內容編輯？還是只做唯讀的檢視與播放？
2. **實體形狀**：serve 模式（Vite dev server）上長出的本地 web UI？獨立指令（`kamishibai ui`）？或就是產物本身的內建 chrome（播放模式已是一種人用介面）？
3. **與 Agent 通道的關係**：人透過 UI 做的操作（選模板、調 token）要不要回寫成 Agent 可讀的狀態（檔案），維持「檔案是唯一真源」？

## Answer

定案（2026-08-16 使用者確認）：

1. **能力範圍＝唯讀管理台＋換皮試穿**——模板 gallery、產物庫瀏覽、換皮試穿（讀產物內嵌 IR 即時切換模板／版本對照預覽）、播放。不做內容編輯（著作歸 Agent 通道，避免雙寫入口）。
2. **實體形狀＝`kamishibai ui` 指令**起本地 web UI，架在 serve 模式同一套 dev server 基礎設施、同為 Vue 元件（自吃狗糧）。不做 Electron、不做雲端。
3. **檔案／儲存庫是唯一真源**——UI 的所有操作（選模板、調 config、退版）一律回寫檔案（config.toml、store 狀態），UI 不持有獨立狀態；人與 Agent 永遠透過檔案對話。

**附帶定案：產物的家與開啟方式**（使用者追問後拍板）：
- **中央產物庫為正本**：`~/.kamishibai/artifacts/<專案名>/…`，與模板庫同構分組；`render` 完成自動歸檔。產物自帶 IR，中央份即永久檔案庫——UI 產物庫、`replay`、試穿皆讀此。
- **投遞副本**：呼叫端仍可指定輸出路徑（如各 repo `.claude/book/` 老地方），作為交付用副本（SendUserFile、commit、分享）；副本路徑記入索引，刪除標失效，正本不受影響。SendUserFile 屬 Claude harness 工具，由 skill 側呼叫。
- **開啟三通道**：`kamishibai open <產物|latest>`（統一跨平台開啟鏈 wslview→xdg-open→explorer.exe→webbrowser，一次收編現存兩套分歧 opener）；UI 產物庫點開；產物本身雙擊即開（播放模式內建，10 已保證）。
- **`kamishibai list`／`store artifacts`**：自動解析當前專案，順序為 ① `--project` 明指 → ② 往上找最近的 `.kamishibai.toml` 專案描述檔（非 git 專案的持久錨點；由 `config set project` 或首次 render 落檔，子目錄執行也解析正確）→ ③ git root 資料夾名 → ④ cwd 資料夾名保底。列出該專案產物（名稱、模板＠版本、時間、generator、副本落點），`--json` 全支援——產物庫成為 Agent 可查詢的「專案呈現史」。（2026-08-16 修訂：使用者指出非 git 專案情境，補 ②錨點層。）
- **配套需求（使用者指定）**：kamishibai 須隨附**輔助 skill**（與 design/book 同住本專案 plugin 層），教會 Agent 產物查詢／開啟／replay 的慣用流程；實體歸屬轉記 08 遷移票。

## 增補：留言迭代迴路（2026-08-16 使用者指定，v1 納入）

參照 open-slide.dev 的 comment 機制，但以 IR 結構升級精度——**留言錨定 block id**，Agent 收到的是「哪個 block、什麼意見」，非自然語言猜謎：

- **留言即資料，非編輯**：唯讀原則與檔案唯一真源不破。serve／`ui` 模式下點任一 block 留言，寫入中央產物庫正本旁的 `<產物>.comments.jsonl`（block id 錨點、留言文字、時間、狀態 open/resolved）。
- **Agent 端**：CLI 新增 `comments <artifact>`（`--json`）；Agent 讀取 → 逐條修改 IR → `replay` 重繪 → 標 resolved。
- **v1 範圍**：serve／ui 模式可留言；離線單檔產物唯讀（file:// 無法寫檔，離線捕捉留待 v1.x）。
- **切片歸位**：S5（遞送層）；初版戰役範圍由 S1–S3 擴為 S1–S5＋design 最小段。

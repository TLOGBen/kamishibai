# kamishibai — Agent 專用呈現 SDK

## Destination

一份足以直接動工的 kamishibai SDK 規格：模板語言／初始化方案、持久化系統、渲染引擎、遞送層的架構與 API 形狀均已決定，並附各既有 skill（baransu book／design／write／think、common-dev wayfinder／strategic-advance）的遷移策略。實作本身不在地圖內——規格定案後交由 /contract → 實作 → /seal 分片執行。

## Notes

- **定位**：一開始就設計成可公開發佈的通用 Agent Presentation SDK（repo: https://github.com/TLOGBen/kamishibai ）；baransu 與 common-dev 兩個 plugin 是第一批客戶。
- **邊界（02 已定案）**：「內容怎麼來」歸 skill（合成不進 SDK）；「模板怎麼定義、存在哪、怎麼渲染、怎麼送達」全歸 SDK。design 轉型為模板作者（在 SDK 持久化系統中建立標準模板），book 等轉型為模板消費者；且 design、book 兩個 skill 日後歸屬 kamishibai 專案而非 baransu。
- **常設原則——臨摹即完備性判準（2026-08-16 使用者定調）**：模板語言的表達力目標是「能敘述任意圖片、文字與網站」；凡臨摹不出來的，就是模板語言漏考量的東西。每次臨摹失敗＝模板 spec 的 bug report；block 詞彙表是由失敗案例驅動演化的開放集，非封閉清單。演化走三級管線：島嶼＋intent → slot-report 遙測聚類 → plugin（歷史島嶼為 fixtures）→ 用量達標轉正入核心（詳見 11 增補；配套詞彙演化審查 skill）。
- **統一風格願景**：wayfinder 地圖、strategic-advance 沙盤等資料視圖，未來同樣改用同一風格模板家族、透過 SDK 呈現——不再各自維護獨立配色與 renderer（現況為三套互不相干的主題系統）。
- **命名血緣**：baransu（バランス）→ Kami 主題 → kamishibai（紙芝居）。
- **Ecosystem routing**：session 內 baransu 套件可用——grilling 票可配 /baransu:think 結構化判斷；research 產物可用 /baransu:read、/baransu:learn 落檔；規格成形後可用 /baransu:review 做二次意見。HTML 檢視語言維持 zh-TW 預設。
- **環境**：zsh、node 走 nvm（非互動 context 包 `zsh -lic`）。

## Decisions so far

- [專案命名](issues/01-naming.md) — 定名 **kamishibai**（紙芝居），repo 已建於 TLOGBen/kamishibai；沿 baransu／Kami 命名血緣。
- [SDK 邊界定案](issues/02-sdk-boundary.md) — 渲染＋遞送＋模板系統＋持久化歸 SDK，內容合成歸 skill；design＝模板作者、book＝模板消費者，且兩者日後歸屬 kamishibai 專案而非 baransu。
- [現況盤點：兩 plugin 的 HTML 產出機制](issues/07-inventory.md) — 今日共 10 套獨立 renderer、3 套互不相干主題系統、6 套品質閘門；重複集中在模板／主題／骨架／遞送／在地化／閘門六面向，佐證 SDK 假設。
- [雙模式決策](issues/05-dual-mode.md) — 定案單一管線「一切皆內容＋模板」：模型著作結構化 IR、SDK 確定性渲染、raw 島嶼逃生艙保表現力；歷史產物可隨主題重繪。產物須能單獨生存，規格另立 10 號票。
- [模板語言／初始化方案選型](issues/03-template-language.md) — IR 雙入口（Markdown 超集糖衣＋canonical JSON block tree）；模板棧定為 Vue3 + Vite SSG + singlefile 內聯單檔（Nuxt 不採用），Tailwind 架在 CSS 變數 token 上；新模板走模板包規格＋init/lint 腳手架（含 fork 捷徑）。CLI 須附 help/example 防試錯。
- [產物規格：單獨生存的輸出物](issues/10-artifact-spec.md) — 字體 build 時子集化；IR 隨產物內嵌為必要項（自帶原稿、隨時可重繪）；HTML 唯一一等公民且內建播放／演講模式，PDF/PPTX 為匯出附屬；軟上限 10MB／硬上限 16MB 皆可覆寫、零外部請求、evergreen 瀏覽器。
- [持久化系統形態](issues/04-persistence.md) — SDK 擁有獨立中央儲存庫（user scope 專屬目錄、具名專案／分組組織）＋出廠內建模板層；版本就地演進、保留近 N 版供退版比對；調用 key＝`namespace/name@version`，第三方模板包走 npm 分發。
- [技術形態／runtime](issues/06-runtime-form.md) — node library core＋CLI 薄殼＋MCP 殼（CLI 先行）；v1 指令面含 render/serve/replay/export/snapshot/lint/import-template/config/debug/setup 等全表；`--json` 全指令支援、錯誤指到 block 路徑、冪等、dry-run；模板包描述檔候選 TOML。
- [IR block 詞彙與模板包 manifest 細部規格](issues/11-ir-vocabulary-spec.md) — v1 詞彙表 17 種 block（含 video：embedded＋remote 帶 poster 離線降級）；TOML manifest 七區段；島嶼柵欄 20% 軟上限＋禁 script；IR 內嵌欄位定案；互動元件 v1 五件組；儲存庫 `~/.kamishibai/`、N=3。
- [遷移順序與策略](issues/08-migration-strategy.md) — book 為第一驗證客戶（S1 前置其地基）；雙軌逐個切、舊設施退役綁客戶；clean arch 分層＋單檔 <800 行硬約束；kamishibai 兼作 Claude Code plugin、baransu 留薄 stub 一版即刪；九片 S1–S9 各走 /contract→/seal；design 轉型含「臨摹」（圖片/文字/畫面→暫存模板）；戰略推進留作停滯時的升級指揮層。
- [UI 模式：給人使用的通道](issues/12-human-ui-mode.md) — 唯讀管理台＋換皮試穿（不做編輯）；`kamishibai ui` 本地 web UI；檔案唯一真源。附帶定案：中央產物庫 `~/.kamishibai/artifacts/<專案>/` 為正本、老地方為投遞副本；open 三通道＋統一跨平台開啟鏈；`list` 依「--project → `.kamishibai.toml` 錨點 → git root → cwd」四層解析當前專案（非 git 專案靠錨點檔）、`--json` 供 Agent 查詢；隨附產物管理輔助 skill（歸 08）。增補（v1）：留言迭代迴路——serve/ui 點 block 留言、錨定 block id 寫入 `<產物>.comments.jsonl`、Agent 以 `comments` 指令讀取修改後標 resolved；唯讀與檔案真源原則不破。
- [公開發佈包裝](issues/09-public-packaging.md) — MIT；套件名先試 `@kamishibai/sdk`、保底 `kamishibai-sdk`（裸名已被佔，已實查）；Kami 家族為出廠預設、zh-TW 預設可換；TsangerJinKai02 再散布授權列 S1 前查證項（否則退 Noto Serif TC）；semver 0.x 起步、S3 升 1.0；文件含 schema 自動生成的 block reference 與 AGENTS.md。

## Not yet specified

（已清空——所有霧項均被後續定案吸收：品質閘門對接由 11 的 manifest `[gates]`＋lint 收編承接；SVG 圖表模組化由 P1 的 `diagram` block＋plugin 機制承接；各 skill 遷移細節由 08 的 S1–S9 切片表承接，實作屬地圖之外。）

## Out of scope

- **SDK 的實作本身**——地圖終點是可動工規格（含遷移策略）；寫 code 是地圖之後的事。
- **各 skill 的內容合成核心**（book 的 Synthesize、slide 切頁、design 的引導流程）——依 02 定案不納入 SDK。

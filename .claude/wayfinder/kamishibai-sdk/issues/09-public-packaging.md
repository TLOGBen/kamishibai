# 公開發佈包裝

Status: resolved
Type: grilling
Blocked by: 06

## Question

作為一開始就要公開的通用 SDK：發佈到哪（npm？PyPI？GitHub release？）、license、文件與範例的最低標準、私有慣例（Kami 主題、zh-TW chrome、SendUserFile 流程）如何抽成可替換的預設而非硬編碼、以及版本策略（自家兩 plugin 追 SDK 版本的方式）。

## Answer

四題定案（2026-08-16 使用者確認）：

1. **License＝MIT**。
2. **套件名**：先試註冊 npm org `@kamishibai`（成→`@kamishibai/sdk`，為 mcp／模板包留地址空間）；失敗退 `kamishibai-sdk`（已驗證未被佔用；裸名 `kamishibai` 已被 Re:Earth 影片工具佔走 (verified: `curl registry.npmjs.org/kamishibai` → 200, latest 0.4.0)）。CLI 執行檔一律 `kamishibai`。
3. **私有慣例抽成預設**：Kami 模板家族作為出廠內建預設（token 全走 CSS 變數）；zh-TW chrome 預設＋`--language`。**Verification task（S1 前）**：TsangerJinKai02 再散布授權查證——npm 內嵌與子集化是否在倉耳免費授權內；否則出廠字體改 Noto Serif TC（OFL），Tsanger 降為使用者自裝層。
4. **版本與文件**：semver、0.x 起步、book 遷移完（S3）升 1.0；兩 plugin 以 `^` 追版。文件最低標：README quickstart、block reference 由 `schema` 指令自動生成（單一真源）、模板作者指南、**AGENTS.md**（Agent-first SDK 的門面文件）。

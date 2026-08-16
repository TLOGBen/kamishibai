# 持久化系統形態

Status: resolved
Type: grilling
Blocked by: 02

## Question

SDK 內建的模板倉庫怎麼存、存哪、怎麼演進？——標準模板（design 產出）與專案客製模板的存放位置（user scope？project scope？兩層？）、版本化策略（模板改版後既有產出物怎麼辦）、以及查找／解析規則（skill 用什麼 key 調用模板）。

## Answer

三題定案（2026-08-16 使用者確認）：

1. **SDK 擁有獨立的中央儲存庫**——模板不散落在各 repo，住在 kamishibai 自己的儲存位置（user scope 下的專屬目錄），內部以**具名專案／分組**組織（與 baransu 遙測「集中 user scope、按專案分目錄」先例同構）。SDK 另自帶出廠內建模板家族（公開發佈的開箱層）。具體目錄佈局與分組模型屬 11 號票細部。
2. **版本：就地演進＋保留近幾版**——模板以最新版為正身演進；儲存庫保留最近 N 版供**退版**與**選擇比對**（N 可設定）。已接受的邊界：超出保留窗的歷史版本不可取回，「依原版重繪歷史產物」僅保證近 N 版內；但產物自帶 IR（10 定案），任何時點仍可用現行版模板重繪——樣貌可能不同，內容不失。
3. **調用 key＝命名空間 id**——`<namespace>/<name>@<version>`（省略版本＝最新；namespace 對映分組）；第三方模板包走 npm 分發（`kamishibai add <pkg>` 裝進中央儲存庫），不自建 registry。

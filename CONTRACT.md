# CONTRACT — S2 book 遷移 I：中央產物庫＋open/list/replay＋交付鏈

## 目標
S1 的渲染脊椎升級為完整交付鏈：render 自動歸檔正本至中央產物庫並落投遞副本；
Agent 能以 list 查專案呈現史、以 open 解析開啟、以 replay 從產物內嵌 IR 重繪。
既有 52 測試照綠（S1 為受保護地基）。

## 前提（Premises）
- P1 `已驗`：S1 sealed 基底＝commit 3867e21（CONTRACT 已歸檔 .claude/archived/）。
- P2 `已驗`：中央庫佈局規格＝SPEC.md §6（`~/.kamishibai/artifacts/<專案>/`）、專案解析四層＝SPEC §8（issues/12 定案）。
- P3 `已驗`：IR 內嵌欄位完整（S1 A2 已釘），replay 之資料源充分。
- P4 `已驗`（稽核官修正條款）：`~/.kamishibai` 為戰役保護資產；未經安全閘不得寫入。

## 可斷言條文
G2：觸及面為本 repo S1 程式（已逐檔審過三輪 seal）；新陷阱＝家目錄寫入與跨環境路徑，已升為 B1/B2 條文。
- [ ] B1 **HOME 紀律**：所有中央庫路徑經單一解析函式，`KAMISHIBAI_HOME` 環境變數優先、預設 `~/.kamishibai`；**整個測試套件禁觸真實家目錄**（測試自我斷言其 HOME 為暫存目錄；CI 可驗）。
- [ ] B2 **首觸安全閘**：真實執行首次寫入前探測庫根——不存在→建立並寫入 `created-by: kamishibai@<version>` 標記檔；已存在→不動既有檔案、僅追加（禁覆寫既存產物檔，同 slug 依 SPEC 走版本化/時戳尾綴）；**不覆寫須為機械性：產物寫入以 exclusive flag（`wx`）落檔、`EEXIST` 時重取唯一名重試（seal 補釘 F2）；sidecar（copies.json 等一切庫內檔案）同受此律——既存 sidecar 以合併取代截斷（蓋章驗補釘 F8）**。
- [ ] B3 render 完成後：中央庫 `artifacts/<專案>/<slug>.html` 正本存在，且與 `-o` 投遞副本 byte-identical；`--json` 輸出增列 `archived:"<abs path>"` 頂層鍵（原三鍵不變）。
- [ ] B4 `list --json`：輸出當前專案全部產物之陣列，每筆恰含 `{name, template, createdAt, generator, artifact, copies}`；專案解析依「`--project` → `.kamishibai.toml` → git root → cwd」四層，測試至少覆蓋 `--project` 與 git root 兩層；**衍生名兩級驗證（seal 補釘 F1）：使用者明指的 `--project` 嚴格拒收非法名；衍生層（錨點檔／git root／cwd）改決定性正規化（空白→`-` 等）後採用——含空白目錄名下 render 必須 exit 0 且歸檔至正規化專案目錄（釘死測試必備）**。
- [ ] B5 `open <name|latest> --dry-run`：解析中央庫並輸出目標絕對路徑 exit 0（不開瀏覽器）；查無 → exit 1 `KSB_ARTIFACT_NOT_FOUND`。
- [ ] B6 `replay <artifact> -o <out>`：讀內嵌 IR 重繪；固定 `KAMISHIBAI_BUILD_TIME` 下與原 render 產物 byte-identical；對無 IR 檔 exit 1 `KSB_IR_MISSING`。
- [ ] B7 端到端：`fixtures/book-sample.md` 走 render→list→open --dry-run→replay 全鏈之整合測試，全程於測試 HOME 內。
- [ ] B8 回歸：S1 全部 52 測試照綠；S1 五層分層與單檔 ≤800 行紀律不破；新指令沿用 `--json`/exit code/formatter 既有慣例（含於既有 formatter 測試）。

## 錯不起表面（Surface Inventory）
| 表面 | 格式 | 釘死測試 |
|------|------|----------|
| render `--json` 成功（擴充） | `{"ok":true,"artifact":…,"bytes":…,"archived":"<abs path>"}` 恰四鍵；bytes 真值錨沿用 | test_render_json_shape |
| list `--json` | 陣列，每筆恰六鍵（見 B4）；空專案輸出 `[]` exit 0 | test_list_json_shape |
| open `--dry-run` | stdout 恰為目標絕對路徑一行；`--json` 為 `{"ok":true,"path":…}` | test_open_dry_run |
| replay `--json` | 與 render 同形（含 archived） | test_replay_json_shape |
| 中央庫佈局 | `<HOME>/artifacts/<專案>/<slug>.html`＋`created-by` 標記檔 | test_store_layout |

## Verbatim Constants
```
env:            KAMISHIBAI_HOME（預設 ~/.kamishibai）
庫佈局:         artifacts/<專案名>/<slug>.html
標記檔:         created-by
新錯誤碼:       KSB_ARTIFACT_NOT_FOUND
專案解析序:     --project → .kamishibai.toml → git root → cwd
list 六鍵:      name, template, createdAt, generator, artifact, copies
render 四鍵:    ok, artifact, bytes, archived
```

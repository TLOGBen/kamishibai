# 現況盤點報告：baransu 4.0.0 與 common 1.13.0 的 HTML 產出機制

探勘 subagent 完成於 2026-08-16。以下為完整事實報告（不含設計提案）。

## 0. Plugin 根層基礎設施：無

兩個 plugin 根目錄皆無 root-level `scripts/`。唯一跨 skill 共用腳本目錄為 baransu `skills/_shared/scripts/`，僅含 `color_distance.py`（CVD 色距驗證器，design Step 3 與 book Stage 3 引用）。

另發現：`scripts/verify-skills.py` 被 evolve／review／health 多處引用為權威，但**發佈快取中不存在**（source-repo 專用腳本）。

## 1. 逐 skill 盤點

### baransu/book — 唯一完整渲染管線
- 產物：`.claude/book/{slug}.html`、slides、PDF、PPTX。
- 機制：**模板檔驅動、模型填充**。SSOT 為 `{project_root}/design-cores/long-form.html`（由 /design 寫入使用者專案，單一 `data-slot="long-form-body"`）；缺席時 fallback `references/golden-template.html`。模板是「生成參考範本，非固定 class 白名單」。
- Slides：`slide-cores/<layout>.html` 逐張生成；缺席時降級為 3 個硬編碼 layout。須內聯完整 tokens.css、960pt×540pt。
- 主題：Kami 預設；`--style kami|google-design|swiss|<gen slug>`；38 名canonical token 詞彙為硬地板（+5 capability tokens）。
- 腳本（皆為驗證器/轉換器，**不產 HTML**）：validate-output.ts 1135 行、html2pptx.js 1017 行、install-deps.ts 237、verify-render.py 72、swiss-smoke-test.sh 72、validate-swiss-deck.mjs 57。
- 靜態資產：3 個 golden-template（602/492/483 行）、範例與 fixtures、SVG 規則（svg-rendering-rules.md + 18 個 diagram-types）。

### baransu/design — DESIGN.html + 骨架語料庫
- 產物：`DESIGN.html`、`tokens.css`、`DESIGN.md`、`design-cores/`（21 HTML）、`slide-cores/`（21 HTML），staging 後原子 mv。
- DESIGN.html：**規格驅動、無模板檔**（`render-design-html.md` 61 行規格），模型每次從零著作；明文「不得引用 Kami 或外部模板」。
- design-cores/slide-cores：preset 模式**純位元組複製**；gen 模式以 class 前綴替換 re-skin 捐贈 preset。「21+21 骨架永不由 LLM 從零著作」。
- 語料庫：3 preset（紙／swiss／google-design）× 42 骨架 = **126 個 HTML 檔**；各約 300K。
- 閘門：check.py（811 行，Checks A–F）、editorial-sanity.sh（113 行）、紙-sanity.sh（preset-local）。

### baransu/write（Proofread）— 錯字修改.html
- **純 ad-hoc**：明文繞過 /book 管線（校對表屬分析輸出、無 SVG）。模仿 Kami 視覺、有 tokens.css 就沿用。無模板、無腳本、無閘門。

### baransu/think、review — HTML 工作日誌
- **規格驅動、無模板檔、無腳本**：引用 `_shared/output-journal.md`，「based on / styled after golden-template」——是*參照*而非機制，模型每次重新著作。`_shared/tdd.md` 使所有下游實作者成為同檔追記者。

### baransu/evolve
- `card.html` **委派給 /book**（明文「never hand-assemble HTML」）；`convergence.svg` 純 ad-hoc。

### baransu 不產 HTML 的 skill
learn、read（.html 僅為輸入格式）、contract、seal、hunt、ship、health、codex-skill-transfer。

### common/wayfinder — map.html
- **完全腳本驅動**：`render_map.py`（208 行 Python）解析 map.md + issues/，對 `assets/map-template.html`（307 行）做兩類替換：18 個 `__WF_*__` chrome token（LOCALES dict）＋ `__WAYFINDER_DATA_JSON__`；圖與看板由模板內聯 JS 客戶端渲染。
- 旗標：`--language zh-TW|en`（預設 zh-TW）、`--no-open`；預設開瀏覽器。
- 主題：**自有深色航海配色**（--sea/--beacon/--charted…，Georgia serif），與 Kami、canonical tokens 無關。

### common/strategic-advance — 沙盤 + 戰場圖
- **完全腳本驅動、無模板檔**：`strategic_state.py`（5322 行）；HTML 由 `_render_html_zh()` 以巨型 f-string 內聯（~615 行 HTML+CSS 嵌在程式碼中）；3 個 SVG emitter＋手刻排版 helper。
- CLI：render/render-graph/render-all，`--language`、`--no-open`。
- 主題：**自有軍事 HUD 配色**（--void/--cyan/--red…，Cascadia Code），同樣獨立。

### common/prototype（LOGIC）、common/delegate
- 皆**純 ad-hoc**單檔 HTML；delegate 的 `impl.html` 還是由 sidekick 模型寫的。

### common 不產 HTML 的 skill
research、grilling、define-goal、domain-modeling、better-prompts、wait-what。

## 2. 重複度評估（具體證據）

- **a. 主題 CSS：3 套互不相干的系統**（Kami 38-token／wayfinder 航海／SA 軍事 HUD），零位元組共用；且 Kami 系統內部 126 個骨架檔「token 引用完全相同、僅 class 前綴與字面值不同」（design SKILL 明文）＝內部三倍複製。
- **b. HTML 骨架：5 種不相干的產生方式**——模板檔+token 替換（wayfinder）、模板檔+模型填槽（book）、Python f-string 內聯（SA）、純規格無模板（DESIGN.html、工作日誌）、什麼都沒有（錯字表、prototype、impl.html）。
- **c. 開瀏覽器：兩個近似但不同的 Python 函式**——render_map.py 的 fallback 鏈含 xdg-open 與 explorer.exe；strategic_state.py 的沒有（WSL 無 wslu 路徑未處理）；baransu 則完全無程式化 opener，走 SendUserFile。
- **d. zh-TW 在地化：同需求、兩套不相容機制**——wayfinder 渲染前 LOCALES dict 替換 18 token；SA 渲染後對成品做 85 對字面字串替換（HTML_EN_REPLACEMENTS）。CLI 表面相同、內部相反。
- **e. SVG 慣例：4 套不相干制度**——book 有 GATE-A~L 機械強制；SA 手刻 helper；wayfinder 內聯 JS 畫；evolve ad-hoc。
- **f. 品質閘門：同一個「這 HTML 好不好」問題被用 4 種語言回答 6 次**（validate-output.ts／check.py／editorial-sanity.sh／render-design-html.md 手動 E1–E4／book 模型檢查表／紙-sanity.sh），規則彼此重述且單位不一致（行高 1.5–1.55 vs [1.50,1.55]；欄寬 ≤65ch vs ≤740px）。**完全無閘門覆蓋**：map.html、sand-table.html、錯字修改.html、工作日誌、prototype、impl.html。
- **g. book 的 3 個 golden-template 近平行複製**（TOC scrollspy、lightbox、paper chrome、架構 SVG 範例），又被 3 個 design-cores/long-form.html SSOT 遮蔽。

## 3. 今日獨立 renderer 統計：**10 套**

- 腳本驅動 2：render_map.py、strategic_state.py
- 模板驅動模型填充 2：book long-form、book slides
- 規格驅動無模板 2：DESIGN.html、工作日誌
- 純 ad-hoc 4：錯字修改.html、prototype LOGIC、delegate impl.html、evolve convergence.svg

另有驗證器／轉換器 9 套（非 renderer）。

## 4. output-journal.md 契約摘要

97 行；工作日誌唯一來源。落點 `.claude/<skill>/<slug>.html`；必要區段：原始輸出忠實呈現＋執行日誌（新在上、繁中）＋可選處置表＋條件式學習記錄；追記協定：就地編輯、頂端插入、永不改寫舊條目；SendUserFile 交付。渲染基礎僅為「以 golden-template 為本」的*參照*——無任何複製或填充機制。

## 5. golden-template 本體

`book/references/golden-template.html` 602 行/26KB：Kami 調色盤 CSS custom properties（含理由註解）、TOC scrollspy、lightbox、paper chrome、一個通過 GATE-A~E 的完整架構 SVG 示範（343–549 行）。siblings：-gd 492 行、-swiss 483 行。被 output-journal、think、review、book 引用；write 與 evolve 明文「模仿但不進管線／不碰內部」。

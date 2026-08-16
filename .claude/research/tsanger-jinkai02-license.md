# TsangerJinKai02（倉耳今楷 02）授權查證報告

> **VERDICT: NO-GO** — 倉耳今楷（TsangerJinKai）**整個家族、全部字重**皆不在倉耳字庫的免費開源授權清單內；字型檔內嵌的授權聲明明文要求「事先取得正式書面許可」才能以**任何方式**使用。因此既不得內嵌於 MIT 授權的公開 npm 套件再散布，也不得子集化後嵌入產出 HTML 散布給第三方。出廠字體改用 Noto Serif TC（SIL OFL 1.1），倉耳降為「使用者自行安裝、SDK 偵測使用」層。

- **查證日期**：2026-08-16（+0800）
- **查證對象**：TsangerJinKai02 / 仓耳今楷02（北京倉耳文字技術有限公司，tsanger.cn）
- **決策脈絡**：`.claude/wayfinder/kamishibai-sdk/issues/09-public-packaging.md` 所列 S1 前 Verification task
- **證據強度**：**一手官方**（官方授權聲明 PDF 原件、官網現行頁面 HTML 原始碼、字型檔二進位內嵌欄位，三個獨立官方面向互相印證）

---

## 一、兩個問題的結論

| # | 問題 | 結論 | 依據 |
|---|---|---|---|
| Q1 | 可否在 MIT 授權的公開 npm 套件中**內嵌並再散布**完整字型檔？ | **不可** | 不在免費授權清單；字型檔要求事先書面許可 |
| Q2 | 可否 build 時**子集化後嵌入產出 HTML** 散布給第三方？ | **不可** | 子集為字型軟體之衍生副本，不因子集化而脫離授權 |

---

## 二、關鍵條款（一兩句話版本）

倉耳的免費開源授權是**列舉式白名單**——只有附件所列 6 套共 22 款字體享有「永久免費商用、可複製／合併／嵌入／修改／再分發」的授權，**倉耳今楷不在該清單內**；而今楷字型檔自身的 name table 授權欄位（nameID 13）寫明：**「无论您以何种方式使用该字体，您必须事先获得北京仓耳文字技术有限公司的正式书面许可。」**

---

## 三、逐項證據

### 3.1 官方免費開源授權聲明（PDF 原件，親自判讀）

來源：<https://tsanger.cn/仓耳字库免费商用字体授权声明.pdf>
（編碼形式：`https://tsanger.cn/%E4%BB%93%E8%80%B3%E5%AD%97%E5%BA%93%E5%85%8D%E8%B4%B9%E5%95%86%E7%94%A8%E5%AD%97%E4%BD%93%E6%8E%88%E6%9D%83%E5%A3%B0%E6%98%8E.pdf`）

文件標題為《**仓耳字库免费开源字体授权声明**》，落款蓋北京倉耳文字技術有限公司公章，日期 **2020 年 11 月 11 日**。該 PDF 為掃描影像式，本次以擷取內嵌影像後親自逐頁判讀（非摘要轉述）。

**第一段（授權範圍的界定）逐字**：

> 2020 年新冠疫情出现以来……仓耳字库愿为众人抱薪，我们**精心挑选出 6 套共计 22 款字体（字体列表见附件）永久免费开源给社会**，无论机关、媒体、公司或是个人等请放心使用。

**第二章 · 许可与条件 逐字**：

> 特此允许任何取得免费字体的用户，授予在全球所有领域任何用户永久免费商用的权力，可用于免费使用、研究、复制、合并、**嵌入**、修改、**再分发**已修改和未修改的字型副本，但需要遵守下列所规定的条件：
>
> 1. 无论是原始版本或修改版本，免费字体或其中任何独立的个别构件，均不能被单独销售。
> 2. 使用的免费字体不得违反法律法规等的相关规定、不违反公序良俗、不违背政治环境且不侵犯任何第三方的任何合法权益，因此产生的一切后果由用户自行承担。
> 3. 免费字体，无论已修改或未修改、**部分或整体**，均必须完全通过本授权下分发，不得在任何其他授权条款下分发。

（第三章 终止授权、第四章 免责声明為一般性條款；文末註明「本声明的最终解释权归仓耳字库所有」。）

**附件「仓耳字库免费开源字体列表」逐項（22 款，全文照列）**：

| 序号 | 字体名称 | | 序号 | 字体名称 |
|---|---|---|---|---|
| 1 | 仓耳周珂正大榜书 | | 12 | 仓耳与墨 W05 |
| 2 | 仓耳小丸子 | | 13 | 仓耳舒圆体 W01 |
| 3 | 仓耳渔阳体 W01 | | 14 | 仓耳舒圆体 W02 |
| 4 | 仓耳渔阳体 W02 | | 15 | 仓耳舒圆体 W03 |
| 5 | 仓耳渔阳体 W03 | | 16 | 仓耳舒圆体 W04 |
| 6 | 仓耳渔阳体 W04 | | 17 | 仓耳舒圆体 W05 |
| 7 | 仓耳渔阳体 W05 | | 18 | 仓耳非白 W01 |
| 8 | 仓耳与墨 W01 | | 19 | 仓耳非白 W02 |
| 9 | 仓耳与墨 W02 | | 20 | 仓耳非白 W03 |
| 10 | 仓耳与墨 W03 | | 21 | 仓耳非白 W04 |
| 11 | 仓耳与墨 W04 | | 22 | 仓耳非白 W05 |

**判讀**：清單為封閉列舉，六個家族分別是 周珂正大榜书／小丸子／渔阳体／与墨／舒圆体／非白。**今楷（JinKai）家族一款都沒有**——不論 01、02、03，不論 W01–W05 任何字重。

### 3.2 官網現行「免費字體」分類頁（現況佐證）

來源：<https://www.tsanger.cn/category/114>（2026-08-16 存取）

該頁列出的免費字體恰為上述 **22 款、與 PDF 附件完全一致**：渔阳体 W01–W05、小丸子、周珂正大榜书、与墨 W01–W05、非白 W01–W05、舒圆体 W01–W05。**倉耳今楷未出現在此頁**。

> 這一項是「**截至今日**仍然如此」的關鍵引註。PDF 落款為 2020 年（檔案 metadata 顯示 2024 年重新產製），單憑 PDF 無法排除日後追加免費字體的可能；現行分類頁補上了這個缺口——六年後名單未擴充，今楷仍非免費字體。

### 3.3 倉耳今楷 02 官方商品頁（付費授權定位）

來源：<https://tsanger.cn/product/32>（仓耳今楷02-W03，2026-08-16 以 curl 取得 HTML 原始碼並逐字擷取，非摘要轉述）

頁面逐字內容：

> **本站所有字体均可免费下载，允许个人非商业免费使用**

> **授权费用: ¥ 16000 元**

授權費對應的用途清單（頁面逐字）：單一公司全媒體、集團公司全媒體、系列廣告、新媒體發布、系列活動、LOGO、單款包裝、系列包裝、單本圖書、系列圖書、影視節目、視頻廣告、企業官網、企業網店。

版權宣告：`Copyright©仓耳字库`。商務聯繫：`电话:4008986918 010-64705161 手机:13701347550 邮箱:hello@tsanger.cn`。

**判讀**：今楷 02 的官方定位是「**免費下載、僅限個人非商業使用**」的付費字體，商業使用須另購 ¥16,000 授權。**「可免費下載」不等於「可再散布」**——這正是中文字型最常見的誤讀點。

### 3.4 字型檔內嵌授權聲明（最直接的一手證據）

來源：官方下載連結 <https://tsanger.cn/download/仓耳今楷02-W03.ttf>（2026-08-16 下載，18.9 MB TrueType；以自行撰寫的 `name` table 解析程式讀取，非第三方轉述）

字型檔 `name` table 關鍵欄位逐字：

| nameID | 欄位 | 內容 |
|---|---|---|
| 1 | Family | `TsangerJinKai02 W03` / `仓耳今楷02 W03` |
| 0 | Copyright | `Copyright © Beijing Tsanger Character Technology Co., Ltd.. All rights reserved.` / `©北京仓耳文字技术有限公司。保留所有权利。` |
| 7 | Trademark | `TsangerJinKai02 is a trademark of Beijing Tsanger Character Technology Co., Ltd.` |
| **13** | **License Description（中文）** | **「无论您以何种方式使用该字体，您必须事先获得北京仓耳文字技术有限公司的正式书面许可。」** |
| **13** | **License Description（英文）** | **`Before using this font, you must be authorized by Beijing Tsanger Character Technology Co., Ltd.`** |
| 14 | License Info URL | （無） |

**判讀**：字型檔自述為 **All rights reserved / 保留所有权利**，且要求「**以任何方式使用**」皆須**事先取得正式書面許可**。這比「不在免費清單內」更強——它是專有授權的積極宣告。同一份 PDF 若適用於今楷，nameID 13 應會指向該免費授權，實際並未如此。

### 3.5 `fsType` 內嵌權限位元（技術旗標，須正確解讀）

同一字型檔 OS/2 table：`version=3, fsType=0x0008` → **Editable embedding**，且 NoSubsetting（bit 8）與 BitmapEmbeddingOnly（bit 9）**均未設定**。

**這一項表面上對 Q2 有利，但實際查對規範後反而支持結論**。依 Microsoft OpenType 規範 OS/2 表 `fsType` 章節（<https://learn.microsoft.com/en-us/typography/opentype/spec/os2#fstype>，OpenType 1.9.1）逐字：

- 值 **8 = Editable embedding**：「the font may be embedded, and may be **temporarily loaded** on other systems. As with Preview & Print embedding, documents containing Editable fonts may be opened for reading. In addition, editing is permitted…」
- 規範對此類內嵌的強制要求：「applications loading embedded fonts for temporary use (Preview & Print or Editable embedding) **must** delete the fonts when the document containing the embedded font is closed.」
- 只有值 **0 = Installable embedding** 才允許「may be **permanently installed** for use on a remote systems, or for use by other users」——今楷**不是** 0。
- 規範並明示權利來源與應用程式義務：「**Embedding licensing rights are granted by the vendor of the font.** Applications that implement support for font embedding **must not embed fonts which are not licensed to permit embedding**.」

判讀有三：

1. `fsType=8` 描述的是**文件內嵌且僅供暫時載入、關檔即須刪除**的情境（PDF／Word 之類）。npm 套件內附一份可永久留存、可任意取用的字型檔，對應的是 `fsType=0`（Installable）的權利範圍，今楷並未給到這一級。**Q1 因此連技術旗標都不支持。**
2. 網頁 `@font-face` 載入的 woff2／ttf 子集，是可被瀏覽器與使用者原樣取出的**獨立字型檔**，性質接近散布字型軟體，而非規範所設想的「關檔即刪」文件內嵌。
3. 規範自陳這些位元反映的是**廠商授予**的權利，且應用程式不得內嵌未獲授權的字型——旗標不是授權來源，合約才是。本案合約條款（3.4 nameID 13）要求任何使用皆須事先書面許可，直接壓過旗標。

因此 `fsType=0x0008` 不構成任何授權上的許可；就 Q1 而言它甚至是**反向證據**。

---

## 四、針對 Q2「子集化」的專門說明

子集化**不會**改變授權地位，理由如下：

1. **子集是字型軟體的衍生副本**，不是新作品。抽出 300 個字形、轉成 woff2、內聯成 base64，改變的是編碼與封裝形式，不是著作權客體。「只嵌了一部分」在著作權法上不構成獨立的授權基礎。
2. **倉耳自己就是這樣認定的**。即使是那份**寬鬆**的免費授權，第二章第 3 款仍寫明「免费字体，无论已修改或未修改、**部分或整体**，均必须完全通过本授权下分发」——原廠明文把「部分」納入授權客體。今楷連免費授權都適用不到，「部分」更無討論空間。
3. **今楷的條款根本沒有散布授權可言**。nameID 13 的要求是「任何方式使用皆須事先書面許可」，其中並不存在一個可供子集化去縮小的散布權利。

換句話說：Q1 不行的理由是「沒有授權」，Q2 不行的理由**同樣**是「沒有授權」——而不是「量比較少所以可能還好」。

---

## 五、對 MIT npm 套件的補充說明（避免另一種誤讀）

即使將來改用 22 款免費字體之一，仍須注意免費授權第二章第 3 款：**字型檔本身必須沿用倉耳授權散布，不得改用其他授權條款**。這與 SIL OFL 的處理方式相同——套件程式碼是 MIT，字型資產保留自身授權並附上授權全文即可，**但不得把字型宣告成 MIT**。`package.json` 的 `license: MIT` 只涵蓋程式碼，字型須在 `NOTICE` / `THIRD_PARTY_LICENSES` 明列。

同樣的規則適用於既定的 fallback：**Noto Serif TC 為 SIL OFL 1.1**，可內嵌、可子集化、可再散布，但須隨附 OFL 全文與版權聲明，且不得單獨販售。

**Reserved Font Name：無。** 已核對 Noto CJK 官方發行版的授權檔（<https://github.com/notofonts/noto-cjk/blob/main/Serif/LICENSE>，2026-08-16 取原始檔逐行確認）：檔案開頭僅有「This Font Software is licensed under the SIL Open Font License, Version 1.1.」，其後直接進入 OFL 全文，**未出現任何宣告 Reserved Font Name 的版權敘述行**。依 OFL 1.1 定義「"Reserved Font Name" refers to any names specified as such **after the copyright statement(s)**」，未宣告即不存在保留名稱。故子集化／改造後**沒有**強制改名義務——實作管線不需為此設計重新命名步驟。

---

## 六、未確認事項（明確標示，不腦補）

1. **購買 ¥16,000 商業授權是否即可再散布字型檔？未確認。** 該授權的用途列表（廣告／包裝／圖書／影視／官網）全是**使用**場景，並未涵蓋「將字型檔封裝進對外散布的軟體」。業界慣例上，SDK／App 內嵌散布屬於另一類 **嵌入授權（embedding / OEM license）**，須與原廠個別議定。本報告**未**取得倉耳對此的書面說明，故此點記為**未確認**，而非「明文禁止」。
2. **是否存在針對今楷的其他官方授權文件？未發現。** 已查 tsanger.cn 首頁、免費字體分類頁（/category/114）、今楷 02 商品頁（/product/32）、官方免費授權聲明 PDF，均未見今楷專屬的開放授權文件。
3. 若確有需求走付費路線，官方窗口：`hello@tsanger.cn`（商品頁列出）、`yyl@tsanger.cn`（商務合作）、電話 400-898-6918 / 010-64705161。

---

## 七、Go/No-Go 決議與後續動作

**NO-GO。** 不得將 TsangerJinKai02（或今楷家族任一字重）內嵌於 kamishibai SDK 的 npm 發佈物，亦不得子集化後嵌入 SDK 產出的 HTML 對外散布。

建議動作：

1. **出廠字體改為 Noto Serif TC（SIL OFL 1.1）**，內嵌與 build 時子集化皆在授權內；隨附 OFL 全文於 `THIRD_PARTY_LICENSES`。此即 `issues/09-public-packaging.md` 已預設的 fallback，直接生效。
2. **倉耳今楷降為「使用者自行安裝、SDK 偵測使用」層**：SDK 僅在 CSS `font-family` 堆疊中列出 `TsangerJinKai02`，由使用者本機字型提供；SDK 本身不散布任何今楷位元組。此路徑不觸及散布授權，僅涉及使用者自身的個人／商業使用授權（責任在使用者）。
3. **附帶發現（供型體決策者評估，本報告不代為選定）**：倉耳的免費 22 款授權本身**相當寬鬆**，明文允許複製、合併、嵌入、修改、再分發——阻礙來自**這一款字**，而非這家字廠。若仍希望出廠預設帶倉耳風味，可評估 22 款中的內文取向字體（如 仓耳与墨 W01–W05、仓耳非白 W01–W05）是否勝任 Kami 家族的閱讀面；此為型體品味判斷，需由型體決策者定奪。
4. 若團隊仍傾向出廠內建今楷，唯一合法路徑是**主動聯繫倉耳取得書面的嵌入／再散布授權**（見第六節第 1 點），在取得書面許可前不得進入 S1。

---

## 附錄：來源層級標示

| 證據 | 來源 | 層級 |
|---|---|---|
| `fsType` 值 8 的規範定義與法律定位 | <https://learn.microsoft.com/en-us/typography/opentype/spec/os2#fstype>（OpenType 1.9.1） | **一手規範（逐字）** |
| Noto CJK Serif 未宣告 Reserved Font Name | <https://github.com/notofonts/noto-cjk/blob/main/Serif/LICENSE> | **一手上游（逐行）** |
| 免費開源授權聲明全文與 22 款清單 | tsanger.cn 官方 PDF，親自逐頁判讀原件影像 | **一手官方（逐字）** |
| 現行免費字體名單 | <https://www.tsanger.cn/category/114> | **一手官方（現況）** |
| 今楷 02「個人非商業免費／¥16000 商業授權」 | <https://tsanger.cn/product/32>，curl 取 HTML 原始碼逐字擷取 | **一手官方（逐字）** |
| 字型檔 nameID 0/7/13、fsType | 官方下載之 `仓耳今楷02-W03.ttf`，自行解析 name / OS/2 table | **一手官方（字型檔內嵌）** |
| 「今楷僅供個人非商業、商用須購買授權」的一般說法 | 各字體聚合站轉述 | 二手轉述（僅作旁證，未用於支撐結論） |

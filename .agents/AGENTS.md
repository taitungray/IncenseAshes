# Codex Project Rules - 廟埕守香 (Incense Ashes)

## Android Packaging: Read This First

Before any Android, APK, AAB, Gradle, JDK, JAVA_HOME, signing, Firebase, or Google Play packaging work:

1. Use the documented release script by default:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1
```

Do not run raw Gradle, switch JDKs, change `JAVA_HOME`, or improvise Android SDK commands unless explicitly asked.

The release script handles web build, Capacitor sync, JDK 17, Android SDK 36, signed AAB/APK output, and APK signature verification.

## 核心設計準則 (Design Rules)

### 1. 純文字視覺表現 (Typography-Only Visuals)
**絕對核心原則**：在「對戰畫面（Battle Screen）」中，遊戲裡的所有實體（神明、法器、怪物等）**都必須且只能使用「中文字體（漢字）」來表現**。
- **對戰畫面嚴禁**使用或建議使用任何圖示、圖片（Icons/Images）來取代文字實體。
- **例外**：其他介面（如神明譜、活動面板、任務等）**不受此限制**，可以自由生成或使用圖片來提升介面質感。
- 對戰畫面中的所有視覺特效、打擊感與動態，都必須建立在「字體特效（CSS `text-shadow`, `filter`）」與「排版變形（CSS `transform`, `animation`）」的基礎上。
- **「拆字」**與**「疊字」**是本遊戲最重要的視覺亮點，請在後續的任何更新中堅持這項文化特色。

## 2. 嚴格限制最小字體大小 (Strict Minimum Font Size)
**絕對核心原則**：遊戲內任何介面（包含對戰畫面、面板、標籤、數值等）的字體大小**絕對不能小於 0.85rem (約 14px)**。
- 嚴禁使用 0.5rem, 0.6rem, 0.7rem 等無法閱讀的螞蟻字。
- 若排版空間不足，必須調整版面配置（如換行、加寬、省略號），而非縮小字體。
- 所有開發與樣式調整都必須遵守此底線，確保遊戲的易讀性與質感。

## 3. 神明字元與基礎法器顏色規範 (Character Color Consistency)
**絕對核心原則**：同一神明的所有特殊字元（如「媽」與「祖」）必須共用相同的神明主色系，**嚴禁針對單一字元設定不同的顏色**。
- 同一組神明的顏色應統一設定在 `.god-{slug}` 類別中（例如：`--god-paper`, `--god-ink`, `--god-color`）。
- 嚴禁使用 `[data-fragment="X"]` 選擇器來為神明的特定單字覆寫顏色，以確保對戰畫面中的視覺與角色辨識統一性。
- **基礎法器文字顏色**：所有 5 種基礎法器（`符`、`鏡`、`鈴`、`劍`、`印`）字體顏色必須保持統一的古墨深色 (`#17110c !important`)，嚴禁將單一法器（如 `劍`）文字改為其他顏色。

## 4. 跨平台字體與拆字特效規範 (Unified Cross-Platform Typography & FX)
**絕對核心原則**：全平台（Desktop / Android / iOS）必須維持統一的雲端字體與靈動的拆字打擊特效。
- 全全域優先採用 `Noto Serif TC` 與 `LXGW WenKai TC`，確保無標楷體的手機裝置畫面筆劃渾厚清晰。
- 必須保留漢字偏旁拆解、出鞘斬擊（如斬煞法劍 `artifactSwordPartSlash` 劍刃 `刂` 獨立揮舞與大弧度斬擊）、墨影雙層 (`inkEcho`) 與相鄰連線脈動等動態視覺。

## 5. APP 退背景生命週期管理 (Background & Audio Lifecycle)
**絕對核心原則**：當應用程式切換至背景或螢幕鎖定時，音樂與音效**必須立即暫停**。
- 必須 simultaneous 監聽 `visibilitychange`、`pause`、`resume` 以及 Capacitor `appStateChange` 事件。
- 進入背景時呼叫 `gameAudio.pauseForBackground()` 掛起 `AudioContext`；回到前景時呼叫 `gameAudio.resumeFromBackground()` 恢復。

## 6. Android 原生物理返回鍵處理 (Android Back Button Protection)
**絕對核心原則**：按下 Android 原生返回鍵時必須優先關閉彈出視窗與介面。
- 優先順序：關閉 Modal / 關閉活動面板 Hub -> 提示確認退出 App。

